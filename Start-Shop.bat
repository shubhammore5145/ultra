@echo off
title Nayashi Kirana / MartGPT Shop Launcher
color 0A

echo ========================================================
echo       Starting Nayashi Kirana / MartGPT POS App...
echo ========================================================
echo.

cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed on this PC!
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b
)

echo [1/2] Launching Backend & Frontend Services...
start /b cmd /c "node scripts/dev.cjs"

echo [2/2] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo.
echo Opening MartGPT POS Billing Screen in your default browser...
start http://localhost:5173

echo.
echo ========================================================
echo   MartGPT is RUNNING!
echo   Local Address: http://localhost:5173
echo   Do NOT close this window while using the software.
echo ========================================================
echo.

pause

