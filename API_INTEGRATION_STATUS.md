# API Integration Verification

## ✅ Configuration Status (Updated: Nov 2024)

### Backend API Structure
- **Base URL**: `https://sabiscore-api.onrender.com`
- **Health Endpoints** (root level for container orchestration):
  - `/health` - Comprehensive system status
  - `/health/live` - Liveness probe
  - `/health/ready` - Readiness probe with DB/cache/model checks

- **API Routes** (under `/api/v1` prefix):
  - `/api/v1/health` - Forwarded from monitoring router
  - `/api/v1/insights` - Match insights generation
  - `/api/v1/predictions/*` - Prediction endpoints
  - `/api/v1/matches/*` - Match data and team search
  - `/api/v1/odds/*` - Odds data and analysis
  - `/api/v1/metrics/*` - Cache and system metrics

### Frontend API Client
- **File**: `apps/web/src/lib/api.ts` (active client)
- **Configuration**: 
  ```typescript
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  ```
- **Environment Variables**:
  - **Local**: `.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`
  - **Production**: `.env.production` → `NEXT_PUBLIC_API_URL=https://sabiscore-api.onrender.com/api/v1` ✅ **FIXED**

### Vercel Deployment Configuration
- **File**: `vercel.json`
- **Rewrites**:
  1. `/api/v1/health` → `https://sabiscore-api.onrender.com/health` (direct to root health endpoint)
  2. `/api/v1/:path*` → `https://sabiscore-api.onrender.com/api/v1/:path*` (proxy all other API calls)

### Integration Flow
```
Frontend Request                Vercel Rewrite                Backend Handler
─────────────────              ───────────────              ────────────────
GET /api/v1/health      →      /health                  →   monitoring.router["/health"]
POST /api/v1/insights   →      /api/v1/insights        →   legacy_endpoints["/insights"]
GET /api/v1/matches/*   →      /api/v1/matches/*       →   match routes
```

## ✅ Resolved Issues

### 1. API URL Suffix Inconsistency ✅
**Problem**: `.env.production` had `https://sabiscore-api.onrender.com` without `/api/v1` suffix, causing potential URL mismatch.

**Solution**: Updated `.env.production` to include `/api/v1` suffix:
```env
NEXT_PUBLIC_API_URL=https://sabiscore-api.onrender.com/api/v1
```

### 2. Multiple API Clients ✅
**Problem**: Two API client files (`api.ts` and `api-client.ts`) with different URL handling.

**Resolution**: 
- `api.ts` is the active client (imported by all components)
- `api-client.ts` appears to be unused/legacy code (no imports found)
- Confirmed consistent usage throughout codebase

### 3. Vercel Rewrite Alignment ✅
**Status**: Rewrites correctly configured to proxy frontend API calls to Render backend.

## 📋 Integration Checklist

### Local Development
- [x] Backend health endpoints functional
- [x] Frontend API client properly configured
- [x] Environment variables set correctly
- [x] API URL suffix consistency resolved
- [ ] Test with `test_integration_local.ps1` script

### Production Deployment
- [x] `.env.production` includes `/api/v1` suffix
- [x] Vercel rewrites proxy to correct backend URLs
- [x] CORS allows Vercel domains in backend
- [x] Health checks configured for Render service
- [ ] Deploy to Render (feat/edge-v3 branch)
- [ ] Deploy to Vercel (production)
- [ ] Smoke test production endpoints

## 🧪 Testing Commands

### Local Integration Test
```powershell
# Run comprehensive integration test
.\test_integration_local.ps1

# Start backend (separate terminal)
cd backend
uvicorn src.api.main:app --reload --port 8000

# Start frontend (separate terminal)
cd apps/web
npm run dev
```

### Production Smoke Tests
```powershell
# Test Render backend health
curl https://sabiscore-api.onrender.com/health/ready

# Test Vercel frontend
curl https://sabiscore.vercel.app/

# Test API proxy through Vercel
curl https://sabiscore.vercel.app/api/v1/health
```

## 📝 Known Configurations

### Backend (`backend/render.yaml`)
```yaml
runtime: python
rootDir: backend
buildCommand: pip install -r requirements.txt
startCommand: uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
healthCheckPath: /health/ready
branch: feat/edge-v3
```

### Frontend (`vercel.json`)
```json
{
  "buildCommand": "cd apps/web && npm run build",
  "installCommand": "npm ci",
  "outputDirectory": "apps/web/.next",
  "rewrites": [
    { "source": "/api/v1/health", "destination": "https://sabiscore-api.onrender.com/health" },
    { "source": "/api/v1/:path*", "destination": "https://sabiscore-api.onrender.com/api/v1/:path*" }
  ]
}
```

## 🎯 Next Steps

1. **Run Local Integration Tests**
   ```powershell
   .\test_integration_local.ps1
   ```

2. **Deploy Backend to Render**
   - Push `feat/edge-v3` branch to GitHub
   - Trigger Render deployment (auto-deploy disabled, manual trigger required)
   - Verify health check: `curl https://sabiscore-api.onrender.com/health/ready`

3. **Deploy Frontend to Vercel**
   ```powershell
   vercel --prod
   ```
   - Verify build succeeds
   - Test API rewrites work correctly
   - Check browser console for any CORS or API errors

4. **Production Smoke Tests**
   - Visit `https://sabiscore.vercel.app`
   - Test match selector with team autocomplete
   - Generate match insights and verify API connectivity
   - Check Sentry for any runtime errors

## 📚 Reference Documentation

- **Backend Setup**: `BACKEND_SETUP_GUIDE.md`
- **Deployment Runbook**: `PRODUCTION_DEPLOY_RUNBOOK.md`
- **Production Readiness**: `PRODUCTION_READINESS_COMPLETE.md`
- **Architecture**: `ARCHITECTURE_V3.md`
