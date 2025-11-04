@echo off
echo.
echo ========================================
echo   SabiScore - Full Stack Startup
echo ========================================
echo.
echo Starting Backend API Server...
echo.

cd backend
set PYTHONPATH=%CD%

start "SabiScore Backend" cmd /k "python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 8 /nobreak >nul

echo.
echo Backend started on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Starting Frontend Preview Server...
echo.

cd ..\frontend
start "SabiScore Frontend" cmd /k "npm run preview"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   SabiScore is Running!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:4173
echo.
echo Press any key to open the application...
pause >nul

start http://localhost:4173

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
