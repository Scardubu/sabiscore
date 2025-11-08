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


## Model Artifacts: Local/CI Setup

Before starting the backend, ensure valid model artifacts exist in `models/`.

- For local/CI/dev, generate dummy models:
- Model artifacts must be real production-ready ensembles. This repository no longer ships or supports placeholder/dummy artifacts.

- Validation (required): use the validator to check any artifact before starting the backend. The validator will fail if artifacts contain toy/dummy models.
```powershell
python scripts/validate_models.py --models-dir ./models --timeout 20
```
- For production, host artifacts on S3 (recommended) or any HTTPS file server and set `MODEL_BASE_URL`.

Example S3 workflow (recommended):

1. Create a private S3 bucket (or use existing). Upload your model artifacts preserving paths:

```powershell
aws s3 cp path\to\epl_ensemble.pkl s3://my-bucket/models/epl_ensemble.pkl
aws s3 cp path\to\bundesliga_ensemble.pkl s3://my-bucket/models/bundesliga_ensemble.pkl
```

2. Set environment variables in your deployment (Render, Railway, Docker, etc):

```powershell
$env:MODEL_BASE_URL = 's3://my-bucket'
# Optional: $env:MODEL_FETCH_TOKEN for signed-URL or custom auth
```

3. During startup the backend will attempt to download artifacts from S3 and validate them automatically.

Notes:
- CI will reject artifacts that contain placeholder DummyClassifier models unless you explicitly allow them by setting `ALLOW_DUMMY_MODELS=1` in your dev pipeline.
- If you prefer a cheaper object store, Backblaze B2 or DigitalOcean Spaces work similarly and can be used with an HTTPS MODEL_BASE_URL.
- For production, set `MODEL_BASE_URL` and fetch real models (see deployment guide).

---
## Manual Startup (if needed)


### Backend (Terminal 1):
```powershell
cd backend
# Ensure real model artifacts exist in ../models or set MODEL_BASE_URL (see below)
python ../scripts/validate_models.py --models-dir ../models --timeout 20
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
