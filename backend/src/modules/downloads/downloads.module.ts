import { Module } from '@nestjs/common';
import { DownloadsController } from './downloads.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [DownloadsController],
})
export class DownloadsModule {}
