@echo off
title Nayashi Kirana POS - Direct Thermal Printing Mode
echo ========================================================
echo   Nayashi Kirana POS - Direct Silent Print (80mm)
echo ========================================================
echo.
echo Launching Google Chrome in Kiosk Silent Printing Mode...
echo (All receipts will go DIRECTLY to your 80mm printer without print popups!)
echo.

REM Try standard Google Chrome installation paths
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk-printing "http://localhost:5173/pos"
    goto done
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --kiosk-printing "http://localhost:5173/pos"
    goto done
)

if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --kiosk-printing "http://localhost:5173/pos"
    goto done
)

REM Fallback to PATH
start "" chrome.exe --kiosk-printing "http://localhost:5173/pos"

:done
echo POS window launched successfully.
