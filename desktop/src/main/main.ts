import { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu } from 'electron';
import * as path from 'path';
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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: false,
    autoHideMenuBar: true,
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
