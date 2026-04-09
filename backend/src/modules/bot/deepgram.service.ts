import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepgramClient } from '@deepgram/sdk';
import * as fs from 'fs';
import { EventEmitter } from 'events';

@Injectable()
export class DeepgramService {
  private readonly logger = new Logger(DeepgramService.name);
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = configService.get('DEEPGRAM_API_KEY', '');
  }

  /** Start live transcription from an audio stream. Returns connection + EventEmitter that emits 'transcript' events. */
  startLiveTranscription(): { connection: any; emitter: EventEmitter } {
    const client = new (DeepgramClient as any)(this.apiKey);
    const emitter = new EventEmitter();

    // Use the listen.live() method — returns a WebSocket-based connection
    const connection = (client as any).listen.live({
      model: 'nova-2',
      smart_format: true,
      diarize: true,
      punctuate: true,
      interim_results: false,
      language: 'en',
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    });

    connection.on('transcriptReceived', (message: string) => {
      try {
        const data = JSON.parse(message);
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          const speaker = data.channel?.alternatives?.[0]?.words?.[0]?.speaker ?? 0;
          emitter.emit('transcript', {
            text: transcript.trim(),
            speaker: `Speaker ${speaker}`,
            isFinal: data.is_final,
            timestamp: new Date().toISOString(),
          });
        }
      } catch {}
    });

    connection.on('error', (err: any) => {
      this.logger.error(`Deepgram live error: ${err.message || err}`);
      emitter.emit('error', err);
    });

    connection.on('close', () => {
      emitter.emit('close');
    });

    return { connection, emitter };
  }

  /** Transcribe a completed audio file. Fallback for post-processing. */
  async transcribeFile(filePath: string): Promise<{ transcript: string; duration: number }> {
    const client = new (DeepgramClient as any)(this.apiKey);
    const audioBuffer = fs.readFileSync(filePath);

    const response = await (client as any).listen.prerecorded.transcribeFile(audioBuffer, {
      model: 'nova-2',
      smart_format: true,
      diarize: true,
      punctuate: true,
      utterances: true,
    });

    const result = response?.result || response;
    const utterances = result?.results?.utterances || [];
    const transcript = utterances
      .map((u: any) => `Speaker ${u.speaker}: ${u.transcript}`)
      .join('\n\n');
    const duration = result?.metadata?.duration || 0;

    return { transcript, duration: Math.ceil(duration) };
  }
}
