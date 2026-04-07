import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const secret = this.configService.get<string>('jwt.secret');
      if (!secret) throw new WsException('JWT secret not configured');
      const payload = this.jwtService.verify(token, {
        secret,
      });
      (client as any).user = { id: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId };
      return true;
    } catch {
      throw new WsException('Invalid authentication token');
    }
  }
}
