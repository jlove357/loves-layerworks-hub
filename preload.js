const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('layerWorks', {
  appName: "Love's LayerWorks Hub",
  milestone: 'V2',
  loadData: () => ipcRenderer.invoke('hub:load-data'),
  saveData: (data) => ipcRenderer.invoke('hub:save-data', data),
  dataStatus: () => ipcRenderer.invoke('hub:data-status'),
  selectSwatchImage: () => ipcRenderer.invoke('hub:select-swatch-image'),
  selectProjectImage: () => ipcRenderer.invoke('hub:select-project-image'),
  selectFinishedImage: () => ipcRenderer.invoke('hub:select-finished-image'),
  copySwatchImage: (request) => ipcRenderer.invoke('hub:copy-swatch-image', request),
  copyProjectImage: (request) => ipcRenderer.invoke('hub:copy-project-image', request),
  copyFinishedImage: (request) => ipcRenderer.invoke('hub:copy-finished-image', request),
  readManagedImage: (relativePath) => ipcRenderer.invoke('hub:read-managed-image', relativePath),
  deleteManagedImage: (relativePath) => ipcRenderer.invoke('hub:delete-managed-image', relativePath),
  saveGalleryExport: (request) => ipcRenderer.invoke('hub:save-gallery-export', request),
  revealGalleryExport: (relativePath) => ipcRenderer.invoke('hub:reveal-gallery-export', relativePath),
  copyText: (text) => ipcRenderer.invoke('hub:copy-text', text),
  exportInventory: () => ipcRenderer.invoke('hub:export-inventory'),
  importInventory: () => ipcRenderer.invoke('hub:import-inventory'),
  listBackups: () => ipcRenderer.invoke('hub:list-backups'),
  restoreBackup: (fileName) => ipcRenderer.invoke('hub:restore-backup', fileName),
  exportFullBackup: () => ipcRenderer.invoke('hub:export-full-backup')
});
