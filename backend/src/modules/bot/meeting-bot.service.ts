import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotPoolManager } from './bot-pool.manager';
import { DeepgramService } from './deepgram.service';
import { S3Service } from '../s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess, execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { chromium, Browser } from 'playwright';

/**
 * Rename the signed-in bot's Google account display name so the bot appears
 * in the meeting as e.g. "Usama's Notetaker" rather than the bot account's
 * default name. Runs before navigating to the Meet URL.
 *
 * Expects `page` to already have a signed-in Google session (storageState loaded).
 * Splits the new name into firstName + lastName because Google requires both.
 *
 * Returns true on success, false on failure — the caller decides whether to
 * proceed anyway (we do: even if the rename fails, the bot still joins with
 * whatever the current name is).
 */
async function renameBotDisplayName(page: any, fullName: string, logger: Logger): Promise<boolean> {
  // Split "Usama's Notetaker" → firstName="Usama's", lastName="Notetaker"
  // If the name is a single word, use it as firstName and leave lastName empty.
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.lastIndexOf(' ');
  const firstName = spaceIdx > 0 ? trimmed.substring(0, spaceIdx) : trimmed;
  const lastName = spaceIdx > 0 ? trimmed.substring(spaceIdx + 1) : '';

  logger.log(`[renameBot] Setting Google display name: firstName="${firstName}" lastName="${lastName}"`);

  try {
    await page.goto('https://myaccount.google.com/name', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Click the pencil/edit button next to the name. Google's UI uses various selectors.
    const editSelectors = [
      'button[aria-label*="Edit name" i]',
      'button[aria-label*="Name" i]',
      'a[aria-label*="Edit name" i]',
      'div[role="button"][aria-label*="Edit" i]',
    ];
    let opened = false;
    for (const sel of editSelectors) {
      try {
        await page.locator(sel).first().click({ timeout: 3000 });
        opened = true;
        logger.log(`[renameBot] Opened name editor via: ${sel}`);
        break;
      } catch {}
    }
    if (!opened) {
      // Fallback: click the first row in the name section (entire row is sometimes clickable)
      try {
        await page.locator('a[href*="/name"]').first().click({ timeout: 3000 });
        opened = true;
      } catch {}
    }
    if (!opened) {
      logger.warn('[renameBot] Could not open name editor — proceeding with existing name');
      return false;
    }

    await page.waitForTimeout(2500);

    // Fill first name
    const firstInput = page.locator('input[aria-label*="First name" i], input[name="firstName"]').first();
    await firstInput.waitFor({ state: 'visible', timeout: 5000 });
    await firstInput.click();
    await firstInput.fill('');
    await firstInput.type(firstName, { delay: 20 });

    // Fill last name (even if empty, clear it so we don't leave stale text)
    const lastInput = page.locator('input[aria-label*="Last name" i], input[name="lastName"]').first();
    try {
      await lastInput.waitFor({ state: 'visible', timeout: 3000 });
      await lastInput.click();
      await lastInput.fill('');
      if (lastName) await lastInput.type(lastName, { delay: 20 });
    } catch {}

    // Click Save
    const saveSelectors = [
      'button:has-text("Save")',
      'div[role="button"]:has-text("Save")',
      'button[aria-label*="Save" i]',
    ];
    let saved = false;
    for (const sel of saveSelectors) {
      try {
        await page.locator(sel).first().click({ timeout: 3000 });
        saved = true;
        break;
      } catch {}
    }
    if (!saved) {
      logger.warn('[renameBot] Could not find Save button — proceeding anyway');
      return false;
    }

    // Wait for the save to propagate
    await page.waitForTimeout(4000);
    logger.log(`[renameBot] Display name updated successfully to "${fullName}"`);
    return true;
  } catch (err: any) {
    logger.warn(`[renameBot] Rename failed: ${err.message} — bot will join with current name`);
    return false;
  }
}

/**
 * Find the Playwright Chromium binary on disk.
 * Checks shared cache locations first (for production deploys where browsers
 * are installed to a system-wide path), then falls back to Playwright's default.
 */
function findChromiumExecutable(): string | undefined {
  const cacheRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/var/cache/playwright',
    join(process.env.HOME || '', '.cache', 'ms-playwright'),
  ].filter((p): p is string => Boolean(p));

  for (const root of cacheRoots) {
    if (!fs.existsSync(root)) continue;
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    // Look for any chromium* dir (chromium_headless_shell-XXXX, chromium-XXXX, etc)
    for (const entry of entries) {
      if (!entry.startsWith('chromium')) continue;
      const candidates = [
        join(root, entry, 'chrome-linux', 'headless_shell'),
        join(root, entry, 'chrome-linux', 'chrome'),
      ];
      for (const c of candidates) {
        try {
          if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
        } catch {}
      }
    }
  }
  return undefined;
}

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
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Load the bot's persisted Google session (cookies + localStorage) so the
   * bot appears as a signed-in real Google user. Workspace meetings silently
   * reject anonymous join requests, so this is the only way to make the bot
   * actually admittable to a Workspace meeting.
   *
   * Returns a Playwright `storageState` object, or `undefined` if no session
   * is configured. Looks in two places:
   *   1. S3 key from BOT_GOOGLE_SESSION_S3_KEY env var (preferred)
   *   2. Local file path from BOT_GOOGLE_SESSION_PATH env var
   */
  private async loadBotStorageState(): Promise<any | undefined> {
    const s3Key = this.configService.get<string>('BOT_GOOGLE_SESSION_S3_KEY');
    const localPath = this.configService.get<string>('BOT_GOOGLE_SESSION_PATH');

    if (s3Key) {
      try {
        this.logger.log(`[loadBotStorageState] Fetching session from S3: ${s3Key}`);
        const json = await this.s3Service.getObjectContent(s3Key);
        if (json) return JSON.parse(json);
      } catch (err: any) {
        this.logger.warn(`[loadBotStorageState] S3 fetch failed: ${err.message}`);
      }
    }

    if (localPath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(localPath)) {
          this.logger.log(`[loadBotStorageState] Loading session from local file: ${localPath}`);
          return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
      } catch (err: any) {
        this.logger.warn(`[loadBotStorageState] Local file read failed: ${err.message}`);
      }
    }

    this.logger.warn('[loadBotStorageState] No bot Google session configured — bot will join anonymously (Workspace meetings will likely reject)');
    return undefined;
  }

  /** Build an uploader closure for a specific bot session. Screenshots land
   *  in S3 under meeting-debug/{botId}/{label}-{ts}.png and the returned
   *  presigned URL is suitable for pasting into a browser to view. */
  private makeScreenshotUploader(botId: string): (buffer: Buffer, label: string) => Promise<string | null> {
    return async (buffer: Buffer, label: string): Promise<string | null> => {
      try {
        const key = await this.s3Service.uploadBuffer(buffer, `meeting-debug/${botId}`, `-${label}.png`);
        const url = await this.s3Service.getPresignedUrl(key, 86400); // 24h
        return url;
      } catch (err: any) {
        this.logger.warn(`Screenshot upload failed: ${err.message}`);
        return null;
      }
    };
  }

  async createBot(meetingUrl: string, botName = 'Pulse Notetaker', meetingId?: string): Promise<{ id: string }> {
    this.logger.log(`[createBot] Starting — url=${meetingUrl}, botName=${botName}, meetingId=${meetingId}`);

    if (!this.pool.canLaunch()) {
      throw new BadRequestException(`Maximum concurrent bots reached (${this.pool.getActiveCount()}). Try again later.`);
    }

    const botId = uuidv4();
    const audioFilePath = join(tmpdir(), `meeting_${botId}.wav`);
    this.logger.log(`[createBot] botId=${botId}, audioPath=${audioFilePath}`);

    let browser: Browser | null = null;
    try {
      // 1. Setup PulseAudio virtual sink (Linux only)
      let sinkModuleId: string | null = null;
      const isLinux = process.platform === 'linux';
      this.logger.log(`[createBot] Step 1: PulseAudio setup (isLinux=${isLinux})`);
      if (isLinux) {
        try {
          const result = execSync(`pactl load-module module-null-sink sink_name=bot_${botId} sink_properties=device.description="Bot_${botId}"`, { encoding: 'utf-8' });
          sinkModuleId = result.trim();
          this.logger.log(`[createBot] PulseAudio sink created: ${sinkModuleId}`);
        } catch (err: any) {
          this.logger.warn(`[createBot] PulseAudio setup failed (continuing): ${err.message}`);
        }
      }

      // 2. Launch Playwright Chromium in HEADED mode via Xvfb.
      // Headless Chromium is detected and blocked by Google Meet, so we run
      // a real headed browser on a virtual X display (DISPLAY=:99 from Xvfb).
      const chromiumPath = findChromiumExecutable();
      this.logger.log(`[createBot] Step 2: Launching Playwright Chromium (executablePath=${chromiumPath || 'default'}, DISPLAY=${process.env.DISPLAY || 'unset'})`);
      browser = await chromium.launch({
        headless: false,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--autoplay-policy=no-user-gesture-required',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--window-size=1280,720',
          '--start-maximized',
        ],
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':99',
          ...(isLinux && sinkModuleId ? { PULSE_SINK: `bot_${botId}` } : {}),
        },
      });

      // Load persisted Google session if available — required for joining
      // Workspace meetings (anonymous bots are silently rejected by Workspace anti-abuse).
      const storageState = await this.loadBotStorageState();
      this.logger.log(`[createBot] Using ${storageState ? 'PERSISTED' : 'ANONYMOUS'} browser context`);

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        permissions: ['microphone', 'camera'],
        storageState,
      });
      const page = await context.newPage();

      // Mask the navigator.webdriver flag to reduce automation detection
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // 3. If signed-in, update the bot account's Google display name to match
      // the requesting user (e.g., "Usama's Notetaker"). Skip if anonymous —
      // anonymous context isn't signed in, so there's no Google profile to edit.
      if (storageState) {
        this.logger.log(`[createBot] Renaming bot Google display name to "${botName}"`);
        await renameBotDisplayName(page, botName, this.logger);
      }

      // 4. Join meeting based on platform
      const platform = this.detectPlatform(meetingUrl);
      this.logger.log(`Bot ${botId} joining ${platform} meeting: ${meetingUrl}`);

      const uploader = this.makeScreenshotUploader(botId);

      try {
        if (platform === 'google_meet') await joinGoogleMeet(page, meetingUrl, botName, uploader);
        else if (platform === 'zoom') await joinZoom(page, meetingUrl, botName);
        else if (platform === 'teams') await joinTeams(page, meetingUrl, botName);
        else await page.goto(meetingUrl, { waitUntil: 'networkidle', timeout: 30000 });
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
      try {
        const { connection, emitter } = this.deepgramService.startLiveTranscription();

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
      this.logger.error(`[createBot] FAILED at step ${err.step || 'unknown'}: ${err.message}`);
      this.logger.error(`[createBot] Stack: ${err.stack}`);
      if (browser) {
        try { await browser.close(); } catch {}
      }
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
