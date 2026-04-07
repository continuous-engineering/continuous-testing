const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const portfinder = require('portfinder');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let expressServer = null;

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
    title: 'Agent Test Manager',
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
