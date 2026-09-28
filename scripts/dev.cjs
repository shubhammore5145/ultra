const { spawn } = require('child_process');
const path = require('path');

console.log('----------------------------------------------------');
console.log('🚀 Starting MartGPT Fullstack Development Server...');
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

const cleanup = () => {
  console.log('\n🛑 Stopping servers...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
