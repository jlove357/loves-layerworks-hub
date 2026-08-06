const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('layerWorks', {
  appName: "Love's LayerWorks Hub",
  milestone: 'M1B',
  loadData: () => ipcRenderer.invoke('hub:load-data'),
  saveData: (data) => ipcRenderer.invoke('hub:save-data', data),
  dataStatus: () => ipcRenderer.invoke('hub:data-status'),
  selectSwatchImage: () => ipcRenderer.invoke('hub:select-swatch-image'),
  copySwatchImage: (request) => ipcRenderer.invoke('hub:copy-swatch-image', request),
  readManagedImage: (relativePath) => ipcRenderer.invoke('hub:read-managed-image', relativePath),
  deleteManagedImage: (relativePath) => ipcRenderer.invoke('hub:delete-managed-image', relativePath),
  exportInventory: () => ipcRenderer.invoke('hub:export-inventory'),
  importInventory: () => ipcRenderer.invoke('hub:import-inventory'),
  listBackups: () => ipcRenderer.invoke('hub:list-backups'),
  restoreBackup: (fileName) => ipcRenderer.invoke('hub:restore-backup', fileName),
  exportFullBackup: () => ipcRenderer.invoke('hub:export-full-backup')
});
