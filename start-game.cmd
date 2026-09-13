@echo off
setlocal
cd /d "%~dp0"
start "Fu Tide Server" /b cmd /c "npm.cmd run dev -- --host 127.0.0.1 --port 5173 > .vite-local.log 2>&1"
timeout /t 2 /nobreak > nul
start "符潮残夜" "http://127.0.0.1:5173/"
