# 🎯 Production Deployment Final Checklist

## ✅ Pre-Deployment Verification

### Backend Configuration
- [x] `backend/render.yaml` uses correct schema (`runtime: python`)
- [x] Health check path set to `/health/ready`
- [x] CORS origins include Vercel domains
- [x] Environment variables configured (DATABASE_URL, REDIS_URL, SENTRY_DSN)
- [x] Branch pinned to `feat/edge-v3`
- [x] Auto-deploy disabled (manual trigger required)

### Frontend Configuration
- [x] `.env.production` includes `/api/v1` suffix in API URL
- [x] `vercel.json` rewrites properly configured
- [x] Security headers enabled (CSP, X-Frame-Options, etc.)
- [x] Cache-Control headers for static assets
- [x] Build command targets `apps/web` directory

### Code Quality
- [x] Next.js production build passes locally
- [x] TypeScript/ESLint warnings resolved
- [x] React Query providers wired in layout
- [x] API client uses consistent base URL
- [x] ARIA attributes and accessibility improvements applied

### Integration
- [x] API URL suffix consistency resolved
- [x] Vercel rewrites align with backend API structure
- [x] CORS configuration allows Vercel domains
- [x] Health endpoints accessible at both root and `/api/v1`

## 🚀 Deployment Sequence

### Phase 1: Backend Deployment to Render

1. **Commit and Push Changes**
   ```powershell
   git add .
   git commit -m "Production readiness: API integration fixes and deployment configs"
   git push origin feat/edge-v3
   ```

2. **Trigger Render Deployment**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Navigate to `sabiscore-api` service
   - Click "Manual Deploy" → Select `feat/edge-v3` branch
   - Monitor build logs for any errors

3. **Verify Backend Health**
   ```powershell
   # Wait for deployment to complete (usually 3-5 minutes)
   curl https://sabiscore-api.onrender.com/health/ready
   
   # Should return:
   # {
   #   "status": "healthy",
   #   "checks": { "database": {...}, "cache": {...}, "models": {...} }
   # }
   ```

4. **Check Render Logs**
   - Verify no startup errors
   - Confirm model loading succeeded
   - Check database connection established

### Phase 2: Frontend Deployment to Vercel

1. **Build Locally First (Safety Check)**
   ```powershell
   cd apps/web
   npm run build
   
   # Should complete without errors
   # Output: "✓ Compiled successfully"
   ```

2. **Deploy to Vercel Production**
   ```powershell
   # From repository root
   vercel --prod
   
   # Follow prompts:
   # ? Set up and deploy? Yes
   # ? Which scope? [Your team/account]
   # ? Link to existing project? Yes (if exists), or No (first time)
   # ? What's your project's name? sabiscore
   ```

