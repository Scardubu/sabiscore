# 🚀 Render Deployment Guide

- ## ✅ Prerequisites
- ✅ Render API Key: (store securely in Render dashboard / GitHub secrets; do NOT hard-code in docs)
- ✅ Backend code ready
- ✅ Dependencies fixed (pydantic 2.9.2, ruamel.yaml 0.18.6)

> Note: This repo now includes `backend/runtime.txt` pinned to Python 3.11.13 to ensure prebuilt wheels (e.g., pandas) are used during builds. On Render, either ensure the service runtime is set to Python 3.11 or allow Render to read `runtime.txt` from the `backend` root.

---

## 📋 Render Dashboard Deployment (10 minutes)

### Step 1: Create Web Service

1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub (if not connected):
   - Click "Connect GitHub"
   - Authorize Render
   - Select your sabiscore repository

### Step 3: Configure Service

By default the project includes a `requirements.min.txt` with minimal runtime dependencies to speed CI/builds and avoid heavy optional/test packages during initial deployment. Use the minimal file for quick deploys and the full `requirements.txt` for production ML workloads.


## 🧩 Model Artifact Validation & Fallback

- All backend deployments require valid model artifacts in `backend/models`.
- In CI and local/dev, dummy models are generated automatically if missing using `scripts/generate_dummy_models.py`.
- The CI workflow `.github/workflows/validate-models.yml` ensures all artifacts are present and valid before deploy/build/test.
- In production, set `MODEL_BASE_URL` to fetch real model artifacts. If not set, backend will not start unless valid models are present.

---
Note: Large models and processed datasets were removed from the repository to avoid storing large binaries in Git history and requiring Git LFS during remote clones. In production you must configure external storage for model artifacts and set the `MODEL_BASE_URL` repository/service secret so builds can fetch models during deployment. The repo includes `scripts/verify-models.sh` and `scripts/fetch-models.sh`:

- `scripts/verify-models.sh` — run in CI to verify `MODEL_BASE_URL` and an example artifact are reachable (fails fast when missing).
- `scripts/fetch-models.sh` — downloads the required artifacts into `backend/models` and `backend/data/processed` during build.

Example Render config:

```yaml
Name: sabiscore-api
Region: Oregon (US West)
Branch: main
Root Directory: backend
Runtime: Python 3.11
Build Command: pip install --upgrade pip && pip install -r requirements.min.txt
Start Command: uvicorn src.api.main:app --host 0.0.0.0 --port $PORT --workers 4
Instance Type: Free (or Starter $7/month for better performance)
```

If you need full ML dependencies (pandas, xgboost, lightgbm, shap, mlflow), change the build command to:

```powershell
pip install --upgrade pip && pip install -r requirements.txt
```

Note: We pin `runtime.txt` to Python 3.11.13 to ensure prebuilt wheels for heavy packages like `pandas` and `xgboost` are available during build. If you use the minimal requirements in CI, builds are faster and avoid conflicts (e.g. `great-expectations` / `ruamel.yaml`).

Example: download models during build (Render build command)

```powershell
# The build must run the verifier and fetcher. MODEL_BASE_URL and optional MODEL_FETCH_TOKEN
# should be set as secrets in the Render service or in GitHub Actions repository secrets.
pip install --upgrade pip && pip install -r requirements.min.txt && \
   bash -lc "./scripts/verify-models.sh && ./scripts/fetch-models.sh backend && python3 scripts/validate_models.py --models-dir backend/models --timeout 15"

### Model artifacts: fetch, validate and fail-fast (recommended)

Before the application process starts, ensure model artifacts are present and valid. Add this mini-check to your Render build/deploy step (or CI) so deployments fail early instead of starting a service with corrupt/incomplete models.

1. Verify base URL is reachable (fast fail):

   ./scripts/verify-models.sh

2. Fetch artifacts to `backend/models` (example fetcher included in repo):

   ./scripts/fetch-models.sh backend

3. Validate each artifact using the validator script (this runs joblib.load in a subprocess with a timeout):

   python3 scripts/validate_models.py --models-dir backend/models --timeout 15

If validation fails, the build should stop and the deploy should not proceed. This prevents hours of troubleshooting caused by truncated uploads or missing artifacts.
```

### Step 3: Environment Variables

Add these in the Render dashboard (or GitHub Actions repository secrets for CI):

```yaml
PYTHON_VERSION: 3.11
ENVIRONMENT: production
DATABASE_URL: (leave empty for now, uses SQLite)
REDIS_URL: (leave empty for now, uses dict cache)
MODEL_BASE_URL: https://storage.example.com/sabiscore  # REQUIRED for production - base URL where artifacts live
MODEL_FETCH_TOKEN: (optional) eyJhbGciOi...            # optional bearer token if storage is private
```

