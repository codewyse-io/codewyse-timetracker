import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotPoolManager } from './bot-pool.manager';
import { DeepgramService } from './deepgram.service';
import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess, execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import * as fs from 'fs';

// Platform handlers
import { joinGoogleMeet } from './platform-handlers/google-meet.handler';
import { joinZoom } from './platform-handlers/zoom.handler';
import { joinTeams } from './platform-handlers/teams.handler';

@Injectable()
export class MeetingBotService {
  private readonly logger = new Logger(MeetingBotService.name);
  readonly events = new EventEmitter(); // emits 'transcript' events for live streaming

  constructor(
    private readonly pool: BotPoolManager,
    private readonly deepgramService: DeepgramService,
    private readonly configService: ConfigService,
  ) {}

  async createBot(meetingUrl: string, botName = 'Pulse Notetaker', meetingId?: string): Promise<{ id: string }> {
    if (!this.pool.canLaunch()) {
      throw new BadRequestException(`Maximum concurrent bots reached (${this.pool.getActiveCount()}). Try again later.`);
    }

    const botId = uuidv4();
    const audioFilePath = join(tmpdir(), `meeting_${botId}.wav`);

    try {
      // 1. Setup PulseAudio virtual sink (Linux only)
      let sinkModuleId: string | null = null;
      const isLinux = process.platform === 'linux';
      if (isLinux) {
        try {
          const result = execSync(`pactl load-module module-null-sink sink_name=bot_${botId} sink_properties=device.description="Bot_${botId}"`, { encoding: 'utf-8' });
          sinkModuleId = result.trim();
        } catch (err) {
          this.logger.warn(`PulseAudio setup failed (may not be available): ${err}`);
        }
      }

      // 2. Launch Puppeteer
      const puppeteer = require('puppeteer');
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--autoplay-policy=no-user-gesture-required',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
        env: {
          ...process.env,
          ...(isLinux && sinkModuleId ? { PULSE_SINK: `bot_${botId}` } : {}),
        },
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // 3. Join meeting based on platform
      const platform = this.detectPlatform(meetingUrl);
      this.logger.log(`Bot ${botId} joining ${platform} meeting: ${meetingUrl}`);

      try {
        if (platform === 'google_meet') await joinGoogleMeet(page, meetingUrl, botName);
        else if (platform === 'zoom') await joinZoom(page, meetingUrl, botName);
        else if (platform === 'teams') await joinTeams(page, meetingUrl, botName);
        else await page.goto(meetingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (joinErr: any) {
        this.logger.error(`Bot ${botId} failed to join meeting: ${joinErr.message}`);
        await browser.close();
        if (isLinux && sinkModuleId) {
          try { execSync(`pactl unload-module ${sinkModuleId}`); } catch {}
        }
        throw new BadRequestException(`Failed to join meeting: ${joinErr.message}`);
      }

      // 4. Start ffmpeg recording
      let ffmpegProcess: ChildProcess | null = null;
      if (isLinux) {
        ffmpegProcess = spawn('ffmpeg', [
          '-f', 'pulse', '-i', `bot_${botId}.monitor`,
          '-ac', '1', '-ar', '16000',
          '-y', audioFilePath,
        ], { stdio: 'pipe' });
        ffmpegProcess.on('error', (err) => this.logger.error(`ffmpeg error: ${err.message}`));
      }

      // 5. Start Deepgram live transcription
      let deepgramConnection: any = null;
      try {
        const { connection, emitter } = this.deepgramService.startLiveTranscription();
        deepgramConnection = connection;

        emitter.on('transcript', (data) => {
          this.pool.appendTranscript(botId, `${data.speaker}: ${data.text}`);
          this.events.emit('transcript', { botId, meetingId, ...data });
        });

        // If ffmpeg is running, pipe audio to Deepgram
        if (ffmpegProcess?.stdout) {
          // Create a secondary ffmpeg to pipe raw PCM to Deepgram
          const dgStream = spawn('ffmpeg', [
            '-f', 'pulse', '-i', `bot_${botId}.monitor`,
            '-ac', '1', '-ar', '16000', '-f', 's16le', '-',
          ], { stdio: ['pipe', 'pipe', 'pipe'] });
          dgStream.stdout?.on('data', (chunk: Buffer) => {
            try { connection.send(chunk); } catch {}
          });
          dgStream.on('close', () => {
            try { connection.finish(); } catch {}
          });
        }
      } catch (dgErr: any) {
        this.logger.warn(`Deepgram live stream failed (recording continues): ${dgErr.message}`);
      }

      // 6. Register with pool
      this.pool.register(botId, {
        meetingId: meetingId || botId,
        browser,
        ffmpegProcess,
        audioFilePath,
        startedAt: new Date(),
        liveTranscript: [],
      });

      this.logger.log(`Bot ${botId} successfully joined and recording`);
      return { id: botId };
    } catch (err: any) {
      this.logger.error(`Failed to create bot: ${err.message}`);
      throw err;
    }
  }

  async stopBot(botId: string): Promise<string> {
    const bot = this.pool.get(botId);
    if (!bot) throw new BadRequestException('Bot not found or already stopped');

    // 1. Stop ffmpeg gracefully
    if (bot.ffmpegProcess) {
      bot.ffmpegProcess.kill('SIGINT');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => { bot.ffmpegProcess?.kill('SIGKILL'); resolve(); }, 5000);
        bot.ffmpegProcess!.on('close', () => { clearTimeout(timeout); resolve(); });
      });
    }

    // 2. Close browser
    try { await bot.browser.close(); } catch {}

    // 3. Cleanup PulseAudio
    if (process.platform === 'linux') {
      try { execSync(`pactl unload-module module-null-sink sink_name=bot_${botId} 2>/dev/null || true`); } catch {}
    }

    // 4. Unregister
    this.pool.unregister(botId);

    this.logger.log(`Bot ${botId} stopped. Audio at: ${bot.audioFilePath}`);
    return bot.audioFilePath;
  }

  getAudioFilePath(botId: string): string | null {
    return this.pool.get(botId)?.audioFilePath || null;
  }

  getLiveTranscript(botId: string): string[] {
    return this.pool.getLiveTranscript(botId);
  }

  getBotStatus(botId: string): string {
    return this.pool.get(botId) ? 'active' : 'stopped';
  }

  private detectPlatform(url: string): string {
    if (url.includes('meet.google.com')) return 'google_meet';
    if (url.includes('zoom.us')) return 'zoom';
    if (url.includes('teams.microsoft.com')) return 'teams';
    return 'other';
  }
}
