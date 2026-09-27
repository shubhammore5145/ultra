const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('>>> [Chrome Installer] Checking environment for Chrome requirements...');
console.log('>>> Platform:', process.platform, '| RENDER:', !!process.env.RENDER);

// Always install on Linux or Render
const isLinuxOrRender = process.platform === 'linux' || !!process.env.RENDER;

if (isLinuxOrRender) {
  console.log('>>> [Chrome Installer] Installing Chrome for Linux/Render environment...');
  try {
    const backendDir = path.join(__dirname, '..', 'backend');
    execSync('npx puppeteer browsers install chrome', {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: path.join(__dirname, '..', '.cache', 'puppeteer')
      }
    });
    console.log('>>> [Chrome Installer] Chrome installed successfully into cache directory!');
  } catch (err) {
    console.error('>>> [Chrome Installer] Warning: Could not complete npx install chrome:', err.message);
  }
} else {
  console.log('>>> [Chrome Installer] Skipping auto-download on local non-Linux platform.');
}
