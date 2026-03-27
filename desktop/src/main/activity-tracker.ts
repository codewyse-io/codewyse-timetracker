import { powerMonitor } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Browser process names — for these, we extract the domain from the window title
const BROWSER_PROCESSES: Record<string, string[]> = {
  win32: ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc', 'iexplore', 'safari'],
  darwin: ['Google Chrome', 'Safari', 'Firefox', 'Microsoft Edge', 'Brave Browser', 'Arc', 'Opera', 'Vivaldi'],
};

export interface ActivitySnapshot {
  appName: string;
  windowInfo: string; // domain for browsers, sanitized app name for others
  timestamp: string; // ISO 8601
  durationSeconds: number;
}

export class ActivityTracker {
  private pollInterval = 30_000; // 30 seconds
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private buffer: ActivitySnapshot[] = [];
  private lastApp = '';
  private lastWindowInfo = '';
  private lastTimestamp = '';

  start(): void {
    if (this.intervalId) this.stop();
    this.buffer = [];
    this.lastApp = '';
    this.lastWindowInfo = '';
    this.lastTimestamp = '';
    this.intervalId = setInterval(() => this.poll(), this.pollInterval);
    // Immediate first poll
    this.poll();
    console.log('[ActivityTracker] Started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[ActivityTracker] Stopped');
  }

  /** Return buffered snapshots and clear the buffer */
  flush(): ActivitySnapshot[] {
    const result = [...this.buffer];
    this.buffer = [];
    return result;
  }

  /** Cap buffer size to prevent unbounded growth (e.g., when heartbeat isn't calling flush) */
  private capBuffer(): void {
    const MAX_BUFFER = 100; // ~50 minutes of data at 30s intervals
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer = this.buffer.slice(-MAX_BUFFER);
    }
  }

  private async poll(): Promise<void> {
    try {
      const idleTime = powerMonitor.getSystemIdleTime();
      // If system is idle > 60s, don't record activity (the idle detector handles this)
      if (idleTime > 60) return;

      const { appName, windowTitle } = await this.getForegroundApp();
      if (!appName) return;

      const windowInfo = this.sanitizeWindowInfo(appName, windowTitle);
      const now = new Date().toISOString();

      // Deduplicate: if same app + windowInfo, extend the last snapshot
      if (
        this.buffer.length > 0 &&
        this.lastApp === appName &&
        this.lastWindowInfo === windowInfo
      ) {
        this.buffer[this.buffer.length - 1].durationSeconds += this.pollInterval / 1000;
        return;
      }

      this.buffer.push({
        appName,
        windowInfo,
        timestamp: now,
        durationSeconds: this.pollInterval / 1000,
      });

      this.lastApp = appName;
      this.lastWindowInfo = windowInfo;
      this.lastTimestamp = now;

      this.capBuffer();
    } catch (err) {
      // Silent — don't crash for tracking failures
    }
  }

  private async getForegroundApp(): Promise<{ appName: string; windowTitle: string }> {
    try {
      if (process.platform === 'win32') {
        return await this.getForegroundWindows();
      } else if (process.platform === 'darwin') {
        return await this.getForegroundMac();
      }
    } catch {
      // silent
    }
    return { appName: '', windowTitle: '' };
  }

  private async getForegroundWindows(): Promise<{ appName: string; windowTitle: string }> {
    // PowerShell: get foreground process name and window title
    // Uses Add-Type with -TypeDefinition (single-line safe, no here-strings)
    const csharp = 'using System; using System.Runtime.InteropServices; using System.Text; public class FGW { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid); [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count); }';
    const script = `Add-Type -TypeDefinition '${csharp}' -ErrorAction SilentlyContinue; $h=[FGW]::GetForegroundWindow(); $pid=0; [FGW]::GetWindowThreadProcessId($h,[ref]$pid)|Out-Null; $sb=New-Object System.Text.StringBuilder 512; [FGW]::GetWindowText($h,$sb,512)|Out-Null; $p=(Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName; Write-Output "$p|$($sb.ToString())"`;

    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', script,
    ], { timeout: 5000 });

    const parts = stdout.trim().split('|');
    return {
      appName: (parts[0] || '').trim(),
      windowTitle: (parts.slice(1).join('|') || '').trim(),
    };
  }

  private async getForegroundMac(): Promise<{ appName: string; windowTitle: string }> {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      `tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set appName to name of frontApp
        set winTitle to ""
        try
          set winTitle to name of front window of frontApp
        end try
        return appName & "|" & winTitle
      end tell`,
    ], { timeout: 5000 });

    const parts = stdout.trim().split('|');
    return {
      appName: (parts[0] || '').trim(),
      windowTitle: (parts.slice(1).join('|') || '').trim(),
    };
  }

  /**
   * Privacy-safe sanitization of window info:
   * - For browsers: extract only the domain from the window title
   * - For other apps: return just the app name (no document names)
   */
  private sanitizeWindowInfo(appName: string, windowTitle: string): string {
    const lowerApp = appName.toLowerCase();
    const browsers = BROWSER_PROCESSES[process.platform] || [];

    const isBrowser = browsers.some((b) => lowerApp.includes(b.toLowerCase()));

    if (isBrowser && windowTitle) {
      return this.extractDomain(windowTitle);
    }

    // For non-browser apps, return the app name only (no document names for privacy)
    return appName;
  }

  /**
   * Extract domain from a browser window title.
   * Common patterns:
   * - "Page Title - domain.com - Google Chrome"
   * - "domain.com - Page Title — Mozilla Firefox"
   * - "Page Title"
   */
  private extractDomain(windowTitle: string): string {
    // Split by common separators
    const parts = windowTitle.split(/\s[-—–|]\s/);

    for (const part of parts) {
      const trimmed = part.trim();
      // Check if this looks like a domain (contains a dot, no spaces, reasonable length)
      if (
        trimmed.includes('.') &&
        !trimmed.includes(' ') &&
        trimmed.length < 100 &&
        /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
      ) {
        return trimmed.toLowerCase();
      }
    }

    // Fallback: return "browser" if no domain found
    return 'browser';
  }
}
