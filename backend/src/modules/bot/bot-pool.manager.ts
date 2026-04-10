import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser } from 'playwright';
import type { ChildProcess } from 'child_process';

interface ActiveBot {
  meetingId: string;
  browser: Browser;
  ffmpegProcess: ChildProcess | null;
  audioFilePath: string;
  startedAt: Date;
  liveTranscript: string[];
}

@Injectable()
export class BotPoolManager {
  private readonly logger = new Logger(BotPoolManager.name);
  private readonly activeBots = new Map<string, ActiveBot>();
  private readonly maxConcurrent: number;
  private readonly maxDurationMs: number;
  private watchdogInterval: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.maxConcurrent = parseInt(configService.get('MAX_CONCURRENT_BOTS', '3'), 10);
    this.maxDurationMs = 3 * 60 * 60 * 1000; // 3 hours
    this.startWatchdog();
  }

  canLaunch(): boolean { return this.activeBots.size < this.maxConcurrent; }
  getActiveCount(): number { return this.activeBots.size; }

  register(botId: string, data: ActiveBot): void {
    this.activeBots.set(botId, data);
    this.logger.log(`Bot registered: ${botId} (${this.activeBots.size}/${this.maxConcurrent})`);
  }

  unregister(botId: string): void {
    this.activeBots.delete(botId);
    this.logger.log(`Bot unregistered: ${botId} (${this.activeBots.size}/${this.maxConcurrent})`);
  }

  get(botId: string): ActiveBot | undefined { return this.activeBots.get(botId); }

  appendTranscript(botId: string, text: string): void {
    const bot = this.activeBots.get(botId);
    if (bot) bot.liveTranscript.push(text);
  }

  getLiveTranscript(botId: string): string[] {
    return this.activeBots.get(botId)?.liveTranscript || [];
  }

  private startWatchdog(): void {
    this.watchdogInterval = setInterval(() => {
      const now = Date.now();
      for (const [botId, bot] of this.activeBots) {
        if (now - bot.startedAt.getTime() > this.maxDurationMs) {
          this.logger.warn(`Bot ${botId} exceeded max duration, force-killing`);
          this.forceKill(botId);
        }
      }
    }, 60_000);
  }

  async forceKill(botId: string): Promise<void> {
    const bot = this.activeBots.get(botId);
    if (!bot) return;
    try { bot.ffmpegProcess?.kill('SIGKILL'); } catch {}
    try { await bot.browser.close(); } catch {}
    this.unregister(botId);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    for (const botId of this.activeBots.keys()) {
      await this.forceKill(botId);
    }
  }
}
