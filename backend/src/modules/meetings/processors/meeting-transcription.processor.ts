import { Processor, Process } from '@nestjs/bull';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as fs from 'fs';
import { Meeting, MeetingStatus } from '../entities/meeting.entity';
import { MeetingBotService } from '../../bot/meeting-bot.service';
import { DeepgramService } from '../../bot/deepgram.service';
import { S3Service } from '../../s3/s3.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Processor('meeting-transcription')
export class MeetingTranscriptionProcessor {
  private readonly logger = new Logger(MeetingTranscriptionProcessor.name);

  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    private meetingBotService: MeetingBotService,
    private deepgramService: DeepgramService,
    private s3Service: S3Service,
    @Optional() @Inject(forwardRef(() => RealtimeGateway)) private realtimeGateway: RealtimeGateway,
    private configService: ConfigService,
  ) {}

  @Process()
  async handle(job: Job<{ meetingId: string }>) {
    const meeting = await this.meetingRepo.findOne({ where: { id: job.data.meetingId } });
    if (!meeting) return;

    // If there's no bot id, we can't find the audio — bail but update status so
    // the meeting doesn't stay stuck on PROCESSING forever.
    if (!meeting.recallBotId) {
      this.logger.warn(`Meeting ${meeting.id} has no recallBotId; marking failed`);
      await this.meetingRepo.update(meeting.id, {
        status: 'failed' as any,
        errorMessage: 'No bot session found — audio was not captured',
      } as any);
      if (this.realtimeGateway) {
        this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
          meetingId: meeting.id,
          status: 'failed',
        });
      }
      return;
    }

    try {
      let fullText = '';
      let durationSeconds: number | null = null;
      let recordingS3Key: string | null = null;

      // 1. Check if audio file exists from the bot recording
      const audioFilePath = this.meetingBotService.getAudioFilePath(meeting.recallBotId);

      if (audioFilePath && fs.existsSync(audioFilePath)) {
        // Upload audio to S3
        try {
          const audioBuffer = fs.readFileSync(audioFilePath);
          recordingS3Key = await this.s3Service.uploadBuffer(audioBuffer, `meetings/${meeting.id}`, '.wav');
        } catch (err) {
          this.logger.warn(`Failed to upload recording to S3: ${err.message}`);
        }

        // Transcribe with Deepgram
        try {
          const result = await this.deepgramService.transcribeFile(audioFilePath);
          fullText = result.transcript;
          durationSeconds = result.duration;
        } catch (err) {
          this.logger.warn(`Deepgram file transcription failed: ${err.message}`);
        }

        // Clean up temp file
        try { fs.unlinkSync(audioFilePath); } catch {}
      }

      // 2. Fallback: use accumulated live transcript from pool
      if (!fullText) {
        const liveTranscript = this.meetingBotService.getLiveTranscript(meeting.recallBotId);
        if (liveTranscript.length > 0) {
          fullText = liveTranscript.join('\n\n');
        }
      }

      if (!fullText) {
        this.logger.warn(`No transcript available for meeting ${meeting.id}`);
        fullText = 'No transcript available.';
      }

      // 3. AI Summary using OpenAI
      const { summary, actionItems } = await this.generateSummary(fullText);

      // 4. Update meeting
      await this.meetingRepo.update(meeting.id, {
        transcript: fullText,
        ...(recordingS3Key ? { recordingKey: recordingS3Key } : {}),
        summary,
        actionItems,
        durationSeconds,
        status: MeetingStatus.COMPLETED,
      } as any);

      // 5. Notify user via WebSocket
      if (this.realtimeGateway) {
        this.realtimeGateway.emitToUser(meeting.userId, 'meeting:completed', { meetingId: meeting.id });
      }
    } catch (err) {
      this.logger.error(`Failed to process meeting ${meeting.id}: ${err.message}`);
      await this.meetingRepo.update(meeting.id, { status: 'failed' as any });
    }
  }

  private async generateSummary(transcript: string): Promise<{ summary: string; actionItems: any[] }> {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: this.configService.get('AI_API_KEY') });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a meeting assistant. Given a meeting transcript, provide a JSON response with: 1) "summary": a concise 2-4 sentence summary of key discussion points and decisions, 2) "actionItems": an array of objects with "task" (string) and "assignee" (string or null) fields.',
          },
          { role: 'user', content: `Meeting Transcript:\n\n${transcript.substring(0, 15000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        summary: result.summary || 'No summary available.',
        actionItems: result.actionItems || [],
      };
    } catch (err) {
      this.logger.warn(`AI summary failed: ${err.message}`);
      return { summary: 'Summary generation failed.', actionItems: [] };
    }
  }
}
