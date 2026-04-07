import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { PresenceService } from './presence.service';
import { SignalingService } from '../call/signaling.service';
import { MediasoupService } from '../call/mediasoup.service';

export interface AuthenticatedSocket extends Socket {
  user: { id: string; email: string; role: string; organizationId: string };
}

/** Registry for socket event handlers added by other modules */
type SocketEventHandler = (client: AuthenticatedSocket, data: any, callback?: Function) => void | Promise<void>;
const eventHandlers = new Map<string, SocketEventHandler>();

/** Called by other modules (Chat, Call) to register socket event handlers */
export function registerSocketHandler(event: string, handler: SocketEventHandler): void {
  eventHandlers.set(event, handler);
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (Electron desktop app, mobile apps, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowedOrigins = [
        process.env.ADMIN_URL || 'http://localhost:5173',
        process.env.DESKTOP_URL || 'http://localhost:5174',
      ];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    @Optional() @Inject(forwardRef(() => SignalingService))
    private readonly signalingService: SignalingService,
    @Optional() @Inject(forwardRef(() => MediasoupService))
    private readonly mediasoupService: MediasoupService,
  ) {}

  async afterInit(server: Server) {
    this.logger.log('=== WebSocket Gateway Initializing ===');

    // Redis adapter is only needed for horizontal scaling (multiple server instances).
    // Skip it when REDIS_ADAPTER=false or when Redis doesn't support PSUBSCRIBE (e.g., ElastiCache Valkey serverless).
    const useRedisAdapter = this.configService.get<string>('REDIS_ADAPTER', 'false') === 'true';
    this.logger.log(`REDIS_ADAPTER=${useRedisAdapter}`);

    if (useRedisAdapter) {
      const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD', '');
      const redisTls = this.configService.get<string>('REDIS_TLS', 'false') === 'true';
      const redisOpts: any = { host: redisHost, port: redisPort, password: redisPassword || undefined };
      if (redisTls) redisOpts.tls = {};

      try {
        const pubClient = new Redis(redisOpts);
        const subClient = pubClient.duplicate();

        pubClient.on('error', (err) => this.logger.warn(`Redis pub client error: ${err.message}`));
        subClient.on('error', (err) => this.logger.warn(`Redis sub client error: ${err.message}`));

        // Verify the Redis instance supports PSUBSCRIBE (required by @socket.io/redis-adapter).
        // AWS ElastiCache Valkey Serverless does NOT support PSUBSCRIBE, so we must detect this
        // and fall back to the in-memory adapter instead of crashing the process.
        await new Promise<void>((resolve, reject) => {
          const testSub = pubClient.duplicate();
          testSub.on('error', () => {}); // suppress
          const timeout = setTimeout(() => { testSub.disconnect(); reject(new Error('psubscribe timeout')); }, 5000);
          testSub.psubscribe('__test__', (err) => {
            clearTimeout(timeout);
            if (err) {
              testSub.disconnect();
              reject(err);
            } else {
              testSub.punsubscribe('__test__').then(() => testSub.disconnect()).catch(() => testSub.disconnect());
              resolve();
            }
          });
        });

        server.adapter(createAdapter(pubClient, subClient) as any);
        this.logger.log('WebSocket gateway initialized with Redis adapter');
      } catch (err: any) {
        this.logger.warn(`Redis does not support PSUBSCRIBE (likely Valkey Serverless). Using in-memory adapter. Error: ${err.message}`);
      }
    } else {
      this.logger.log('WebSocket gateway initialized with in-memory adapter (single instance mode)');
    }

    this.logger.log(`Registered socket event handlers: [${Array.from(eventHandlers.keys()).join(', ')}]`);
    this.logger.log('=== WebSocket Gateway Ready ===');
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`[WS] New connection attempt from ${client.id}, transport: ${client.conn?.transport?.name || 'unknown'}`);
    try {
      const token =
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`[WS] No auth token — disconnecting ${client.id}`);
        client.disconnect();
        return;
      }

      const jwtSecret = this.configService.get<string>('jwt.secret');
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET is not configured — rejecting WebSocket connection');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: jwtSecret,
      });

      client.user = { id: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId };

      // Join personal room for targeted messages
      await client.join(`user:${client.user.id}`);

      // Set presence online
      await this.presenceService.setOnline(client.user.id);

      // TODO: Scope presence broadcasts to users who share a conversation with this user,
      // or to an organization/team room once an organizationId field is added to the User entity.
      // Currently broadcasts to ALL connected clients which is inefficient at scale.
      this.server.emit('presence:update', {
        userId: client.user.id,
        status: 'online',
        lastSeen: new Date().toISOString(),
      });

      // Register all dynamic event handlers from other modules (Chat, Call)
      const handlerNames = Array.from(eventHandlers.keys());
      for (const [event, handler] of eventHandlers.entries()) {
        client.on(event, (data: any, callback?: Function) => {
          this.logger.log(`[WS] Event '${event}' from ${client.user?.email} (${client.id})`);
          handler(client, data, callback);
        });
      }

      this.logger.log(`[WS] Client connected: ${client.user.email} (${client.id}), handlers: [${handlerNames.join(', ')}]`);
    } catch (err: any) {
      this.logger.warn(`[WS] Connection rejected for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.user) return;

    const userId = client.user.id;

    // Check if user has other active connections
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    if (sockets.length > 0) {
      return;
    }

    // TODO: Scope presence broadcasts (see handleConnection TODO)
    this.presenceService.scheduleOffline(userId, () => {
      this.server.emit('presence:update', {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      });
    });

    // Clean up active call if user had one
    if (this.signalingService) {
      try {
        const activeCall = await this.signalingService.getUserActiveCall(userId);
        if (activeCall) {
          const isGroupCall = activeCall.participantIds.length > 2;

          if (isGroupCall) {
            // For group calls: only remove the disconnected peer, don't end the call
            const { call: updatedCall, ended } = await this.signalingService.removeParticipant(activeCall.id, userId);

            // Clean up SFU resources for the disconnected user
            if (activeCall.sfuMode && this.mediasoupService) {
              try {
                this.mediasoupService.removePeer(activeCall.id, userId);
              } catch (sfuErr) {
                this.logger.warn(`SFU cleanup error on disconnect: ${sfuErr}`);
              }
            }

            // Notify remaining participants that this peer left
            if (updatedCall) {
              for (const participantId of updatedCall.participantIds) {
                if (participantId !== userId) {
                  this.emitToUser(participantId, 'call:signaling', {
                    kind: ended ? 'call-end' : 'peer-left',
                    callId: activeCall.id,
                    fromUserId: userId,
                    reason: 'disconnect',
                  });
                  if (activeCall.sfuMode && this.mediasoupService) {
                    this.emitToUser(participantId, 'sfu:peer-left', {
                      callId: activeCall.id,
                      userId,
                    });
                  }
                }
              }
            }
          } else {
            // For 1:1 calls: end the entire call (existing behavior)
            const endedCall = await this.signalingService.endCall(activeCall.id);
            if (endedCall) {
              // Notify remaining participants
              for (const participantId of endedCall.participantIds) {
                if (participantId !== userId) {
                  this.emitToUser(participantId, 'call:signaling', {
                    kind: 'call-end',
                    callId: endedCall.id,
                    fromUserId: userId,
                    reason: 'disconnect',
                  });
                }
              }

              // Clean up SFU resources if applicable
              if (endedCall.sfuMode && this.mediasoupService) {
                try {
                  this.mediasoupService.removePeer(activeCall.id, userId);
                  const peerIds = this.mediasoupService.getRoomPeerIds(activeCall.id);
                  for (const peerId of peerIds) {
                    this.emitToUser(peerId, 'sfu:peer-left', {
                      callId: activeCall.id,
                      userId,
                    });
                  }
                } catch (sfuErr) {
                  this.logger.warn(`SFU cleanup error on disconnect: ${sfuErr}`);
                }
              }
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Call cleanup error on disconnect: ${err}`);
      }
    }

    this.logger.log(`Client disconnected: ${client.user.email} (${client.id})`);
  }

  @SubscribeMessage('presence:heartbeat')
  async handlePresenceHeartbeat(client: AuthenticatedSocket) {
    if (client.user) {
      await this.presenceService.refreshPresence(client.user.id);
    }
  }

  /** Utility: emit to a specific user across all their connections */
  emitToUser(userId: string, event: string, data: any): void {
    const room = this.server.sockets.adapter.rooms.get(`user:${userId}`);
    const socketCount = room ? room.size : 0;
    this.logger.debug(`[emitToUser] user=${userId} event=${event} sockets_in_room=${socketCount}`);
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Utility: emit to all members of a conversation room */
  emitToConversation(conversationId: string, event: string, data: any): void {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  /** Utility: join a client to a conversation room */
  async joinConversationRoom(client: Socket, conversationId: string): Promise<void> {
    await client.join(`conversation:${conversationId}`);
  }
}
