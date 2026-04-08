const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Scorer
  onScorerProgress: (cb) => ipcRenderer.on('scorer:progress', (_e, pct) => cb(pct)),
  onScorerReady:    (cb) => ipcRenderer.on('scorer:ready', () => cb()),

  // Workspace path (current resolved path)
  getWorkspacePath: () => ipcRenderer.invoke('app:workspace-path'),

  // Settings
  getSettings:    ()     => ipcRenderer.invoke('settings:get'),
  saveSettings:   (data) => ipcRenderer.invoke('settings:set', data),

  // Native folder picker
  openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),
});
