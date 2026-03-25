import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

interface ActiveCall {
  id: string;
  type: 'audio' | 'video';
  initiatorId: string;
  participantIds: string[];
  state: 'ringing' | 'connecting' | 'connected';
  startedAt: string;
  sfuMode: boolean;
}

const RINGING_TTL = 120; // 120 seconds — longer than client's 90s no-answer timeout

@Injectable()
export class SignalingService implements OnModuleInit {
  private readonly logger = new Logger(SignalingService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisTls = this.configService.get<string>('REDIS_TLS', 'false') === 'true';
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', '') || undefined,
      maxRetriesPerRequest: 3,
      ...(redisTls ? { tls: {} } : {}),
    });
  }

  private key(callId: string): string {
    return `call:${callId}`;
  }

  private userCallKey(userId: string): string {
    return `user-call:${userId}`;
  }

  /** Set user→call mapping for all given user IDs */
  private async setUserCallMappings(userIds: string[], callId: string, ttl: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const userId of userIds) {
      pipeline.setex(this.userCallKey(userId), ttl, callId);
    }
    await pipeline.exec();
  }

  /** Delete user→call mapping for all given user IDs */
  private async deleteUserCallMappings(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const keys = userIds.map((id) => this.userCallKey(id));
    await this.redis.del(...keys);
  }

  async initiateCall(
    type: 'audio' | 'video',
    initiatorId: string,
    targetIds: string[],
    sfuMode = false,
  ): Promise<ActiveCall> {
    const callId = uuidv4();
    const call: ActiveCall = {
      id: callId,
      type,
      initiatorId,
      participantIds: [initiatorId, ...targetIds],
      state: 'ringing',
      startedAt: new Date().toISOString(),
      sfuMode,
    };

    await this.redis.setex(this.key(callId), RINGING_TTL, JSON.stringify(call));

    // Set user→call mapping for all participants
    await this.setUserCallMappings(call.participantIds, callId, RINGING_TTL);

    return call;
  }

  async getCall(callId: string): Promise<ActiveCall | null> {
    const data = await this.redis.get(this.key(callId));
    if (!data) return null;
    return JSON.parse(data);
  }

  async acceptCall(callId: string): Promise<ActiveCall | null> {
    const call = await this.getCall(callId);
    if (!call) return null;

    call.state = 'connecting';
    // Extend TTL since call is now connecting (4 hours max)
    await this.redis.setex(this.key(callId), 4 * 3600, JSON.stringify(call));

    // Extend user→call mapping TTL for all participants
    await this.setUserCallMappings(call.participantIds, callId, 4 * 3600);

    return call;
  }

  async setConnected(callId: string): Promise<void> {
    const call = await this.getCall(callId);
    if (!call) return;

    call.state = 'connected';
    await this.redis.setex(this.key(callId), 4 * 3600, JSON.stringify(call));

    // Extend user→call mapping TTL for all participants
    await this.setUserCallMappings(call.participantIds, callId, 4 * 3600);
  }

  async endCall(callId: string): Promise<ActiveCall | null> {
    const call = await this.getCall(callId);
    await this.redis.del(this.key(callId));

    // Clean up user→call mappings for all participants
    if (call) {
      await this.deleteUserCallMappings(call.participantIds);
    }

    return call;
  }

  /** Remove a single participant from a call. Returns the updated call, or null if the call was ended (last participant left). */
  async removeParticipant(callId: string, userId: string): Promise<{ call: ActiveCall | null; ended: boolean }> {
    const call = await this.getCall(callId);
    if (!call) return { call: null, ended: true };

    call.participantIds = call.participantIds.filter(id => id !== userId);

    // Remove this user's call mapping
    await this.deleteUserCallMappings([userId]);

    // If no participants remain, end the call entirely
    if (call.participantIds.length === 0) {
      await this.redis.del(this.key(callId));
      return { call, ended: true };
    }

    // Update the call in Redis with remaining participants
    const ttl = await this.redis.ttl(this.key(callId));
    const effectiveTtl = ttl > 0 ? ttl : 4 * 3600;
    await this.redis.setex(this.key(callId), effectiveTtl, JSON.stringify(call));

    return { call, ended: false };
  }

  /** Add new participants to an existing call */
  async addParticipants(callId: string, newUserIds: string[]): Promise<ActiveCall | null> {
    const call = await this.getCall(callId);
    if (!call) return null;

    // Only add users not already in the call
    const toAdd = newUserIds.filter(id => !call.participantIds.includes(id));
    if (toAdd.length === 0) return call;

    call.participantIds.push(...toAdd);

    const ttl = await this.redis.ttl(this.key(callId));
    const effectiveTtl = ttl > 0 ? ttl : 4 * 3600;
    await this.redis.setex(this.key(callId), effectiveTtl, JSON.stringify(call));
    await this.setUserCallMappings(toAdd, callId, effectiveTtl);

    return call;
  }

  /** Get call for a specific user (check if they're in an active call) */
  async getUserActiveCall(userId: string): Promise<ActiveCall | null> {
    const callId = await this.redis.get(this.userCallKey(userId));
    if (!callId) return null;
    const call = await this.getCall(callId);
    if (!call) {
      await this.redis.del(this.userCallKey(userId)); // cleanup stale mapping
      return null;
    }
    return call;
  }
}
