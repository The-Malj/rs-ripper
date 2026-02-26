@echo off
setlocal

cd /d "%~dp0"

if not exist "package.json" (
  echo [ERROR] package.json not found. Run this from the plugin root.
  pause
  exit /b 1
)

echo Starting Vite dev server...
npm run dev
