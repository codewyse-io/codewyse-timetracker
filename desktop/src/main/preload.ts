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
  onIdleDetected: (callback: (data: { startTime: string }) => void): (() => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('idle-detected', handler);
    return () => ipcRenderer.removeListener('idle-detected', handler);
  },
  onIdleResumed: (callback: (data: { startTime: string; endTime: string; duration: number }) => void): (() => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('idle-resumed', handler);
    return () => ipcRenderer.removeListener('idle-resumed', handler);
  },

  // Auto-update APIs
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<any> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  requestMediaAccess: (mediaType: 'microphone' | 'camera'): Promise<string> => ipcRenderer.invoke('request-media-access', mediaType),
  getMediaAccessStatus: (mediaType: 'microphone' | 'camera' | 'screen'): Promise<string> => ipcRenderer.invoke('get-media-access-status', mediaType),
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void): (() => void) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void): (() => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateDownloaded: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback: (message: string) => void): (() => void) => {
    const handler = (_event: any, message: any) => callback(message);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },

  // Main-process heartbeat
  startHeartbeat: (): Promise<void> => ipcRenderer.invoke('start-heartbeat'),
  stopHeartbeat: (): Promise<void> => ipcRenderer.invoke('stop-heartbeat'),
  onSessionForceStopped: (callback: (reason?: string) => void): (() => void) => {
    const handler = (_event: any, reason?: string) => callback(reason);
    ipcRenderer.on('session-force-stopped', handler);
    return () => ipcRenderer.removeListener('session-force-stopped', handler);
  },

  // Screen sharing & call notifications
  getDesktopSources: (): Promise<Array<{ id: string; name: string; thumbnail: string }>> =>
    ipcRenderer.invoke('get-desktop-sources'),
  selectScreenSource: (sourceId: string): Promise<boolean> =>
    ipcRenderer.invoke('select-screen-source', sourceId),
  isWindowVisible: (): Promise<boolean> => ipcRenderer.invoke('is-window-visible'),
  showCallNotification: (callerName: string): void =>
    ipcRenderer.send('show-call-notification', callerName),

  // Call detach/attach
  detachCallWindow: (): Promise<void> => ipcRenderer.invoke('detach-call-window'),
  attachCallWindow: (): Promise<void> => ipcRenderer.invoke('attach-call-window'),
  onCallDetached: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('call-detached', handler);
    return () => ipcRenderer.removeListener('call-detached', handler);
  },
  onCallAttached: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('call-attached', handler);
    return () => ipcRenderer.removeListener('call-attached', handler);
  },
});
