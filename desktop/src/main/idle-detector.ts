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
  ],
};

// Communication apps — if one of these has the foreground window,
// the user is likely reading/composing messages, not truly idle
const CHAT_APPS: Record<string, string[]> = {
  win32: [
    'whatsapp.exe',
    'slack.exe',
    'teams.exe',
    'ms-teams.exe',
    'discord.exe',
    'telegram.exe',
    'signal.exe',
    'skype.exe',
  ],
  darwin: [
    'WhatsApp',
    'Slack',
    'Microsoft Teams',
    'Discord',
    'Telegram',
    'Signal',
    'Skype',
    'Messages',
  ],
};

// Remote desktop / VPS apps — if one of these has the foreground window,
// the user is actively working on a remote machine, not idle
const REMOTE_DESKTOP_APPS: Record<string, string[]> = {
  win32: [
    'mstsc.exe',          // Windows Remote Desktop
    'msrdc.exe',          // Microsoft Remote Desktop (modern)
    'vmconnect.exe',      // Hyper-V connection
    'vmware.exe',         // VMware Workstation
    'vmware-vmx.exe',     // VMware VM process
    'vmplayer.exe',       // VMware Player
    'virtualbox.exe',     // VirtualBox
    'VBoxSDL.exe',        // VirtualBox SDL
    'putty.exe',          // PuTTY SSH
    'kitty.exe',          // KiTTY SSH
    'mobaxterm.exe',      // MobaXterm
    'securecrt.exe',      // SecureCRT
    'winscp.exe',         // WinSCP
    'anydesk.exe',        // AnyDesk
    'TeamViewer.exe',     // TeamViewer
    'vncviewer.exe',      // VNC Viewer
    'Parsec.exe',         // Parsec
    'rustdesk.exe',       // RustDesk
    'x2goclient.exe',    // X2Go
    'tabby.exe',          // Tabby terminal (SSH)
    'termius.exe',        // Termius SSH
  ],
  darwin: [
    'Microsoft Remote Desktop',
    'VMware Fusion',
    'VirtualBox VM',
    'Parallels Desktop',
    'Terminal',           // often used for SSH
    'iTerm2',             // SSH terminal
    'AnyDesk',
    'TeamViewer',
    'Screens',            // macOS VNC client
    'Royal TSX',          // Remote management
    'Termius',
    'Tabby',
    'Warp',               // terminal for SSH
  ],
};

export class IdleDetector {
  private checkInterval: number = 30_000; // 30 seconds
  private idleThreshold: number = 30; // 30 seconds
  private isIdle: boolean = false;
  private idleStartTime: Date | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private getWindow: () => BrowserWindow | null;
  private lastMeetingCheck: number = 0;
  private lastMeetingResult: boolean = false;
  private meetingCacheTtl: number = 60_000; // cache meeting check for 60s

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;
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

