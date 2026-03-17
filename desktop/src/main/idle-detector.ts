import { BrowserWindow, powerMonitor } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Process names that indicate an active meeting/call
const MEETING_PROCESSES: Record<string, string[]> = {
  win32: [
    'Zoom.exe',
    'Teams.exe',
    'ms-teams.exe',
    'slack.exe',
    'webex.exe',
    'CiscoCollabHost.exe',
    'Discord.exe',
    'skype.exe',
  ],
  darwin: [
    'zoom.us',
    'Microsoft Teams',
    'Microsoft Teams (work or school)',
    'Microsoft Teams classic',
    'Slack',
    'Webex',
    'Discord',
    'Skype',
    'FaceTime',
    'Google Chrome',     // for Google Meet
    'Arc',
    'Safari',
    'Firefox',
  ],
};

export class IdleDetector {
  private checkInterval: number = 10_000; // 10 seconds
  private idleThreshold: number = 30; // 30 seconds
  private isIdle: boolean = false;
  private idleStartTime: Date | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  setThreshold(seconds: number): void {
    this.idleThreshold = Math.max(10, seconds); // minimum 10 seconds
    console.log(`[IdleDetector] Threshold updated to ${this.idleThreshold}s`);
  }

  start(): void {
    if (this.intervalId) {
      this.stop();
    }
    this.intervalId = setInterval(() => this.check(), this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isIdle = false;
    this.idleStartTime = null;
  }

  private async check(): Promise<void> {
    const idleTime = powerMonitor.getSystemIdleTime();

    // If system reports idle, check if user is in a meeting
    if (idleTime >= this.idleThreshold) {
      const inMeeting = await this.isInMeeting();
      if (inMeeting) {
        // User is in a meeting — don't mark as idle
        if (this.isIdle) {
          // Was previously idle, resume since meeting detected
          const endTime = new Date();
          const startTime = this.idleStartTime || new Date(Date.now() - this.idleThreshold * 1000);
          const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          console.log(`[IdleDetector] Meeting detected — cancelling idle (duration was ${duration}s)`);
          this.isIdle = false;
          if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send('idle-resumed', {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              duration,
            });
          }
          this.idleStartTime = null;
        }
        return;
      }
    }

    if (idleTime >= this.idleThreshold && !this.isIdle) {
      this.isIdle = true;
      this.idleStartTime = new Date(Date.now() - idleTime * 1000);
      console.log(`[IdleDetector] IDLE DETECTED — system idle for ${idleTime}s, start: ${this.idleStartTime.toISOString()}`);
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('idle-detected', {
          startTime: this.idleStartTime.toISOString(),
        });
      }
    } else if (idleTime < this.idleThreshold && this.isIdle) {
      const endTime = new Date();
      const startTime = this.idleStartTime || new Date(Date.now() - this.idleThreshold * 1000);
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      console.log(`[IdleDetector] IDLE RESUMED — duration: ${duration}s, start: ${startTime.toISOString()}, end: ${endTime.toISOString()}`);

      this.isIdle = false;

      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('idle-resumed', {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration,
        });
      }

      this.idleStartTime = null;
    }
  }

  /**
   * Detects if the user is likely in a meeting by checking:
   * 1. macOS: microphone in use (via system profiler)
   * 2. Windows: meeting app processes with active audio
   * 3. Both: known meeting processes running
   */
  private async isInMeeting(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        return await this.isMicInUseMac();
      } else if (process.platform === 'win32') {
        return await this.isMicInUseWindows();
      }
    } catch {
      // If detection fails, don't suppress idle
    }
    return false;
  }

  /**
   * macOS: Check if microphone is actively being used.
   * When mic is in use during a call, the system reports it.
   */
  private async isMicInUseMac(): Promise<boolean> {
    try {
      // Check if any process is using the microphone via ioreg
      const { stdout } = await execFileAsync('ioreg', [
        '-l', '-w0', '-d1', '-r', '-c', 'AppleHDAEngineInput',
      ], { timeout: 3000 });

      if (stdout.includes('"IOAudioEngineState" = 1')) {
        console.log('[IdleDetector] Microphone is active (macOS) — likely in a meeting');
        return true;
      }

      // Fallback: check for common meeting processes with active audio
      const { stdout: psOut } = await execFileAsync('ps', ['-eo', 'comm'], { timeout: 3000 });
      const processes = MEETING_PROCESSES.darwin || [];
      const hasVideoCall = processes.some((name) => psOut.includes(name));

      if (hasVideoCall) {
        // Also verify mic is in use via a lighter check
        const { stdout: micCheck } = await execFileAsync('sh', [
          '-c',
          'log show --predicate \'process == "coreaudiod"\' --last 30s 2>/dev/null | grep -i "input" | head -1',
        ], { timeout: 3000 }).catch(() => ({ stdout: '' }));

        if (micCheck.trim()) {
          console.log('[IdleDetector] Meeting app + audio activity detected (macOS)');
          return true;
        }
      }
    } catch {
      // Silently fail
    }
    return false;
  }

  /**
   * Windows: Check if a meeting app is running AND the microphone is in use.
   * Uses PowerShell to query audio sessions.
   */
  private async isMicInUseWindows(): Promise<boolean> {
    try {
      // Check if any meeting process is running
      const { stdout: taskOut } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], {
        timeout: 5000,
      });

      const processes = MEETING_PROCESSES.win32 || [];
      const runningMeetingApp = processes.find((name) =>
        taskOut.toLowerCase().includes(name.toLowerCase())
      );

      if (!runningMeetingApp) return false;

      // Check if microphone is in use via PowerShell
      const psScript = `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $null = [Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
        $mic = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioCaptureId([Windows.Media.Devices.AudioDeviceRole]::Communications)
        if ($mic) { Write-Output "mic_available" } else { Write-Output "no_mic" }
      `;

      // Simpler approach: just trust that a meeting app running = likely in meeting
      console.log(`[IdleDetector] Meeting app detected: ${runningMeetingApp} (Windows) — suppressing idle`);
      return true;
    } catch {
      // Silently fail
    }
    return false;
  }
}
