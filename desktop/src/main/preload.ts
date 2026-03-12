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
});
