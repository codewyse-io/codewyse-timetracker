import { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu, net } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { IdleDetector } from './idle-detector';
import { createTray } from './tray';

import Store from 'electron-store';

// ── Single-instance lock ─────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const store = new Store();

// Remove the default menu bar entirely
Menu.setApplicationMenu(null);

// ── Global error handlers ────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let idleDetector: IdleDetector | null = null;
let isQuitting = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

// ── Main-process heartbeat (immune to App Nap) ──────────────────────
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://backend.codewyse.site';
const HEARTBEAT_INTERVAL_MS = 45_000; // 45 seconds

function startMainHeartbeat(): void {
  stopMainHeartbeat();
  const sendHeartbeat = () => {
    const token = store.get('authToken', null) as string | null;
    if (!token) return;

    const url = `${API_BASE_URL}/time-tracking/heartbeat`;
    const request = net.request({
      method: 'POST',
      url,
    });
    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('Content-Type', 'application/json');
    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data?.data?.ok === false || data?.ok === false) {
            console.log('[Heartbeat] Server returned ok: false — session may have been stopped');
            stopMainHeartbeat();
            mainWindow?.webContents.send('session-force-stopped');
          }
        } catch { /* ignore parse errors */ }
      });
    });
    request.on('error', (err) => {
      console.log(`[Heartbeat] Error: ${err.message}`);
    });
    request.end();
  };

  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  console.log('[Heartbeat] Started main-process heartbeat');
}

function stopMainHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('[Heartbeat] Stopped main-process heartbeat');
  }
}

const isDev = !app.isPackaged;

// In dev: <project>/dist/main/main.js → ../../build/icon.ico
// In prod (asar): <app>/dist/main/main.js → resolve via app path
const appRoot = isDev ? path.join(__dirname, '..', '..') : path.join(app.getAppPath());
const iconPath = path.join(appRoot, 'build', 'icon.ico');

// ── Auto-updater setup ──────────────────────────────────────────────
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (error) => {
    mainWindow?.webContents.send('update-error', error?.message || 'Update failed');
  });

  // Check for updates every 30 minutes
  if (!isDev) {
    autoUpdater.checkForUpdates().catch(() => {});
    updateCheckInterval = setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 30 * 60 * 1000);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,
    title: 'Pulse',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers(): void {
  ipcMain.handle('get-idle-time', () => {
    return powerMonitor.getSystemIdleTime();
  });

  ipcMain.handle('get-auth-token', () => {
    return store.get('authToken', null);
  });

  ipcMain.handle('set-auth-token', (_event: any, token: string) => {
    store.set('authToken', token);
  });

  ipcMain.handle('clear-auth-token', () => {
    store.delete('authToken');
  });

  ipcMain.handle('set-idle-threshold', (_event: any, seconds: number) => {
    if (idleDetector) {
      idleDetector.setThreshold(seconds);
    }
  });

  ipcMain.handle('start-idle-detection', () => {
    if (idleDetector) {
      idleDetector.start();
    }
  });

  ipcMain.handle('stop-idle-detection', () => {
    if (idleDetector) {
      idleDetector.stop();
    }
  });

  // Auto-update IPC
  ipcMain.handle('check-for-updates', () => {
    if (!isDev) {
      return autoUpdater.checkForUpdates().catch(() => null);
    }
    return null;
  });

  ipcMain.handle('download-update', () => {
    return autoUpdater.downloadUpdate().catch(() => null);
  });

  ipcMain.handle('install-update', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Main-process heartbeat IPC
  ipcMain.handle('start-heartbeat', () => {
    startMainHeartbeat();
  });

  ipcMain.handle('stop-heartbeat', () => {
    stopMainHeartbeat();
  });

  ipcMain.on('minimize-to-tray', () => {
    mainWindow?.hide();
  });

  ipcMain.on('quit-app', () => {
    isQuitting = true;
    app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  setupAutoUpdater();

  const getMainWindow = () => mainWindow;

  tray = createTray(getMainWindow);

  idleDetector = new IdleDetector(getMainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// ── Single-instance: focus existing window when second instance launches ──
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopMainHeartbeat();
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  if (idleDetector) {
    idleDetector.stop();
  }
});
