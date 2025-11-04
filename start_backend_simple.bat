@echo off
echo Starting SabiScore Backend...
cd backend
set PYTHONPATH=%CD%
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
pause
