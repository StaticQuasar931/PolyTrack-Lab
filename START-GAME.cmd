@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org, then open this file again.
  pause
  exit /b 1
)
node serve.cjs --open
pause
