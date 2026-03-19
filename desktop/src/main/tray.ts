import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  const appRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..', '..');
  const iconPath = path.join(appRoot, 'build', 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  const tray = new Tray(icon);
  tray.setToolTip('Pulse');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Pulse',
      click: () => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.show();
          win.focus();
        }
      },
    },
    {
      label: 'Activate Pulse',
      click: () => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('tray-start-timer');
        }
      },
    },
    {
      label: 'End Session',
      click: () => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('tray-stop-timer');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}
