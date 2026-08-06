const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('layerWorks', {
  appName: "Love's LayerWorks Hub",
  milestone: 'M1A',
  loadData: () => ipcRenderer.invoke('hub:load-data'),
  saveData: (data) => ipcRenderer.invoke('hub:save-data', data),
  dataPath: () => ipcRenderer.invoke('hub:data-path')
});
