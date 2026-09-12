const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('layerWorks', {
  appName: "Love's LayerWorks Hub",
  milestone: 'V2.1 PF3',
  loadData: () => ipcRenderer.invoke('hub:load-data'),
  saveData: (data) => ipcRenderer.invoke('hub:save-data', data),
  dataStatus: () => ipcRenderer.invoke('hub:data-status'),
  selectSwatchImage: () => ipcRenderer.invoke('hub:select-swatch-image'),
  selectProjectImage: () => ipcRenderer.invoke('hub:select-project-image'),
  selectFinishedImage: () => ipcRenderer.invoke('hub:select-finished-image'),
  copySwatchImage: (request) => ipcRenderer.invoke('hub:copy-swatch-image', request),
  copyProjectImage: (request) => ipcRenderer.invoke('hub:copy-project-image', request),
  copyExistingProjectImage: (request) => ipcRenderer.invoke('hub:copy-existing-project-image', request),
  copyFinishedImage: (request) => ipcRenderer.invoke('hub:copy-finished-image', request),
  readManagedImage: (relativePath) => ipcRenderer.invoke('hub:read-managed-image', relativePath),
  deleteManagedImage: (relativePath) => ipcRenderer.invoke('hub:delete-managed-image', relativePath),
  selectProductionFile: () => ipcRenderer.invoke('hub:select-production-file'),
  copyProductionFile: (request) => ipcRenderer.invoke('hub:copy-production-file', request),
  copyExistingProductionFile: (request) => ipcRenderer.invoke('hub:copy-existing-production-file', request),
  cancelProductionFileCopy: (copyId) => ipcRenderer.invoke('hub:cancel-production-file-copy', copyId),
  openProductionFile: (relativePath) => ipcRenderer.invoke('hub:open-production-file', relativePath),
  showProductionFile: (relativePath) => ipcRenderer.invoke('hub:show-production-file', relativePath),
  deleteProductionFile: (relativePath) => ipcRenderer.invoke('hub:delete-production-file', relativePath),
  productionStorageStatus: () => ipcRenderer.invoke('hub:production-storage-status'),
  checkProjectProductionFiles: (projectId) => ipcRenderer.invoke('hub:check-project-production-files', projectId),
  verifyProductionLibrary: () => ipcRenderer.invoke('hub:verify-production-library'),
  cancelProductionStorageOperation: (operationId) => ipcRenderer.invoke('hub:cancel-production-storage-operation', operationId),
  relocateProductionStorage: (mode) => ipcRenderer.invoke('hub:relocate-production-storage', mode),
  onProductionFileProgress: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('hub:production-file-progress', (_event, payload) => callback(payload));
  },
  onProductionIntegrityProgress: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('hub:production-integrity-progress', (_event, payload) => callback(payload));
  },
  onProductionStorageProgress: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('hub:production-storage-progress', (_event, payload) => callback(payload));
  },
  saveGalleryExport: (request) => ipcRenderer.invoke('hub:save-gallery-export', request),
  revealGalleryExport: (relativePath) => ipcRenderer.invoke('hub:reveal-gallery-export', relativePath),
  copyText: (text) => ipcRenderer.invoke('hub:copy-text', text),
  exportInventory: () => ipcRenderer.invoke('hub:export-inventory'),
  importInventory: () => ipcRenderer.invoke('hub:import-inventory'),
  listBackups: () => ipcRenderer.invoke('hub:list-backups'),
  restoreBackup: (fileName) => ipcRenderer.invoke('hub:restore-backup', fileName),
  exportFullBackup: () => ipcRenderer.invoke('hub:export-full-backup')
});
