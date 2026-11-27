@echo off
title Nayashi Kirana POS - Direct 80mm Silent Thermal Printing
echo ======================================================================
echo          Nayashi Kirana POS - Direct Silent Print (80mm)
echo ======================================================================
echo.
echo Launching POS with Kiosk Silent Printing...
echo Receipts will print DIRECTLY to your 80mm printer with ZERO popups!
echo.

set URL=http://localhost:5173/pos
set PROFILE=%LOCALAPPDATA%\NayashiPOSProfile

REM 1. Try Google Chrome in Program Files
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%URL%" --kiosk-printing --user-data-dir="%PROFILE%"
    goto done
)

REM 2. Try Google Chrome in Program Files (x86)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%URL%" --kiosk-printing --user-data-dir="%PROFILE%"
    goto done
)

REM 3. Try Google Chrome in LocalAppData
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="%URL%" --kiosk-printing --user-data-dir="%PROFILE%"
    goto done
)

REM 4. Try Microsoft Edge (Edge Chromium also supports --kiosk-printing)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --kiosk-printing --user-data-dir="%PROFILE%"
    goto done
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --kiosk-printing --user-data-dir="%PROFILE%"
    goto done
)

REM Fallback to chrome in PATH
start "" chrome.exe --app="%URL%" --kiosk-printing --user-data-dir="%PROFILE%"

:done
echo POS App launched successfully.
