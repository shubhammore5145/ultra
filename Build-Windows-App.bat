@echo off
title MartGPT Windows EXE Package Builder
color 0B

echo ========================================================
echo       Building MartGPT Windows Desktop (.EXE) App
echo ========================================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Building Frontend Web Assets...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Frontend build failed.
    pause
    exit /b
)

echo.
echo [2/3] Compiling Native Windows Desktop App (.exe)...
echo This may take 1-2 minutes depending on your CPU...
call npx electron-builder --win

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Electron packaging encountered an issue.
    pause
    exit /b
)

echo.
echo ========================================================
echo   BUILD COMPLETE! SUCCESS!
echo.
echo   Your Windows installer is located in:
echo   Folder: dist_electron\
echo ========================================================
echo.

:: Open dist_electron folder in Windows Explorer
explorer "%~dp0dist_electron"

pause

