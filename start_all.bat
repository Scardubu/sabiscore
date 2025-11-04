@echo off
REM SabiScore Full System Startup Script

echo Starting SabiScore Full System...

REM Start backend in background
start start_backend.bat

REM Wait a bit for backend to start
timeout /t 10 /nobreak > nul

REM Start frontend in background
start start_frontend.bat

echo System starting...
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
