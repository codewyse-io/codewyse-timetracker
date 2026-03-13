import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getIdleTime: (): Promise<number> => ipcRenderer.invoke('get-idle-time'),
  getAuthToken: (): Promise<string | null> => ipcRenderer.invoke('get-auth-token'),
  setAuthToken: (token: string): Promise<void> => ipcRenderer.invoke('set-auth-token', token),
  clearAuthToken: (): Promise<void> => ipcRenderer.invoke('clear-auth-token'),
  setIdleThreshold: (seconds: number): Promise<void> => ipcRenderer.invoke('set-idle-threshold', seconds),
  startIdleDetection: (): Promise<void> => ipcRenderer.invoke('start-idle-detection'),
  stopIdleDetection: (): Promise<void> => ipcRenderer.invoke('stop-idle-detection'),
  minimizeToTray: (): void => ipcRenderer.send('minimize-to-tray'),
  quitApp: (): void => ipcRenderer.send('quit-app'),
  onIdleDetected: (callback: (data: { startTime: string }) => void): void => {
    ipcRenderer.on('idle-detected', (_event, data) => callback(data));
  },
  onIdleResumed: (callback: (data: { startTime: string; endTime: string; duration: number }) => void): void => {
    ipcRenderer.on('idle-resumed', (_event, data) => callback(data));
  },

  // Auto-update APIs
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<any> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void): void => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback: () => void): void => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void): void => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', () => callback());
  },
  onUpdateError: (callback: (message: string) => void): void => {
    ipcRenderer.on('update-error', (_event, message) => callback(message));
  },
});
