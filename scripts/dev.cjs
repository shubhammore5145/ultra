const { spawn } = require('child_process');
const path = require('path');

console.log('----------------------------------------------------');
console.log('🚀 Starting MartGPT Fullstack Development Server...');
console.log('----------------------------------------------------');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const rootDir = path.resolve(__dirname, '..');
const serverScript = path.join(rootDir, 'backend', 'server.js');

// 1. Start Backend API Server (Port 5000) directly via Node (handles paths with spaces reliably)
console.log('📦 Starting Backend API (Port 5000)...');
const backend = spawn(process.execPath, [serverScript], {
  cwd: rootDir,
  stdio: 'inherit'
});

backend.on('error', (err) => {
  console.error('❌ Failed to start Backend Server:', err);
});

backend.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`⚠️ Backend Server exited (code: ${code}, signal: ${signal})`);
  }
});

// 2. Start Vite Frontend (Port 5173)
console.log('⚡ Starting Vite Frontend (Port 5173)...');
const frontend = spawn(npxCmd, ['vite', '--host'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

frontend.on('error', (err) => {
  console.error('❌ Failed to start Vite Frontend:', err);
});

const cleanup = () => {
  console.log('\n🛑 Stopping servers...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
