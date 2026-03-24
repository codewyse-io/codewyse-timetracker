import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CallService } from './call.service';

@Controller('call')
@UseGuards(JwtAuthGuard)
export class CallController {
  constructor(
    private readonly callService: CallService,
    private readonly configService: ConfigService,
  ) {}

  @Get('ice-servers')
  getIceServers() {
    const turnDomain = this.configService.get<string>('TURN_DOMAIN', '');
    const turnUsername = this.configService.get<string>('TURN_USERNAME', '');
    const turnCredential = this.configService.get<string>('TURN_CREDENTIAL', '');

    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    if (turnDomain && turnUsername && turnCredential) {
      // Add STUN from the TURN provider
      servers.push({ urls: `stun:${turnDomain}:80` });

      // Add multiple TURN entries for maximum NAT traversal
      servers.push(
        { urls: `turn:${turnDomain}:80`, username: turnUsername, credential: turnCredential },
        { urls: `turn:${turnDomain}:80?transport=tcp`, username: turnUsername, credential: turnCredential },
        { urls: `turn:${turnDomain}:443`, username: turnUsername, credential: turnCredential },
        { urls: `turns:${turnDomain}:443?transport=tcp`, username: turnUsername, credential: turnCredential },
      );
    }

    return { iceServers: servers };
  }

  @Get('history')
  async getCallHistory(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(Math.max(parseInt(limit || '', 10) || 50, 1), 100);
    return this.callService.getCallHistory(req.user.id, parsedLimit);
  }
}
