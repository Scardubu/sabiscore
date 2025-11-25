@echo off
cls
echo.
echo ============================================================
echo   SabiScore - Restarting with Production Fixes Applied
echo ============================================================
echo.
echo FIXES APPLIED:
echo   [x] Removed packageManager field (no more Yarn warnings)
echo   [x] Added model loading to startup (fixes 503 errors)
echo   [x] Fixed APIError serialization (proper error messages)
echo.
echo ============================================================
echo.

REM Kill existing processes
echo Stopping existing servers...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo Starting Backend (http://localhost:8000)...
cd backend
set PYTHONPATH=%CD%
start "SabiScore Backend [FIXED]" cmd /k "python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000"
cd ..

timeout /t 10 /nobreak >nul

echo.
echo Starting Frontend (http://localhost:3000)...
cd apps\web
start "SabiScore Frontend [FIXED]" cmd /k "npm run dev"
cd ..\..

timeout /t 8 /nobreak >nul

echo.
echo ============================================================
echo   Both servers are starting...
echo ============================================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul

start http://localhost:3000

echo.
echo ============================================================
echo   READY! Test the flow:
echo   1. Select league (EPL, La Liga, etc.)
echo   2. Choose home team
echo   3. Choose away team  
echo   4. Click "Generate Insights"
echo   5. View predictions and value bets
echo ============================================================
echo.
pause
