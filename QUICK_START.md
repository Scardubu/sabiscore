# 🚀 Quick Start - SabiScore

## One-Click Startup

```cmd
.\START_SABISCORE.bat
```

That's it! This will:
- ✅ Start backend API (port 8001)
- ✅ Start frontend preview (port 3001)
- ✅ Open browser automatically

---

## What You're Seeing

### Current Error

```text
Failed to load resource: 500 (Internal Server Error)
http://localhost:3001/api/v1/health
```

### Cause

Backend API not running

### Solution

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

### Backend (Terminal 1)

```powershell
cd backend
# Ensure real model artifacts exist in ../models or set MODEL_BASE_URL (see below)
python ../scripts/validate_models.py --models-dir ../models --timeout 20
$env:PYTHONPATH=$PWD
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend (Terminal 2)

```powershell
cd frontend
npm run preview
```

---

## Verification

✅ Backend: http://localhost:8001/docs  
✅ Frontend: http://localhost:3001 (dev) or :3001 (preview)  
✅ Health: http://localhost:8001/api/v1/health

---

## 🔍 Smoke Tests

### Production Backend
```powershell
$env:NEXT_PUBLIC_API_URL = "https://sabiscore-api.onrender.com"
powershell -ExecutionPolicy Bypass -File scripts/smoke-test-backend.ps1
```

### Local Backend
```powershell
$env:NEXT_PUBLIC_API_URL = "http://localhost:8001"
powershell -ExecutionPolicy Bypass -File scripts/smoke-test-backend.ps1
```

**Tests:**
- Health Check (`/health`)
- Readiness Probe (`/ready`)
- OpenAPI Schema (`/docs`, `/openapi.json`)
- Upcoming Matches (`/matches/upcoming`)
- Value Bets Today (`/predictions/value-bets/today`)
- Value Bets API (`/value-bets/`, `/value-bets/summary`)
- Create Prediction (POST `/predictions/`)
- Predict by Alias (`/predictions/predict`)

### Frontend Build
```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-test-frontend.ps1
```

**Validates:**
- TypeScript compilation
- ESLint rules
- Next.js build (7 routes, 110kB first-load JS)
- Build artifacts (`.next/standalone`, `.next/static`)

---

## 🛠️ Troubleshooting

### Backend Shows "Degraded" Status
```json
{ "status": "degraded", "database": true }
```

**Cause:** Redis connection not established (cold start, Upstash warmup).

**Fix:**
1. Wait 30-60s for Redis to connect
2. Retry health check: `curl https://sabiscore-api.onrender.com/api/v1/health`
3. Check Render logs for `Connected to Redis` message
4. Verify `REDIS_URL` env var in Render dashboard

### Smoke Tests Timing Out
```
Health Check: FAIL (timeout after 5s)
```

**Cause:** Cold start (Render spins down after 15min inactivity on free tier).

**Fix:**
1. First request may take 10-30s (service warmup)
2. Increase timeout in `smoke-test-backend.ps1`: `-TimeoutSec 30`
3. Re-run tests after initial warmup
4. Upgrade to paid tier for zero downtime

### Frontend Unreachable
**Fix:**
1. Check Vercel: https://vercel.com/dashboard
2. Manual deploy: `cd apps/web && vercel --prod`
3. Verify GitHub integration enabled for `feat/edge-v3`
4. Check build logs for OOM errors (should use 8GB `NODE_OPTIONS`)

### High TTFB (>150ms)
**Causes:**
- Cold Postgres queries (no connection pooling)
- Redis cache miss
- ML model loading (first prediction)

**Fixes:**
- Enable Render persistent disk for model cache
- Use PgBouncer for connection pooling
- Pre-warm cache with cron job
- Monitor with `scripts/monitor_deployment.ps1`

---

## Documentation

| File | Purpose |
|------|---------|
| README.md | 📋 Main project overview and getting started |
| ARCHITECTURE_V3.md | 🏗️ System architecture details |
| BACKEND_SETUP_GUIDE.md | 🔧 Backend troubleshooting guide |
| DEPLOYMENT_STATUS_LIVE.md | 📊 Live deployment status and logs |

---

## Status

**Build:** ✅ SUCCESS (110 KB first-load JS, 7 routes)  
**Frontend:** ✅ Vercel (auto-deploy from `feat/edge-v3`)  
**Backend:** ✅ Render (auto-deploy from `feat/edge-v3`)  
**Commit:** `6b4ec3c52` - Edge v3 hardening

**Production URLs:**
- 🌐 https://sabiscore.vercel.app
- ⚙️ https://sabiscore-api.onrender.com
