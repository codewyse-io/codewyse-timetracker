import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepgramClient } from '@deepgram/sdk';
import { createReadStream } from 'fs';
import { EventEmitter } from 'events';

/**
 * Deepgram SDK v5 wrapper.
 *
 * v5 is a complete API redesign — `client.listen.v1.connect()` returns a
 * Promise<V1Socket> for live streaming, and `client.listen.v1.media.transcribeFile()`
 * is the prerecorded endpoint. Events are 'open' / 'message' / 'close' / 'error'.
 */
@Injectable()
export class DeepgramService {
  private readonly logger = new Logger(DeepgramService.name);
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = configService.get('DEEPGRAM_API_KEY', '');
  }

  /**
   * Start live transcription. Returns a connection wrapper that exposes
   *   - send(buffer): forward audio chunks to Deepgram
   *   - finish(): close the stream
   * and an EventEmitter that emits 'transcript' events.
   *
   * Note: connection is opened asynchronously in the background; audio sent
   * before the open completes is buffered.
   */
  startLiveTranscription(): {
    connection: { send: (chunk: Buffer) => void; finish: () => void };
    emitter: EventEmitter;
  } {
    const client = new DeepgramClient({ apiKey: this.apiKey });
    const emitter = new EventEmitter();

    let socket: any = null;
    const pending: Buffer[] = [];
    let closed = false;

    client.listen.v1
      .connect({
        Authorization: `Token ${this.apiKey}`,
        model: 'nova-2',
        smart_format: true,
        diarize: true,
        punctuate: true,
        interim_results: false,
        language: 'en',
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      } as any)
      .then((s) => {
        socket = s;
        socket.on('message', (data: any) => {
          try {
            const transcript = data?.channel?.alternatives?.[0]?.transcript;
            if (transcript && transcript.trim()) {
              const speaker = data?.channel?.alternatives?.[0]?.words?.[0]?.speaker ?? 0;
              emitter.emit('transcript', {
                text: transcript.trim(),
                speaker: `Speaker ${speaker}`,
                isFinal: data.is_final,
                timestamp: new Date().toISOString(),
              });
            }
          } catch {}
        });
        socket.on('error', (err: any) => {
          this.logger.error(`Deepgram live error: ${err.message || err}`);
          emitter.emit('error', err);
        });
        socket.on('close', () => {
          emitter.emit('close');
        });
        socket.on('open', () => {
          // Flush any buffered audio
          while (pending.length) {
            const chunk = pending.shift()!;
            try { socket.sendMedia(chunk); } catch {}
          }
        });
        socket.connect();
      })
      .catch((err: any) => {
        this.logger.error(`Deepgram connect failed: ${err.message || err}`);
        emitter.emit('error', err);
      });

    return {
      connection: {
        send: (chunk: Buffer) => {
          if (closed) return;
          if (socket) {
            try { socket.sendMedia(chunk); } catch {}
          } else {
            pending.push(chunk);
          }
        },
        finish: () => {
          closed = true;
          if (socket) {
            try { socket.close(); } catch {}
          }
        },
      },
      emitter,
    };
  }

  /** Transcribe a completed audio file. Used as a fallback / final step after recording. */
  async transcribeFile(filePath: string): Promise<{ transcript: string; duration: number }> {
    const client = new DeepgramClient({ apiKey: this.apiKey });

    const response = await client.listen.v1.media.transcribeFile(
      createReadStream(filePath),
      {
        model: 'nova-2',
        smart_format: true,
        diarize: true,
        punctuate: true,
        utterances: true,
      } as any,
    );

    const result: any = (response as any)?.data || response;
    const utterances = result?.results?.utterances || [];
    const transcript = utterances
      .map((u: any) => `Speaker ${u.speaker}: ${u.transcript}`)
      .join('\n\n');
    const duration = result?.metadata?.duration || 0;

    return { transcript, duration: Math.ceil(duration) };
  }
}
