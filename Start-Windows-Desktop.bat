@echo off
title MartGPT Native Desktop POS
color 0A

echo ========================================================
echo       Launching MartGPT Native Windows Desktop App...
echo ========================================================
echo.

cd /d "%~dp0"

node scripts/dev_electron.cjs

pause

