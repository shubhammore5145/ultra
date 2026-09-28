#!/usr/bin/env bash
# Render Build Script for MartGPT
set -o errexit

echo ">>> [Render Build] Installing root dependencies..."
npm install

echo ">>> [Render Build] Building Vite frontend..."
npm run build

echo ">>> [Render Build] Ensuring Chrome is installed for Puppeteer..."
cd backend
npx puppeteer browsers install chrome
cd ..

echo ">>> [Render Build] Build completed successfully!"
