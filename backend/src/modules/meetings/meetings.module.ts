import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Meeting } from './entities/meeting.entity';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingTranscriptionProcessor } from './processors/meeting-transcription.processor';
import { BotModule } from '../bot/bot.module';
import { S3Module } from '../s3/s3.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting]),
    BotModule,
    S3Module,
    BullModule.registerQueue({ name: 'meeting-transcription' }),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingTranscriptionProcessor],
  exports: [MeetingsService],
})
export class MeetingsModule {}
