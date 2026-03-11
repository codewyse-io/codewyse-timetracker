import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';

export function createTray(mainWindow: BrowserWindow): Tray {
  // Create a simple 16x16 icon programmatically (a blue circle)
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
      'gElEQVR42mNkYPj/n4EBCJgYGBhANDYMYkA2gJGRkQHEBgFk' +
      'DSAaZgDIIBAbpgmkAWQIyBCQBhANcwFIA8gQkCEgDSAaZACy' +
      'BpAhIA0gGmQASDNIA8gFIENAGkA0yACQZpAGkAtAhoBcAKJB' +
      'BqC4AKQBRAMNAGkGaQC5AOQCEBsAAN4wMhFjnEHyAAAAAElF' +
      'TkSuQmCC',
      'base64'
    )
  );

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
