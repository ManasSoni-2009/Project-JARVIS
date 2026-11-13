@echo off
chcp 65001 >nul 2>&1
title J.A.R.V.I.S v3.0 Studio Launcher
echo ==========================================================
echo   J.A.R.V.I.S v3.0 Studio - 1-Click Windows Launcher
echo ==========================================================
cd /d "%~dp0"
node scripts/start-jarvis.mjs --open
pause
