import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeetingBotService } from './meeting-bot.service';
import { DeepgramService } from './deepgram.service';
import { BotPoolManager } from './bot-pool.manager';

@Module({
  imports: [ConfigModule],
  providers: [MeetingBotService, DeepgramService, BotPoolManager],
  exports: [MeetingBotService, DeepgramService],
})
export class BotModule {}
