import { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu, net, desktopCapturer, session } from 'electron';
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
let callWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let idleDetector: IdleDetector | null = null;
let isQuitting = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;
let pendingScreenSourceId: string | null = null;

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
          const payload = data?.data ?? data;
          if (payload?.ok === false) {
            const reason = payload.reason || 'unknown';
            console.log(`[Heartbeat] Server returned ok: false (reason: ${reason}) — session stopped`);
            stopMainHeartbeat();
            mainWindow?.webContents.send('session-force-stopped', reason);
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
    width: 1400,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,
    title: 'Pulse',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Open DevTools with F12 or Ctrl+Shift+I (works in both dev and production)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (
      input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    ) {
      mainWindow?.webContents.toggleDevTools();
    }
  });

  // Prevent navigation hijacking
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow navigation to the app's own URLs
    if (!url.startsWith('http://localhost:5174') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('close', (event) => {
    if (!isQuitting && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ── Screen sharing: setDisplayMediaRequestHandler (Electron 17+) ──
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sourceId = pendingScreenSourceId || 'screen:0:0';
      pendingScreenSourceId = null;

      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
      });

      const source = sources.find((s) => s.id === sourceId) || sources[0];
      if (source) {
        callback({ video: source, audio: 'loopback' });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('[ScreenShare] setDisplayMediaRequestHandler error:', err);
      callback({});
    }
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
    // isSilent=true: install without showing NSIS UI (prevents deadlock)
    // isForceRunAfter=true: relaunch app after install completes
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
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

  // ── Screen sharing / Call IPC ────────────────────────────────────────
  ipcMain.handle('get-desktop-sources', async () => {
    // Try with thumbnails first, fall back to no thumbnails if WGC fails
    for (const thumbSize of [{ width: 240, height: 135 }, { width: 0, height: 0 }]) {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: thumbSize,
        });
        if (sources.length > 0) {
          return sources.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: thumbSize.width > 0 && s.thumbnail && !s.thumbnail.isEmpty()
              ? s.thumbnail.toDataURL()
              : '',
          }));
        }
      } catch (err) {
        console.error('[DesktopCapturer] Attempt failed, trying fallback:', err);
      }
    }
    // Ultimate fallback — always give at least one option
    return [{ id: 'screen:0:0', name: 'Entire Screen', thumbnail: '' }];
  });

  // Store the selected screen source ID before getDisplayMedia is called
  ipcMain.handle('select-screen-source', (_event, sourceId: string) => {
    pendingScreenSourceId = sourceId;
    return true;
  });

  ipcMain.handle('is-window-visible', () => {
    return mainWindow?.isVisible() ?? false;
  });

  ipcMain.on('show-call-notification', (_event: any, callerName: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      if (process.platform === 'win32') {
        mainWindow.flashFrame(true);
      }
    }
  });

  // ── Detach / Attach call window ──────────────────────────────────────
  ipcMain.handle('detach-call-window', () => {
    if (callWindow && !callWindow.isDestroyed()) {
      callWindow.focus();
      return;
    }

    const { screen } = require('electron');
    const display = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = display.workAreaSize;

    callWindow = new BrowserWindow({
      width: 320,
      height: 480,
      x: screenW - 340,
      y: screenH - 500,
      minWidth: 260,
      minHeight: 380,
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: false,
      icon: iconPath,
      title: 'Pulse — Call',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    // Load the same app with a hash flag so the renderer knows it's detached
    if (isDev) {
      callWindow.loadURL('http://localhost:5174#/call-detached');
    } else {
      callWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), { hash: '/call-detached' });
    }

    // Prevent navigation hijacking on call window
    callWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost:5174') && !url.startsWith('file://')) {
        event.preventDefault();
      }
    });

    // Prevent new window creation from call window
    callWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Tell the main window that call was detached
    mainWindow?.webContents.send('call-detached');

    callWindow.on('closed', () => {
      callWindow = null;
      // Tell main window to re-attach
      mainWindow?.webContents.send('call-attached');
    });
  });

  ipcMain.handle('attach-call-window', () => {
    if (callWindow && !callWindow.isDestroyed()) {
      callWindow.close();
      callWindow = null;
    }
    mainWindow?.webContents.send('call-attached');
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
