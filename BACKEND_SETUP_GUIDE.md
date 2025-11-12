# 🔧 SabiScore Backend Setup & Troubleshooting Guide

## 🚨 CRITICAL: Backend Must Be Running!

The **500 Internal Server Error** on `/api/v1/health` means the backend API is **not running**.

### Quick Start

#### Windows (PowerShell/CMD)
```cmd
# Navigate to project root
cd C:\Users\USR\Documents\SabiScore

# Run the simple batch file
.\start_backend_simple.bat
```

**Or use PowerShell:**
```powershell
cd backend
$env:PYTHONPATH=$PWD
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

#### Linux/Mac/WSL
```bash
cd backend
export PYTHONPATH=$PWD
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

---

## ✅ Verification Steps

### 1. Check Backend is Running

**Terminal Output Should Show:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX] using WatchFiles
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 2. Test API Endpoints

**Open in Browser:**
- API Documentation: http://localhost:8000/docs
- Root Endpoint: http://localhost:8000/
- Health Check: http://localhost:8000/api/v1/health

**Expected Health Response:**
```json
{
  "status": "healthy" or "degraded",
  "database": true,
  "models": true/false,
  "cache": true,
  "latency_ms": 50.5
}
```

### 3. Verify Frontend Can Connect

**Open Browser Console (F12) on:**
- Development: http://localhost:5173
- Preview: http://localhost:4173

**You should see:**
```
✅ GET http://localhost:8000/api/v1/health 200 OK
```

**NOT:**
```
❌ GET http://localhost:8000/api/v1/health 500 Internal Server Error
❌ Failed to load resource
```

---

## 🐛 Troubleshooting

### Error: "Failed to load resource: 500 (Internal Server Error)"

**Cause:** Backend is not running or crashed during startup

**Solution:**
1. Kill any hanging Python processes:
   ```powershell
   Get-Process python | Stop-Process -Force
   ```

2. Restart backend:
   ```powershell
   cd backend
   $env:PYTHONPATH=$PWD
   python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. Wait for "Application startup complete" message

4. Test: http://localhost:8000/docs

### Error: "Address already in use" / Port 8000 Conflict

**Solution:**
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill it (replace PID with actual process ID)
taskkill /PID <PID> /F

# Restart backend
.\start_backend_simple.bat
```

### Error: Redis Connection Failed

**This is OK!** The backend falls back to in-memory caching.

**Log Message (Safe to Ignore):**
```
WARNING: Redis unavailable, using in-memory cache only
```

**Status:** Health check will show `"cache": true` even without Redis

### Error: "ModuleNotFoundError: No module named 'uvicorn'"

**Solution:**
```powershell
cd backend
pip install -r requirements.txt
```

### Error: Database Connection Failed

**Solution:**
```powershell
cd backend

# Check if sabiscore.db exists
ls sabiscore.db

# If missing, it will be created automatically on first run
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🔄 Full Stack Development Workflow

### Terminal 1: Backend
```powershell
cd backend
$env:PYTHONPATH=$PWD
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```
**Runs on:** http://localhost:8000

### Terminal 2: Frontend Development
```powershell
cd frontend
npm run dev
```
**Runs on:** http://localhost:5173

### Terminal 3: Frontend Preview (Production Build)
```powershell
cd frontend
npm run build
npm run preview
```
**Runs on:** http://localhost:4173

---

## 📊 Backend Architecture

### Tech Stack
- **Framework:** FastAPI (Python)
- **Server:** Uvicorn (ASGI)
- **Database:** SQLite (sabiscore.db)
- **Cache:** Redis (optional) + In-Memory Fallback
- **ML Models:** XGBoost, LightGBM, Ensemble

### Key Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API welcome message |
| `/docs` | GET | Swagger UI documentation |
| `/api/v1/health` | GET | Health check + metrics |
| `/api/v1/insights` | POST | Generate match predictions |
| `/api/v1/search` | GET | Search teams/matches |

### Configuration
**Default Settings:**
- Port: 8000
- Host: 0.0.0.0 (all interfaces)
- Database: `backend/sabiscore.db` (SQLite)
- Redis: Optional (falls back to memory)
- CORS: Allows localhost:3000, 3001, 3002, 5173

**Environment Variables (.env):**
```env
DATABASE_URL=sqlite:///./sabiscore.db
REDIS_URL=redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379
REDIS_ENABLED=true
APP_ENV=development
DEBUG=true
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key-here
```

---

## ✅ Success Checklist

- [ ] Backend starts without errors
- [ ] "Application startup complete" message appears
- [ ] http://localhost:8000/docs loads Swagger UI
- [ ] Health check returns 200 OK
- [ ] Frontend connects successfully (no 500 errors)
- [ ] Database tables created/verified
- [ ] No Python traceback errors

---

## 🎯 Next Steps

1. **Keep backend running** in a dedicated terminal
2. **Start frontend** in a separate terminal (`npm run dev`)
3. **Test integration** between frontend and backend
4. **Monitor console** for any errors
5. **Deploy both** frontend and backend together

---

## 🆘 Still Having Issues?

### Check Logs
```powershell
# Backend logs show in the terminal where you ran uvicorn
# Look for errors after "Application startup complete"
```

### Verify Python Environment
```powershell
python --version  # Should be Python 3.11+
pip list | findstr fastapi  # Should show fastapi 0.104.1
pip list | findstr uvicorn  # Should show uvicorn 0.24.0
```

### Clean Restart
```powershell
# Kill all Python processes
Get-Process python | Stop-Process -Force

# Clean database (if corrupted)
cd backend
Remove-Item sabiscore.db -Force

# Reinstall dependencies
pip install -r requirements.txt

# Start fresh
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📞 Support

**Backend Status:** The backend should remain running continuously during development.

**Remember:** The frontend preview on http://localhost:4173 will show 500 errors if the backend on http://localhost:8000 is not running!
