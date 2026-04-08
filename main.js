const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const portfinder = require('portfinder');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let expressServer = null;

// ── Splash screen ──────────────────────────────────────────
// Shows instantly on click — orbit logo spins while app loads.

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'static', 'splash.html'));
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ── First-launch workspace migration ──────────────────────
// Copies ./workspaces (bundled with installer) → userData/workspaces
// Only runs once (guarded by .migrated sentinel file).

function migrateWorkspacesIfNeeded() {
  if (isDev) return; // dev always uses ./workspaces directly

  const userData = app.getPath('userData');
  const sentinel = path.join(userData, '.migrated');
  if (fs.existsSync(sentinel)) return;

  const src = path.join(process.resourcesPath, 'app', 'workspaces');
  const dest = path.join(userData, 'workspaces');

  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    try {
      fs.cpSync(src, dest, { recursive: true });
    } catch (e) {
      console.error('Workspace migration failed:', e.message);
    }
  } else if (!fs.existsSync(dest)) {
    // No source workspaces to copy — create empty structure
    fs.mkdirSync(path.join(dest, '_global', 'test-cases'), { recursive: true });
  }

  fs.writeFileSync(sentinel, new Date().toISOString());
}

// ── Server startup ─────────────────────────────────────────

async function startExpress() {
  // Pre-require heavy modules in parallel with port scan
  const [port] = await Promise.all([
    portfinder.getPortPromise({ port: 8000, stopPort: 9000 }),
    // Warm up require cache for large modules so first API call is fast
    Promise.resolve().then(() => { try { require('js-yaml'); require('simple-git'); } catch {} }),
  ]);
  const createApp = require('./src/server');
  const expressApp = createApp();

  return new Promise((resolve, reject) => {
    expressServer = expressApp.listen(port, '127.0.0.1', () => resolve(port));
    expressServer.on('error', reject);
  });
}

// ── Window ─────────────────────────────────────────────────

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Continuous.Testing',
    show: false,
    backgroundColor: '#f5f6fa',
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC handlers ───────────────────────────────────────────

ipcMain.handle('app:workspace-path', () => {
  const { getWorkspacesDirectory } = require('./src/workspace');
  return getWorkspacesDirectory();
});

ipcMain.handle('settings:get', () => {
  return require('./src/settings').load();
});

ipcMain.handle('settings:set', (_e, data) => {
  return require('./src/settings').save(data);
});

ipcMain.handle('dialog:open-folder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Workspaces Directory',
    buttonLabel: 'Select Folder',
    message: 'Choose the workspaces/ folder inside your git repo',
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── Scorer warm-up ────────────────────────────────────────

function warmUpScorer() {
  const scorer = require('./src/scorer');
  scorer.init((pct) => {
    if (mainWindow) mainWindow.webContents.send('scorer:progress', pct);
  }).then(() => {
    if (mainWindow) mainWindow.webContents.send('scorer:ready');
  }).catch(() => {
    // Scorer warm-up failed — keyword fallback remains active, no UI update needed
  });
}

// ── App lifecycle ──────────────────────────────────────────

app.whenReady().then(async () => {
  // Show splash immediately — user sees something < 200ms after click
  createSplash();
  migrateWorkspacesIfNeeded();

  try {
    const port = await startExpress();
    createWindow(port);

    // Close splash once main window is ready to show
    mainWindow.once('ready-to-show', () => {
      closeSplash();
      mainWindow.show();
      if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    closeSplash();
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && expressServer) {
      const addr = expressServer.address();
      if (addr) createWindow(addr.port);
    }
  });
});

app.on('window-all-closed', () => {
  if (expressServer) expressServer.close();
  if (process.platform !== 'darwin') app.quit();
});

// ── Auto-updater ──────────────────────────────────────────────
// Disabled in dev. In production, reads updateChannel from settings:
//   'latest' → stable releases only (default)
//   'beta'   → beta + stable releases (dev branch builds)
if (app.isPackaged) {
  const { autoUpdater } = require('electron-updater');
  const settings = require('./src/settings');
  const channel = settings.load().updateChannel || 'latest';
  autoUpdater.channel = channel;
  autoUpdater.allowPrerelease = channel === 'beta';
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify();
}