  private sendToWindow(channel: string, data?: any): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }

  private async check(): Promise<void> {
    const idleTime = powerMonitor.getSystemIdleTime();

    // If system reports idle, check if user is in a meeting or using a chat app
    if (idleTime >= this.idleThreshold) {
      // Check if a communication app has the foreground window
      // (user is reading/composing messages — not truly idle)
      const chatActive = await this.isChatAppInForeground();
      const remoteActive = !chatActive ? await this.isRemoteDesktopInForeground() : false;
      if (chatActive || remoteActive) {
        if (this.isIdle) {
          const endTime = new Date();
          const startTime = this.idleStartTime || new Date(Date.now() - this.idleThreshold * 1000);
          const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          const reason = chatActive ? 'Chat app' : 'Remote desktop/VPS';
          console.log(`[IdleDetector] ${reason} in foreground — cancelling idle (duration was ${duration}s)`);
          this.isIdle = false;
          this.sendToWindow('idle-resumed', {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration,
          });
          this.idleStartTime = null;
        }
        return;
      }

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
          this.sendToWindow('idle-resumed', {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration,
          });
          this.idleStartTime = null;
        }
        return;
      }
    }

    if (idleTime >= this.idleThreshold && !this.isIdle) {
      this.isIdle = true;
      this.idleStartTime = new Date(Date.now() - idleTime * 1000);
      console.log(`[IdleDetector] IDLE DETECTED — system idle for ${idleTime}s, start: ${this.idleStartTime.toISOString()}`);
      this.sendToWindow('idle-detected', {
        startTime: this.idleStartTime.toISOString(),
      });
    } else if (idleTime < this.idleThreshold && this.isIdle) {
      const endTime = new Date();
      const startTime = this.idleStartTime || new Date(Date.now() - this.idleThreshold * 1000);
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      console.log(`[IdleDetector] IDLE RESUMED — duration: ${duration}s, start: ${startTime.toISOString()}, end: ${endTime.toISOString()}`);

      this.isIdle = false;

      this.sendToWindow('idle-resumed', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
      });

      this.idleStartTime = null;
    }
  }

  /**
   * Checks if a communication/chat app currently has the foreground window.
   * If so, the user is likely reading or composing messages — not truly idle.
   */
  private async isChatAppInForeground(): Promise<boolean> {
    try {
      const apps = CHAT_APPS[process.platform] || [];
      if (apps.length === 0) return false;

      if (process.platform === 'win32') {
        // Get the foreground window process name via PowerShell
        const { stdout } = await execFileAsync('powershell', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class FG{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint pid);}';$h=[FG]::GetForegroundWindow();$pid=0;[FG]::GetWindowThreadProcessId($h,[ref]$pid)|Out-Null;(Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName`,
        ], { timeout: 3000 });

        const fgProcess = stdout.trim().toLowerCase();
        if (fgProcess && apps.some((app) => app.toLowerCase().replace('.exe', '') === fgProcess)) {
          console.log(`[IdleDetector] Chat app in foreground: ${fgProcess} — suppressing idle`);
          return true;
        }
      } else if (process.platform === 'darwin') {
        // Get the frontmost application name via AppleScript
        const { stdout } = await execFileAsync('osascript', [
          '-e', 'tell application "System Events" to get name of first application process whose frontmost is true',
        ], { timeout: 3000 });

        const fgApp = stdout.trim();
        if (fgApp && apps.some((app) => fgApp.includes(app))) {
          console.log(`[IdleDetector] Chat app in foreground: ${fgApp} — suppressing idle`);
          return true;
        }
      }
    } catch {
      // If foreground check fails, don't suppress idle
    }
    return false;
  }

  /**
   * Checks if a remote desktop / VPS / SSH client has the foreground window.
   * If so, the user is working on a remote machine — not truly idle locally.
   */
  private async isRemoteDesktopInForeground(): Promise<boolean> {
    try {
      const apps = REMOTE_DESKTOP_APPS[process.platform] || [];
      if (apps.length === 0) return false;

      if (process.platform === 'win32') {
        const { stdout } = await execFileAsync('powershell', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class FG{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint pid);}';$h=[FG]::GetForegroundWindow();$pid=0;[FG]::GetWindowThreadProcessId($h,[ref]$pid)|Out-Null;(Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName`,
        ], { timeout: 3000 });

        const fgProcess = stdout.trim().toLowerCase();
        if (fgProcess && apps.some((app) => app.toLowerCase().replace('.exe', '') === fgProcess)) {
          console.log(`[IdleDetector] Remote desktop app in foreground: ${fgProcess} — suppressing idle`);
          return true;
        }
      } else if (process.platform === 'darwin') {
        const { stdout } = await execFileAsync('osascript', [
          '-e', 'tell application "System Events" to get name of first application process whose frontmost is true',
        ], { timeout: 3000 });

        const fgApp = stdout.trim();
        if (fgApp && apps.some((app) => fgApp.includes(app))) {
          console.log(`[IdleDetector] Remote desktop app in foreground: ${fgApp} — suppressing idle`);
          return true;
        }
      }
    } catch {
      // If check fails, don't suppress idle
    }
    return false;
  }

  /**
   * Detects if the user is likely in a meeting by checking:
   * 1. macOS: microphone in use (via system profiler)
   * 2. Windows: microphone actually in use (via PowerShell audio capture check)
   */
  private async isInMeeting(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastMeetingCheck < this.meetingCacheTtl) {
      return this.lastMeetingResult;
    }
    try {
      let result = false;
      if (process.platform === 'darwin') {
        result = await this.isMicInUseMac();
      } else if (process.platform === 'win32') {
        result = await this.isMicInUseWindows();
      }
      this.lastMeetingCheck = now;
      this.lastMeetingResult = result;
      return result;
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
   * Windows: Check if the microphone is actually in use via PowerShell.
   * Only suppresses idle if an audio capture device is actively recording.
   */
  private async isMicInUseWindows(): Promise<boolean> {
    try {
      const psScript = `
        Get-CimInstance -Namespace 'root/cimv2/mdm/dmmap' -ClassName 'MDM_Policy_Result01_Privacy02' -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty LetAppsAccessMicrophone_ForceDenyTheseApps -ErrorAction SilentlyContinue;
        $mic = Get-PnpDevice -Class 'AudioEndpoint' -Status 'OK' -ErrorAction SilentlyContinue |
          Where-Object { $_.FriendlyName -match 'Microphone|Mic|Audio Input' };
        if (-not $mic) { Write-Output 'NO_MIC'; exit 0 }
        $sessions = Get-Process | Where-Object {
          try { $_.Modules | Where-Object { $_.ModuleName -match 'audioses|mmdevapi' } } catch {}
        } | Select-Object -ExpandProperty ProcessName -ErrorAction SilentlyContinue;
        if ($sessions) { Write-Output "ACTIVE:$($sessions -join ',')" } else { Write-Output 'INACTIVE' }
      `;

      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command', psScript,
      ], { timeout: 5000 });

      if (stdout.includes('ACTIVE:')) {
        console.log(`[IdleDetector] Microphone actively in use (Windows) — suppressing idle`);
        return true;
      }
    } catch {
      // If PowerShell check fails, don't suppress idle
    }
    return false;
  }
}