How to set secrets via the GitHub CLI (`gh`) from the repo root (PowerShell):

```powershell
# Set the model storage base URL
gh secret set MODEL_BASE_URL --body "https://storage.example.com/sabiscore"

# Optionally set a fetch token if your storage requires a bearer token
gh secret set MODEL_FETCH_TOKEN --body "<your-model-fetch-token>"
```

Note: The deploy workflow on `main` will fail early if `MODEL_BASE_URL` is not configured or artifacts are unreachable.

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait 5-7 minutes for build
3. Once deployed, copy your URL:
   ```
   https://sabiscore-api.onrender.com
   ```

---

## 🔗 Connect to Vercel Frontend

### Step 1: Add Backend URL to Vercel

```powershell
# Set the backend URL
vercel env add NEXT_PUBLIC_API_URL production
# When prompted, paste: https://sabiscore-api.onrender.com/api/v1

# Redeploy frontend with new env
vercel --prod
```

### Step 2: Test the Connection

```powershell
# Test backend health
curl https://sabiscore-api.onrender.com/health

# Test frontend
start https://sabiscore-70xn1bfov-oversabis-projects.vercel.app
```

---

## 🔧 Alternative: Render CLI Deployment

```powershell
# Install Render CLI
pip install render-cli

# Login with API key (store the API key securely, don't hard-code it in docs)
render login --api-key $RENDER_API_KEY

# Deploy from backend directory
cd backend
render deploy
```

---

## ⚠️ Common Issues & Fixes

### Issue 1: Pydantic Version Conflict
**Error:** `safety 3.5.1 requires pydantic<2.10.0,>=2.6.0, but you have pydantic 2.5.0`

**Fix:** ✅ Already fixed in requirements.txt
- Updated `pydantic==2.5.0` → `pydantic==2.9.2`
- Updated `ruamel.yaml` → `ruamel.yaml==0.18.6`

### Issue 2: Port Variable Not Set
**Error:** `Option '--port' requires an argument`

**Fix:** Use explicit port for local testing:
```powershell
# Local testing (port 8000)
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Render will automatically set $PORT variable
```

### Issue 3: Build Timeout
**Solution:** Render free tier has 10-minute build limit. If timeout:
1. Remove heavy dependencies temporarily
2. Use Starter plan ($7/month) for faster builds
3. Optimize requirements.txt

---

## 📊 Expected Build Output

```bash
==> Building...
==> Running: pip install --upgrade pip && pip install -r requirements.txt
Collecting fastapi==0.104.1
Collecting pydantic==2.9.2
...
Successfully installed [all packages]
==> Build successful!

==> Deploying...
==> Starting: uvicorn src.api.main:app --host 0.0.0.0 --port $PORT --workers 4
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
==> Deploy successful!
```

---

## ✅ Verification Steps

### 1. Check Render Logs
```
Dashboard → Your Service → Logs
Should see: "Application startup complete"
```

### 2. Test Backend Endpoints
```powershell
# Health check
curl https://sabiscore-api.onrender.com/health

# API docs
start https://sabiscore-api.onrender.com/docs
```

### 3. Test Frontend Integration
```powershell
# Should now load data from backend
start https://sabiscore-70xn1bfov-oversabis-projects.vercel.app
```

---

## 💰 Cost Breakdown

### Free Tier
```yaml
Monthly Hours: 750 hours
Cold Start: 30-60 seconds (after 15 min inactivity)
RAM: 512 MB
CPU: Shared
Cost: $0/month
```

### Starter Plan (Recommended)
```yaml
Monthly Hours: Unlimited
Cold Start: None (always running)
RAM: 512 MB
CPU: 0.5 vCPU
Cost: $7/month
```

---

## 🎯 Quick Start Commands

```powershell
# 1. Fix dependencies
cd backend
pip install -r requirements.txt

# 2. Test locally
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Go to Render dashboard
start https://dashboard.render.com/

# 4. Create Web Service (see Step 2 above)

# 5. Wait for deployment (5-7 minutes)

# 6. Add backend URL to Vercel
vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://sabiscore-api.onrender.com/api/v1

# 7. Redeploy frontend
vercel --prod

# 8. Test!
start https://sabiscore-70xn1bfov-oversabis-projects.vercel.app
```

---

**Time:** 10 minutes  
**Cost:** $0/month (free) or $7/month (starter)  
**Result:** Full-stack production deployment ✅
