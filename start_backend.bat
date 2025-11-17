@echo off
REM SabiScore Backend Startup Script

echo Starting SabiScore Backend...

REM Set environment variables
REM set DATABASE_URL=postgresql://sabi:your_secure_password@localhost:5432/sabiscore
set REDIS_URL=redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379

REM Change to backend directory
cd backend

REM Run the application
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
