const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onScorerProgress: (cb) => ipcRenderer.on('scorer:progress', (_e, pct) => cb(pct)),
  onScorerReady: (cb) => ipcRenderer.on('scorer:ready', () => cb()),
  getWorkspacePath: () => ipcRenderer.invoke('app:workspace-path'),
});
