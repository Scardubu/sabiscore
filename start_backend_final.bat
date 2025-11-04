@echo off
cd /d "c:\Users\USR\Documents\SabiScore"
set PYTHONPATH=c:\Users\USR\Documents\SabiScore
set DATABASE_URL=sqlite:///./backend/sabiscore.db

echo Starting SabiScore Backend Server...
python -m uvicorn backend.src.api.main:app --host 0.0.0.0 --port 8000
