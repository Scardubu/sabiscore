# 🚀 Quick Start - SabiScore

## One-Click Startup

```cmd
.\START_SABISCORE.bat
```

That's it! This will:
- ✅ Start backend API (port 8000)
- ✅ Start frontend preview (port 4173)
- ✅ Open browser automatically

---

## What You're Seeing

### ❌ Current Error:
```
Failed to load resource: 500 (Internal Server Error)
http://localhost:4173/api/v1/health
```

### ✅ Cause:
Backend API not running

### ✅ Solution:
Run the startup script above!

---

## Manual Startup (if needed)

### Backend (Terminal 1):
```powershell
cd backend
$env:PYTHONPATH=$PWD
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Terminal 2):
```powershell
cd frontend
npm run preview
```

---

## Verification

✅ Backend: http://localhost:8000/docs  
✅ Frontend: http://localhost:4173  
✅ Health: http://localhost:8000/api/v1/health

---

## Documentation

| File | Purpose |
|------|---------|
| INTEGRATION_SUMMARY.md | 📋 Complete integration report |
| BACKEND_SETUP_GUIDE.md | 🔧 Troubleshoot 500 errors |
| DEPLOYMENT_CHECKLIST.md | 🚀 Deploy to production |
| TECHNICAL_OPTIMIZATIONS.md | ⚡ Performance details |

---

## Status

**Build:** ✅ SUCCESS (140 KB gzipped)  
**Frontend:** ✅ READY  
**Backend:** ⏳ **START IT NOW!**

**Action Required:** Run `.\START_SABISCORE.bat`
