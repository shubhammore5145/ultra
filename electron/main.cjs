const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Prevent multiple instances of MartGPT running at the same time
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
const PORT = process.env.PORT || 5000;

// Setup persistent & writable SQLite directory in user's AppData
function setupDataDirectory() {
  try {
    const userDataPath = app.getPath('userData');
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const targetDb = path.join(dataDir, 'kirana.db');
    if (!fs.existsSync(targetDb)) {
      // Look for bundled template database
      const candidates = [
        path.join(process.resourcesPath || '', 'backend', 'data', 'kirana.db'),
        path.join(__dirname, '..', 'backend', 'data', 'kirana.db'),
        path.join(process.cwd(), 'backend', 'data', 'kirana.db')
      ];
      for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
          fs.copyFileSync(candidate, targetDb);
          console.log('Seeded database from:', candidate);
          break;
        }
      }
    }

    process.env.MARTGPT_DATA_DIR = dataDir;
    console.log('MartGPT SQLite database directory configured:', dataDir);
  } catch (err) {
    console.error('Failed to configure data directory:', err);
  }
}

// Start embedded Express backend server
function startBackendServer() {
  try {
    setupDataDirectory();
    process.env.NODE_ENV = 'production';
    process.env.PORT = String(PORT);
    // Start backend server inside Node runtime
    require('../backend/server.js');
    console.log('Backend server started successfully on port', PORT);
  } catch (err) {
    console.error('Failed to initialize backend server:', err);
    dialog.showErrorBox('MartGPT Startup Error', 'Could not initialize backend server: ' + err.message);
  }
}

// Wait until backend HTTP port is responding
function waitForServer(port, timeoutMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        // Fallback: even if ping timed out, continue loading
        resolve(false);
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 650,
    title: 'MartGPT - AI Kirana & Retail POS',
    icon: path.join(__dirname, '../public/pwa-512x512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Remove default menu bar for clean modern POS interface
  mainWindow.setMenuBarVisibility(false);

  // In development, load Vite dev server if running
  const isDev = process.env.ELECTRON_DEV === 'true';
  const targetUrl = isDev ? 'http://localhost:5173' : `http://localhost:${PORT}`;

  if (!isDev) {
    // Wait for the embedded Express server to spin up
    await waitForServer(PORT);
  }

  mainWindow.loadURL(targetUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle second instance attempt: focus current window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  // Start backend unless running in dev mode with separate backend
  if (process.env.ELECTRON_DEV !== 'true') {
    startBackendServer();
  }
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

