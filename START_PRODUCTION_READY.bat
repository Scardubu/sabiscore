@echo off
echo.
echo ========================================
echo   SabiScore - Production Ready Launch
echo ========================================
echo.

REM Check if backend is already running
echo Checking backend status...
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend is already running on http://localhost:8000
) else (
    echo Starting Backend API Server...
    cd backend
    set PYTHONPATH=%CD%
    start "SabiScore Backend API" cmd /k "python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000"
    cd ..
    timeout /t 10 /nobreak >nul
)

REM Check if frontend is already running
echo.
echo Checking frontend status...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend is already running on http://localhost:3000
) else (
    echo Starting Next.js Development Server...
    cd apps\web
    start "SabiScore Frontend" cmd /k "npm run dev"
    cd ..\..
    timeout /t 8 /nobreak >nul
)

echo.
echo ========================================
echo   🚀 SabiScore is Running!
echo ========================================
echo.
echo 📡 Backend API:  http://localhost:8000
echo    API Docs:     http://localhost:8000/docs
echo.
echo 🌐 Frontend App: http://localhost:3000
echo.
echo ========================================
echo.
echo Opening application in browser...
timeout /t 3 /nobreak >nul

start http://localhost:3000

echo.
echo ✅ Both servers are running in separate windows.
echo ⚠️  Close those windows to stop the servers.
echo.
echo Press any key to exit this window...
pause >nul
