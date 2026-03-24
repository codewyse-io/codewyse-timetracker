import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { CallModule } from '../call/call.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
    }),
    forwardRef(() => CallModule),
  ],
  providers: [RealtimeGateway, PresenceService, WsJwtGuard],
  exports: [RealtimeGateway, PresenceService, WsJwtGuard],
})
export class RealtimeModule {}
