const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

console.log('----------------------------------------------------');
console.log('🚀 Starting MartGPT Desktop (Electron Development)...');
console.log('----------------------------------------------------');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const nodeCmd = isWindows ? 'node.exe' : 'node';

// 1. Start Backend API Server (Port 5000)
console.log('📦 Starting Backend API (Port 5000)...');
const backend = spawn(nodeCmd, ['backend/server.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

// 2. Start Vite Frontend (Port 5173)
console.log('⚡ Starting Vite Frontend (Port 5173)...');
const frontend = spawn(npxCmd, ['vite', '--host'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

// 3. Wait for Vite to be ready, then launch Electron
function waitForVite(callback) {
  const check = () => {
    http.get('http://localhost:5173', (res) => {
      callback();
    }).on('error', () => {
      setTimeout(check, 500);
    });
  };
  check();
}

let electronProcess = null;

waitForVite(() => {
  console.log('🖥️ Launching MartGPT Electron Window...');
  electronProcess = spawn(npxCmd, ['electron', 'electron/main.cjs'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON_DEV: 'true' },
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('close', () => {
    cleanup();
  });
});

const cleanup = () => {
  console.log('\n🛑 Closing MartGPT Desktop processes...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  try { if (electronProcess) electronProcess.kill(); } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

