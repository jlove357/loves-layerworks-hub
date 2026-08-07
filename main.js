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
const {
  selectProductionFile,
  copyProductionFile,
  cancelProductionFileCopy,
  openProductionFile,
  showProductionFile,
  deleteProductionFile,
  removeProjectProductionFolder
} = require('./production-file-service');
const {
  getProductionStorageStatus,
  checkProjectProductionFiles,
  verifyProductionLibrary,
  cancelProductionStorageOperation,
  relocateProductionStorage
} = require('./production-storage-service');
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

async function saveHubDataWithProjectCleanup(data) {
  const before = await loadHubData();
  const previousProjectIds = new Set(before?.ok ? before.data.projects.map((project) => project.id) : []);
  const saved = await persistHubData(data);
  const currentProjectIds = new Set(saved.projects.map((project) => project.id));
  const removedProjectIds = [...previousProjectIds].filter((projectId) => !currentProjectIds.has(projectId));

  for (const projectId of removedProjectIds) {
    try {
      await removeProjectProductionFolder(projectId);
    } catch (error) {
      console.warn(`Production folder cleanup failed for ${projectId}:`, error);
    }
  }

  return {
    ok: true,
    data: saved,
    path: hubPaths().dataFile,
    savedAt: saved.updatedAt,
    backups: await listValidBackups()
  };
}

app.whenReady().then(async () => {
  await ensureHubStructure();
  ipcMain.handle('hub:load-data', loadHubData);
  ipcMain.handle('hub:save-data', (_event, data) => saveHubDataWithProjectCleanup(data));
  ipcMain.handle('hub:data-status', dataStatus);
  ipcMain.handle('hub:select-swatch-image', selectSwatchImage);
  ipcMain.handle('hub:select-project-image', selectProjectImage);
  ipcMain.handle('hub:select-finished-image', selectFinishedImage);
  ipcMain.handle('hub:copy-swatch-image', copySwatchImage);
  ipcMain.handle('hub:copy-project-image', copyProjectImage);
  ipcMain.handle('hub:copy-finished-image', copyFinishedImage);
  ipcMain.handle('hub:read-managed-image', readManagedImage);
  ipcMain.handle('hub:delete-managed-image', deleteManagedImage);
  ipcMain.handle('hub:select-production-file', selectProductionFile);
  ipcMain.handle('hub:copy-production-file', copyProductionFile);
  ipcMain.handle('hub:cancel-production-file-copy', cancelProductionFileCopy);
  ipcMain.handle('hub:open-production-file', openProductionFile);
  ipcMain.handle('hub:show-production-file', showProductionFile);
  ipcMain.handle('hub:delete-production-file', deleteProductionFile);
  ipcMain.handle('hub:production-storage-status', getProductionStorageStatus);
  ipcMain.handle('hub:check-project-production-files', checkProjectProductionFiles);
  ipcMain.handle('hub:verify-production-library', verifyProductionLibrary);
  ipcMain.handle('hub:cancel-production-storage-operation', cancelProductionStorageOperation);
  ipcMain.handle('hub:relocate-production-storage', relocateProductionStorage);
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
