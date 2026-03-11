import { BrowserWindow, powerMonitor } from 'electron';

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

  private check(): void {
    const idleTime = powerMonitor.getSystemIdleTime();

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
}
