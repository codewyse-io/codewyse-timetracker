import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CallLog } from './entities/call-log.entity';
import { CallService } from './call.service';
import { CallGateway } from './call.gateway';
import { CallController } from './call.controller';
import { SignalingService } from './signaling.service';
import { MediasoupService } from './mediasoup.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallLog]),
    ConfigModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [CallController],
  providers: [CallService, CallGateway, SignalingService, MediasoupService],
  exports: [CallService, SignalingService, MediasoupService],
})
export class CallModule {}
