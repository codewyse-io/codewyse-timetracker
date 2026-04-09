import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', '') || undefined,
          ...(configService.get<string>('REDIS_TLS', 'false') === 'true' ? { tls: {} } : {}),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'focus-score' },
      { name: 'reports' },
      { name: 'ai-insights' },
      { name: 'email' },
      { name: 'meeting-transcription' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