3. **Monitor Vercel Deployment**
   - Watch build logs in terminal
   - Check [Vercel Dashboard](https://vercel.com/dashboard)
   - Verify build completes successfully

4. **Verify Frontend Deployment**
   ```powershell
   # Test homepage
   curl https://sabiscore.vercel.app/
   
   # Test API proxy
   curl https://sabiscore.vercel.app/api/v1/health
   ```

### Phase 3: Integration Smoke Tests

Run the automated smoke test suite:
```powershell
.\test_production_smoke.ps1
```

**Expected Results:**
- ✅ Backend health endpoints respond (200 OK)
- ✅ Database and cache connections healthy
- ✅ ML models loaded successfully
- ✅ Frontend homepage loads
- ✅ API proxy through Vercel works
- ✅ CORS headers allow Vercel origin

### Phase 4: Manual UI Testing

1. **Visit Production Site**: https://sabiscore.vercel.app

2. **Test Match Selector**
   - Select league (EPL, La Liga, etc.)
   - Use team autocomplete (local or API-backed)
   - Select home and away teams
   - Click "Generate Insights"

3. **Verify Insights Generation**
   - Check loading states display correctly
   - Confirm insights render with:
     - Prediction probabilities (Home/Draw/Away)
     - XG analysis
     - Value bets (if any)
     - Confidence score
   - Verify no API errors in browser console

4. **Check Error Handling**
   - Test with invalid team combinations
   - Verify graceful error messages
   - Confirm no unhandled exceptions

## 🔍 Post-Deployment Monitoring

### Immediate Checks (First 30 Minutes)

1. **Sentry Dashboard**
   - Check for any new errors
   - Verify error rate is stable
   - Monitor performance metrics

2. **Render Metrics**
   - CPU and memory usage within normal range
   - Response times < 500ms for health checks
   - No failed requests or 5xx errors

3. **Vercel Analytics**
   - Build and deployment status green
   - No failed function invocations
   - Edge network responding correctly

### Continuous Monitoring (First 24 Hours)

- **Health Checks**: Automated every 5 minutes (Render orchestration)
- **Error Tracking**: Sentry alerts for any exceptions
- **Performance**: Response times and throughput via Render/Vercel dashboards
- **User Reports**: Monitor for any user-reported issues

## 🐛 Troubleshooting Guide

### Backend Issues

**Symptom**: `/health/ready` returns 503
- **Check**: Render logs for startup errors
- **Fix**: Verify DATABASE_URL env var set correctly
- **Verify**: Models loaded successfully (check `ml_models` status)

**Symptom**: API requests timeout
- **Check**: Render service status (may be spinning down on free tier)
- **Fix**: Send request to wake service (first request after idle takes 30s)
- **Workaround**: Upgrade to paid tier for persistent instances

**Symptom**: Model loading fails
- **Check**: `SKIP_S3` flag and `MODEL_BASE_URL` configuration
- **Fix**: Ensure model artifacts exist in Render persistent disk or S3
- **Fallback**: Set `SKIP_S3=true` to use pre-bundled models

### Frontend Issues

**Symptom**: API calls fail with CORS error
- **Check**: Vercel domain in backend CORS_ORIGINS env var
- **Fix**: Add Vercel preview/production domains to allowed origins
- **Verify**: Preflight OPTIONS request succeeds

**Symptom**: Rewrites not working (API 404)
- **Check**: `vercel.json` rewrite rules syntax
- **Fix**: Ensure destination URL matches Render backend exactly
- **Test**: Use `curl -v` to see redirect chain

**Symptom**: Build fails on Vercel
- **Check**: Build logs for specific error
- **Fix**: Verify all dependencies in `package.json`
- **Common**: Missing env vars (add to Vercel dashboard)

## 📊 Success Metrics

### Deployment Success
- ✅ Backend deploys without errors
- ✅ Frontend build completes in < 5 minutes
- ✅ All health checks pass
- ✅ Integration smoke tests 100% success rate

### Performance Targets
- 🎯 Backend response time: < 500ms (p95)
- 🎯 Frontend FCP: < 1.8s
- 🎯 Frontend LCP: < 2.5s
- 🎯 Prediction generation: < 5s

### Reliability Targets
- 🎯 Uptime: > 99.5%
- 🎯 Error rate: < 1%
- 🎯 API success rate: > 98%

## 📚 Reference Documents

- **Architecture**: `ARCHITECTURE_V3.md`
- **Backend Setup**: `BACKEND_SETUP_GUIDE.md`
- **Integration Status**: `API_INTEGRATION_STATUS.md`
- **Deployment Runbook**: `PRODUCTION_DEPLOY_RUNBOOK.md`
- **Production Hardening**: `PRODUCTION_HARDENING_NOV21.md`

## 🎉 Launch Confirmation

Once all checks pass:

1. ✅ Backend deployed and healthy
2. ✅ Frontend deployed and accessible
3. ✅ API integration working end-to-end
4. ✅ Smoke tests passing
5. ✅ Manual UI testing successful
6. ✅ Monitoring active (Sentry, Render, Vercel)

**Status**: 🚀 **PRODUCTION READY - CLEARED FOR LAUNCH**

---

**Deployment Date**: _[To be filled on deployment]_  
**Deployed By**: _[Your name]_  
**Backend Version**: `feat/edge-v3` @ _[commit hash]_  
**Frontend Version**: `main` @ _[commit hash]_  
**Render Service**: https://sabiscore-api.onrender.com  
**Vercel Deployment**: https://sabiscore.vercel.app
