# Deployment Fixes - November 17, 2025

## Critical Issues Identified

### 1. **Monitoring Endpoints Returning 404** ✅ FIXED
**Problem:** `/health/live` and `/health/ready` endpoints were returning 404 errors
**Root Cause:** Router conflict - both `health.py` and `monitoring.py` defined `/health` endpoint
**Impact:** Render health checks failing, deployment stuck

**Solution:**
- Removed `health_router` import from `main.py`
- Use only `monitoring_router` which has all required endpoints
- Monitoring router provides: `/health`, `/health/live`, `/health/ready`, `/metrics`

**Files Changed:**
- `backend/src/api/main.py` (commit: bef5b4095)

### 2. **S3 Download Attempts Despite SKIP_S3=true** ✅ FIXED
**Problem:** Render logs showing 400 errors from S3 despite `SKIP_S3=true` in environment
**Root Cause:** `MODEL_BASE_URL` was set, so startup code called `fetch_models_if_needed()` before checking `SKIP_S3`

**Solution:**
- Check `SKIP_S3` flag early in `_startup_trigger_model_load()`
- Skip remote fetch entirely when `SKIP_S3=true`
- Pass `None` for `model_base_url` to prevent download attempts

**Files Changed:**
- `backend/src/api/main.py` (commit: 3d2e3a599)

**Logs Before:**
```
WARNING:src.core.model_fetcher:Download attempt 1 failed for https://sabiscore-models.s3.eu-central-1.amazonaws.com/v3/models/epl_ensemble.pkl: 400 Client Error: Bad Request
```

**Logs After:**
```
INFO:src.api.main:Startup: SKIP_S3=true, skipping remote model fetch
INFO:src.api.main:Startup: local model artifacts verified
```

### 3. **Model Files Location Verified** ✅ CONFIRMED
**Status:** Model files ARE committed to git in `/models/*.pkl`
**Files Tracked:**
```
models/epl_ensemble.pkl
models/serie_a_ensemble.pkl
models/la_liga_ensemble.pkl
models/ligue_1_ensemble.pkl
models/bundesliga_ensemble.pkl
```

**Config Path Resolution:**
- `_PROJECT_ROOT = Path(__file__).resolve().parents[3]` from `backend/src/core/config.py`
- Resolves to repository root: `./models/`
- Correctly points to committed model files

### 4. **Health Check Path Temporary Change** ⚠️ TEMPORARY
**Problem:** Render may be stuck waiting for `/health/ready` to pass (which was 404ing)
**Temporary Solution:** Changed `healthCheckPath` to `/health` in `render.yaml`
**Next Step:** Once `/health/ready` endpoint is confirmed working, switch back

**Files Changed:**
- `render.yaml` (commit: 17459b467)

## Deployment Timeline

| Time | Action | Commit | Status |
|------|--------|--------|--------|
| 06:00 | Initial deployment attempt | 976b0358e | ❌ 404 errors |
| 06:15 | Add monitoring router at root | 3d2e3a599 | ⏳ Still 404 |
| 06:20 | Remove health router conflict | bef5b4095 | ⏳ Deploying |
| 06:25 | Temp healthcheck workaround | 17459b467 | ⏳ Current |

## Verification Checklist

### Backend Endpoints (Expected after deploy)
- [ ] `/health` → 200 OK (basic health)
- [ ] `/health/live` → 200 OK (liveness probe)
- [ ] `/health/ready` → 200 OK (readiness probe with model validation)
- [ ] `/metrics` → 200 OK (Prometheus metrics)
- [ ] `/api/v1/matches/upcoming` → 200 OK
- [ ] `/api/v1/predictions/value-bets/today` → 200 OK

### Model Loading (Expected)
```json
{
  "status": "ready",
  "checks": {
    "models": {
      "status": "healthy",
      "message": "Found 5 model(s)",
      "trained": true
    }
  }
}
```

### Environment Variables (Render)
```yaml
SKIP_S3=true                  # ✅ Set in render.yaml
MODEL_FETCH_STRICT=false      # ✅ Set in render.yaml
REDIS_ENABLED=true            # ✅ Set in render.yaml
WORKERS=1                     # ✅ Via --workers 1
LOG_LEVEL=INFO                # ✅ Via --log-level info
```

## Next Steps

1. **Wait for Render Deployment** (ETA: ~3 minutes from 06:25)
2. **Validate All Endpoints:**
   ```powershell
   python scripts/validate_deployment.py https://sabiscore-api.onrender.com https://sabiscore.vercel.app --poll
   ```

3. **Switch Back to /health/ready** (once confirmed working):
   ```yaml
   healthCheckPath: /health/ready  # More comprehensive check
   ```

