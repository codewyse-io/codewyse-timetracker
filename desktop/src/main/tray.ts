import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';

export function createTray(mainWindow: BrowserWindow): Tray {
  const appRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..', '..');
  const iconPath = path.join(appRoot, 'build', 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  const tray = new Tray(icon);
  tray.setToolTip('Pulse');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Pulse',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Activate Pulse',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray-start-timer');
        }
      },
    },
    {
      label: 'End Session',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray-stop-timer');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}
