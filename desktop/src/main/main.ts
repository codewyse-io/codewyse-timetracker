import { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { IdleDetector } from './idle-detector';
import { createTray } from './tray';

import Store from 'electron-store';

const store = new Store();

// Remove the default menu bar entirely
Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let idleDetector: IdleDetector | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

// In dev: <project>/dist/main/main.js → ../../build/icon.ico
// In prod (asar): <app>/dist/main/main.js → resolve via app path
const appRoot = isDev ? path.join(__dirname, '..', '..') : path.join(app.getAppPath());
const iconPath = path.join(appRoot, 'build', 'icon.ico');

// ── Auto-updater setup ──────────────────────────────────────────────
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
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
    setInterval(() => {
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
    if (!isQuitting) {
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

  tray = createTray(mainWindow!);

  idleDetector = new IdleDetector(mainWindow!);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (idleDetector) {
    idleDetector.stop();
  }
});
