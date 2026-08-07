const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const { hubPaths, ensureHubStructure } = require('./hub-config');
const { listValidBackups, persistHubData, loadHubData } = require('./hub-persistence');
const {
  selectSwatchImage,
  selectProjectImage,
  selectFinishedImage,
  copySwatchImage,
  copyProjectImage,
  copyFinishedImage,
  readManagedImage,
  deleteManagedImage
} = require('./image-service');
const { saveGalleryExport, revealGalleryExport } = require('./gallery-export-service');
const { exportInventory, importInventory } = require('./inventory-transfer');
const { dataStatus, restoreBackup, exportFullBackup } = require('./backup-service');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    title: "Love's LayerWorks Hub",
    backgroundColor: '#0b0812',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile('index.html');
}

app.whenReady().then(async () => {
  await ensureHubStructure();
  ipcMain.handle('hub:load-data', loadHubData);
  ipcMain.handle('hub:save-data', (_event, data) => persistHubData(data).then(async (saved) => ({
    ok: true,
    data: saved,
    path: hubPaths().dataFile,
    savedAt: saved.updatedAt,
    backups: await listValidBackups()
  })));
  ipcMain.handle('hub:data-status', dataStatus);
  ipcMain.handle('hub:select-swatch-image', selectSwatchImage);
  ipcMain.handle('hub:select-project-image', selectProjectImage);
  ipcMain.handle('hub:select-finished-image', selectFinishedImage);
  ipcMain.handle('hub:copy-swatch-image', copySwatchImage);
  ipcMain.handle('hub:copy-project-image', copyProjectImage);
  ipcMain.handle('hub:copy-finished-image', copyFinishedImage);
  ipcMain.handle('hub:read-managed-image', readManagedImage);
  ipcMain.handle('hub:delete-managed-image', deleteManagedImage);
  ipcMain.handle('hub:save-gallery-export', saveGalleryExport);
  ipcMain.handle('hub:reveal-gallery-export', revealGalleryExport);
  ipcMain.handle('hub:copy-text', (_event, value) => {
    const text = String(value ?? '');
    if (!text.trim()) throw new Error('Clipboard text cannot be blank.');
    if (text.length > 20_000) throw new Error('Clipboard text is too long.');
    clipboard.writeText(text);
    return { ok: true };
  });
  ipcMain.handle('hub:export-inventory', exportInventory);
  ipcMain.handle('hub:import-inventory', importInventory);
  ipcMain.handle('hub:list-backups', listValidBackups);
  ipcMain.handle('hub:restore-backup', restoreBackup);
  ipcMain.handle('hub:export-full-backup', exportFullBackup);

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
