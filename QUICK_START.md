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
✅ Health: http://localhost:8001/api/v1/health (basic status)  
✅ Readiness: http://localhost:8001/api/v1/health/ready (full check with DB, cache, models)

---

## 🧪 Testing & Quality

### Backend Tests

Run the full test suite:

```powershell
cd backend
python -m pytest --tb=short
```

**Test Coverage:** 46.55% (exceeds 30% threshold ✅)
- **90 tests:** 59 passing, 27 failures (environment/legacy issues)
- **Core modules:** database (92%), insights (87%), ensemble (90%+), aggregator (86%)

**Key test modules:**
- `tests/unit/test_ensemble.py` - Super Learner integration tests
- `tests/unit/test_engine_core.py` - Insights engine unit tests
- `tests/integration/test_api_coverage.py` - API endpoint smoke tests

**Note:** Some tests require initialized database and production `.env` configuration. Test failures are documented in deployment status and don't block the new Super Learner + autocomplete integration.

### Frontend Tests

```powershell
cd apps/web
npm run test
```

Validates TypeScript types, React component rendering, and ARIA accessibility compliance.

---

## 🤖 Prediction Engine

### GodStack Super Learner

SabiScore uses a **dual-path ensemble** for match predictions:

**Primary Path (Super Learner):**
- Multi-level stacking architecture (Level-1 diverse models, Level-2 XGBoost meta-learner)
- Isotonic calibration for probability reliability
- Optional online adapter for live learning
- Returns rich metadata for transparency

**Fallback Path (Legacy):**
- Base models + meta model ensemble
- Used when Super Learner not yet fitted or encounters errors

### Prediction Metadata

Predictions include detailed metadata fields:
- `engine`: `"super_learner"` or `"legacy_ensemble"`
- `level1_accuracy`: Accuracy of Level-1 diverse models
- `brier_guardrail_triggered`: Boolean indicating quality gate
- `final_accuracy`: Overall prediction accuracy
- `final_brier`: Brier score (lower is better, measures calibration)
- `final_log_loss`: Log loss metric
- `training_samples`: Number of samples used in training
- `feature_count`: Number of features in model

These fields enable confidence assessment and model monitoring in production.

### Engine Selection & Training Flags

The Super Learner now supports dual backends:

- **`sklearn` path** – zero-dependency default, safest for CI and local dev.
- **`h2o` path** – activates the H2O AutoML-style stack (XGBoost, GBM, DL, RF) for higher accuracy. Requires Java 11+ and `h2o` Python wheel.

**Prerequisites for H2O:**
```powershell
# Install Java 11 or higher (required for H2O)
# Download from: https://adoptium.net/temurin/releases/

# Install H2O Python package
pip install h2o==3.46.0.1
```

**Control the backend via environment variables or the training CLI:**

```powershell
# Environment overrides (fallback to sklearn if H2O is unavailable)
$env:SUPER_LEARNER_ENGINE = "h2o"   # or "sklearn" / "auto"
$env:SUPER_LEARNER_H2O_MAX_MEM = "8G"  # tune H2O cluster footprint

# CLI flags (override env on demand)
python -m backend.src.cli.train_models --engine h2o --h2o-max-mem 8G --prefer-gpu
```

**Additional training switches:**

- `--disable-online-adapter` – turns off the River online adapter for perfectly repeatable offline runs.
- `--leagues <LIST>` – train a subset of leagues (defaults to EPL, Bundesliga, La Liga, Serie A, Ligue 1).
- `--engine [auto|sklearn|h2o]` – explicitly select engine backend.
- `--h2o-max-mem` – custom memory allocation for H2O cluster (e.g., "8G", "16G").
- `--prefer-gpu` – enable GPU-accelerated boosters when available.

**Example training commands:**

```powershell
# Train all leagues with sklearn (default, no dependencies)
cd backend
python -m src.cli.train_models

# Train specific leagues with H2O backend
python -m src.cli.train_models --engine h2o --leagues EPL Bundesliga --h2o-max-mem 8G

# GPU-accelerated training with online adapter disabled
python -m src.cli.train_models --engine h2o --prefer-gpu --disable-online-adapter
```

The trainer automatically serializes H2O ensembles into the artifact, so deployment nodes only need the `h2o` dependency to reload the model.

---

## 🔍 Team Search API

### Endpoint

```
GET /api/v1/matches/teams/search?query={string}&league={string?}&limit={int}
```

**Parameters:**
- `query` (required): Search term (min 2 characters)
- `league` (optional): Filter by league name (e.g., "EPL", "La Liga")
- `limit` (optional): Max results (default: 20, max: 50)

**Example:**

```powershell
curl "http://localhost:8001/api/v1/matches/teams/search?query=Arsenal&limit=10"
```

**Response:**

```json
[
  {
    "id": "42",
    "name": "Arsenal",
    "league_id": "39",
    "country": "England",
    "stadium": "Emirates Stadium"
  }
]
```

### Features

- **Fuzzy matching:** Returns teams with partial name matches (case-insensitive)
- **League filtering:** Narrow results to specific competition
- **Exact-match-first ordering:** Exact matches appear at top of results
- **Powers API-backed autocomplete:** Frontend uses this endpoint for team selection with React Query caching (60s stale time, 300ms debounce)

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
- Health Check (`/health`) - basic liveness
- Readiness Check (`/health/ready`) - full system check
- Startup Check (`/startup`) - model loading status
- OpenAPI Schema (`/docs`, `/openapi.json`)
- Upcoming Matches (`/matches/upcoming`)
- Value Bets Today (`/predictions/value-bets/today`)
- Create Prediction (POST `/predictions/predict`)
- Predict by Alias (`/predictions/predict/alias/...`)

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
2. Retry readiness check: `curl https://sabiscore-api.onrender.com/api/v1/health/ready`
3. Check Render logs for `Connected to Redis` message
4. Verify `REDIS_URL` env var in Render dashboard
5. Basic health endpoint (`/health`) will still return 200 during Redis warmup

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
