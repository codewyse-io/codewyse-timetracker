import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type PresenceStatus = 'online' | 'away' | 'offline';

const PRESENCE_TTL = 90; // seconds
const OFFLINE_GRACE_MS = 30_000; // 30s grace before marking offline

@Injectable()
export class PresenceService implements OnModuleInit {
  private readonly logger = new Logger(PresenceService.name);
  private redis: Redis;
  private readonly offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
      maxRetriesPerRequest: 3,
    });
  }

  private key(userId: string): string {
    return `presence:${userId}`;
  }

  async setOnline(userId: string): Promise<void> {
    this.clearOfflineTimer(userId);
    await this.redis.setex(this.key(userId), PRESENCE_TTL, 'online');
  }

  async setAway(userId: string): Promise<void> {
    await this.redis.setex(this.key(userId), PRESENCE_TTL, 'away');
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  /** Refresh TTL — called on heartbeat */
  async refreshPresence(userId: string): Promise<void> {
    const current = await this.redis.get(this.key(userId));
    const status = current || 'online';
    await this.redis.setex(this.key(userId), PRESENCE_TTL, status);
  }

  /** Schedule offline after grace period (handles reconnects/page refreshes) */
  scheduleOffline(userId: string, callback: () => void): void {
    this.clearOfflineTimer(userId);
    const timer = setTimeout(async () => {
      await this.setOffline(userId);
      this.offlineTimers.delete(userId);
      callback();
    }, OFFLINE_GRACE_MS);
    this.offlineTimers.set(userId, timer);
  }

  private clearOfflineTimer(userId: string): void {
    const timer = this.offlineTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.offlineTimers.delete(userId);
    }
  }

  async getPresence(userId: string): Promise<PresenceStatus> {
    const status = await this.redis.get(this.key(userId));
    return (status as PresenceStatus) || 'offline';
  }

  async getPresenceBatch(userIds: string[]): Promise<Record<string, PresenceStatus>> {
    if (userIds.length === 0) return {};
    const pipeline = this.redis.pipeline();
    for (const id of userIds) {
      pipeline.get(this.key(id));
    }
    const results = await pipeline.exec();
    const map: Record<string, PresenceStatus> = {};
    userIds.forEach((id, i) => {
      const val = results?.[i]?.[1] as string | null;
      map[id] = (val as PresenceStatus) || 'offline';
    });
    return map;
  }
}
