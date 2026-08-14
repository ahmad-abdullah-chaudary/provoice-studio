@echo off
title ProVoice Studio
color 0B

echo.
echo  ================================================
echo    ProVoice Studio - Offline AI Narration Suite
echo  ================================================
echo.
echo  [1/2] Starting Backend Engine (Kokoro TTS)...
echo.

REM Start backend in a new window so it stays alive
start "ProVoice Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

REM Wait for backend to boot
timeout /t 4 /nobreak >nul

echo  [2/2] Starting Desktop UI on port 3000...
echo.

REM Start Vite dev server in a new window
start "ProVoice UI" cmd /k "cd /d "%~dp0" && npx vite --port 3000"

REM Wait for UI to boot
timeout /t 3 /nobreak >nul

echo  Opening ProVoice Studio in your browser...
start http://localhost:3000

echo.
echo  Both servers are running.
echo  Close this window to keep them running in background.
echo  Or close the Backend and UI windows to stop them.
echo.
pause
