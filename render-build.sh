#!/usr/bin/env bash
# Render Build Script for MartGPT
set -o errexit

echo ">>> [Render Build] Installing root dependencies..."
npm install

echo ">>> [Render Build] Installing backend dependencies..."
cd backend && npm install && cd ..

echo ">>> [Render Build] Building Vite frontend..."
npm run build

echo ">>> [Render Build] Build completed successfully!"
