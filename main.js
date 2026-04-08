const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const portfinder = require('portfinder');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let expressServer = null;

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
  const port = await portfinder.getPortPromise({ port: 8000, stopPort: 9000 });
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC handlers ───────────────────────────────────────────

ipcMain.handle('app:workspace-path', () => {
  const { getWorkspacesDirectory } = require('./src/workspace');
  return getWorkspacesDirectory();
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
  migrateWorkspacesIfNeeded();
  try {
    const port = await startExpress();
    createWindow(port);
    // Warm up scorer after window is shown so it doesn't block startup
    mainWindow.once('ready-to-show', () => warmUpScorer());
  } catch (err) {
    console.error('Failed to start server:', err);
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

// ── Auto-updater (stub — activate when release feed is live) ──
// Uncomment when publish.url in package.json points to a real feed:
//
// const { autoUpdater } = require('electron-updater');
// autoUpdater.logger = require('electron').nativeTheme; // swap for a real logger
// autoUpdater.checkForUpdatesAndNotify();