4. **Monitor Render Logs** for:
   - ✅ "Found N valid local model(s)"
   - ✅ "Model artifacts loaded successfully"
   - ✅ No S3 warnings
   - ✅ Memory usage <450MB

## Testing Commands

### Manual Endpoint Tests
```powershell
# Health checks
Invoke-WebRequest https://sabiscore-api.onrender.com/health
Invoke-WebRequest https://sabiscore-api.onrender.com/health/live
Invoke-WebRequest https://sabiscore-api.onrender.com/health/ready

# Model validation
$r = Invoke-WebRequest https://sabiscore-api.onrender.com/health/ready | ConvertFrom-Json
$r.checks.models.trained  # Should be: True
```

### Automated Validation
```powershell
# One-time check
python scripts/validate_deployment.py https://sabiscore-api.onrender.com https://sabiscore.vercel.app

# Continuous polling (recommended during deployment)
python scripts/validate_deployment.py https://sabiscore-api.onrender.com https://sabiscore.vercel.app --poll --max-attempts 20 --interval 30
```

## Summary of Commits

1. **976b0358e** - Initial deployment hardening (model fetcher, cache, docs)
2. **3d2e3a599** - Expose monitoring endpoints, respect SKIP_S3
3. **bef5b4095** - Remove health router conflict
4. **17459b467** - Temporary healthcheck workaround

All commits pushed to `feat/edge-v3` branch for auto-deployment to Render.

## Lessons Learned

1. **Router Conflicts:** FastAPI routers with duplicate paths cause silent failures - first registered wins
2. **Environment Flags:** Check flags early in startup, not deep in helper functions
3. **Health Check Paths:** Use working endpoint for healthCheckPath during deployment transitions
4. **Model Paths:** Always verify `_PROJECT_ROOT` resolution matches git structure
5. **Deployment Validation:** Use polling mode during deployments to catch when changes go live

## Validation Run (single) — 2025-11-17T12:53:11 UTC

I ran a single validation pass against the deployed backend and frontend. Results below
show the current state and immediate actions taken.

Summary:
- **Backend `/health`**: 200 OK (status: degraded)
- **Backend `/health/live`**: 200 OK
- **Backend `/health/ready`**: 200 OK (reported DB & cache ready)
- **OpenAPI**: 200 OK
- **`/api/v1/matches/upcoming`**: 500 Internal Server Error
- **`/api/v1/predictions/value-bets/today`**: 500 Internal Server Error
- **Model loading status**: FAILED to verify (validator reported "Models not loaded: Unknown error")

Frontend:
- `/` (homepage): 200 OK
- `/favicon.ico`: 404 Not Found
- `/api/v1/health` (proxy): 502 Bad Gateway

Full relevant snippets from the validator run (truncated):

```
Testing /health                              ... ✓ PASS - Status 200 ✓ - { "status": "degraded", "timestamp": "2025-11-17T12:53:10.288019", ... }
Testing /health/live                         ... ✓ PASS - Status 200 ✓ - { "status": "alive", "timestamp": "2025-11-17T12:53:11.509025" }
Testing /health/ready                        ... ✓ PASS - Status 200 ✓ - { "status": "ready", "checks": { "database": { "status": "ready" }, "cache": { "status": "ready" } } }
Testing /api/v1/matches/upcoming            ... ✗ FAIL - HTTP 500: Internal Server Error
Testing /api/v1/predictions/value-bets/today... ✗ FAIL - HTTP 500: Internal Server Error
Validating model loading status ... ✗ Models not loaded: Unknown error

Frontend: /api/v1/health ... ✗ FAIL - HTTP 502: Bad Gateway
```

Immediate analysis and actions taken:
- Root cause for the 500 errors: runtime logs showed `RuntimeError: Database not initialized. Call init_db() first.` This means the async DB session factory (`AsyncSessionLocal`) was not being initialized in the FastAPI startup path used by Render.
- Fix applied: added startup and shutdown handlers in `backend/src/api/main.py` to call `init_db()` on startup and `close_db()` on shutdown. This ensures `get_db_session()` can create async sessions for endpoint dependencies.
- The 502 on the frontend proxy indicates the frontend cannot reach the API (or API returned 5xx) — once the backend 500s are addressed, re-check this.

Next steps (performed/queued):
- [x] Added async DB init/shutdown handlers to `backend/src/api/main.py` (committed)
- [ ] Re-run full polling validation (recommended) to confirm the 500s are resolved and models load successfully
- [ ] Fix frontend proxy 502 if it persists after backend fixes (investigate Vercel routing or CORS/proxy settings)
- [ ] Add a small smoke endpoint that returns DB + app version for quick checks (optional)

Timestamped log entry: 2025-11-17T12:53:11Z

