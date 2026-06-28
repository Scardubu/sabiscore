# 🚀 SabiScore 3.0 - Production Deployment Guide

**Last Updated**: December 10, 2025  
**Status**: PRODUCTION READY ✅

## ✅ Pre-Configured Environment Variables

The following environment variables have been configured in `.env.local`:

| Variable | Value | Status |
|----------|-------|--------|
| `CRON_SECRET` | `<set-in-secret-store>` | ✅ Set |
| `WARMUP_SECRET` | `<set-in-secret-store>` | ✅ Set |
| `FOOTBALL_DATA_API_KEY` | `<set-in-provider-secret-store>` | ✅ Set |
| `ODDS_API_KEY` | `<set-in-provider-secret-store>` | ✅ Set |
| `REDIS_URL` | `redis://default:<password>@<host>:<port>` | ✅ Set |
| `NEXT_PUBLIC_API_URL` | `https://sabiscore-api.onrender.com` | ✅ Set |
| `NEXT_PUBLIC_CURRENCY` | `NGN` | ✅ Set |
| `ALERT_WEBHOOK_URL` | *(Optional - set your Discord/Slack webhook)* | ⏳ Optional |

## 🔴 Redis Cloud Integration

Redis Cloud is configured for production caching:

```
Host: <your-redis-host>
Port: <your-redis-port>
Username: default
Password: <set-in-secret-store>
```

### Redis Health Check Endpoint
- **URL**: `/api/health/redis`
- **Purpose**: Verify Redis Cloud connection status

### Cached Data
| Cache Key | TTL | Description |
|-----------|-----|-------------|
| `sabiscore:matches:upcoming` | 30 min | Upcoming match schedules |
| `sabiscore:odds:*` | 30 min | Match odds data |
| `sabiscore:prediction:*` | 1 hour | Prediction results |
| `sabiscore:metrics:current` | 1 min | Aggregated metrics |
| `sabiscore:drift:report` | 6 hours | Drift detection reports |

## 📋 Pre-Deployment Checklist

### Environment Variables Setup

Run the verification script first:
```powershell
.\verify_production_env.ps1
```

#### Required Variables (Must Set in Vercel Dashboard):
- [x] **CRON_SECRET** - `<set-in-secret-store>`
- [x] **WARMUP_SECRET** - `<set-in-secret-store>`
- [x] **FOOTBALL_DATA_API_KEY** - `<set-in-provider-secret-store>`
- [x] **REDIS_URL** - `redis://default:<password>@<host>:<port>`
- [ ] **ALERT_WEBHOOK_URL** - Discord/Slack webhook for drift alerts *(Optional)*

#### Optional But Recommended:
- [x] **NEXT_PUBLIC_BASE_BANKROLL** - 10000
- [x] **NEXT_PUBLIC_KELLY_FRACTION** - 0.125

### Code Verification
- [ ] All tests passing (`npm run test`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)

### Performance Optimizations Verified
- [x] Webpack chunking configured in `next.config.js`
- [x] Security headers enabled (CSP, XSS-Protection, etc.)
- [x] Resource hints in `layout.tsx` (preconnect, dns-prefetch)
- [x] Model warmup endpoint created (`/api/warmup`)
- [x] Metrics aggregation endpoint enhanced (`/api/metrics`)
- [x] Redis Cloud caching for matches and odds

---

## 🔧 Deployment Steps

### 1. Install Vercel CLI (if not already installed)
```powershell
npm install -g vercel
```

### 2. Link Project to Vercel
```powershell
# Navigate to project root
cd c:\Users\USR\Documents\SabiScore

# Link to Vercel project
vercel link
```

### 3. Set Environment Variables in Vercel

#### Option A: Using Vercel CLI
```powershell
# Set CRON_SECRET
vercel env add CRON_SECRET production
# Paste: <set-in-secret-store>

# Set WARMUP_SECRET
vercel env add WARMUP_SECRET production
# Paste: <set-in-secret-store>

# Set Redis URL
vercel env add REDIS_URL production
# Paste: redis://default:<password>@<host>:<port>

# Set Football Data API key
vercel env add FOOTBALL_DATA_API_KEY production
# Paste: <set-in-provider-secret-store>

# Set Odds API key (optional)
vercel env add ODDS_API_KEY production
# Paste: <set-in-provider-secret-store>

# (Optional) Set webhook URL for alerts
vercel env add ALERT_WEBHOOK_URL production
# Paste your Discord/Slack webhook URL
```

#### Option B: Using Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add each variable with scope: Production, Preview, Development

### 4. Deploy to Production
```powershell
# Deploy to production
vercel --prod

# Wait for deployment to complete
# Note the deployment URL
```

### 5. Verify Deployment

Run verification against production URL:
```powershell
.\verify_production_env.ps1 -Url "https://your-app.vercel.app"
```

Manual endpoint tests:
```powershell
$BASE_URL = "https://your-app.vercel.app"
$CRON_SECRET = "your_cron_secret_here"

# Test health endpoint
curl "$BASE_URL/api/health"

# Test metrics endpoint
curl "$BASE_URL/api/metrics"

# Test warmup endpoint
curl "$BASE_URL/api/warmup"

# Test drift endpoint
curl "$BASE_URL/api/drift"

# Test cron endpoints (requires CRON_SECRET)
curl "$BASE_URL/api/cron/drift-check?secret=$CRON_SECRET"
curl "$BASE_URL/api/cron/update-odds?secret=$CRON_SECRET"
```

---

## 🔍 Post-Deployment Verification

### 1. Frontend Verification
- [ ] Homepage loads (<2s)
- [ ] Team autocomplete search works
- [ ] Fuzzy matching returns results
- [ ] Recent teams are saved
- [ ] Prediction form submits successfully
- [ ] Monitoring dashboard displays data
- [ ] Export button works (JSON/CSV)
- [ ] Dark/light theme toggle works

### 2. API Verification
- [ ] `/api/health` returns 200
- [ ] `/api/metrics` returns aggregated data
- [ ] `/api/drift` returns drift statistics
- [ ] `/api/warmup` (GET) works with cooldown
- [ ] `/api/monitoring/export?format=json` downloads file
- [ ] `/api/monitoring/export?format=csv` downloads file

### 3. Cron Job Verification
- [ ] Drift check cron executes (check Vercel logs)
- [ ] Odds update cron executes (check Vercel logs)
- [ ] Webhook alerts send to Discord/Slack
- [ ] Football-data.org API returns matches

### 4. Performance Verification
```powershell
# Check bundle size
curl "https://your-app.vercel.app/_next/static/chunks/tensorflow.*.js" -I
curl "https://your-app.vercel.app/_next/static/chunks/radix-ui.*.js" -I

# Check response times
Measure-Command { curl "https://your-app.vercel.app/api/health" }
Measure-Command { curl "https://your-app.vercel.app/api/metrics" }
Measure-Command { curl "https://your-app.vercel.app/api/warmup" }
```

Expected:
- Health: <100ms
- Metrics: <200ms (aggregates 3 endpoints)
- Warmup: <1500ms (first run), <100ms (cached)

### 5. Security Verification
- [ ] CSP header present (`Content-Security-Policy`)
- [ ] XSS protection enabled (`X-XSS-Protection: 1; mode=block`)
- [ ] Frame options set (`X-Frame-Options: DENY`)
- [ ] HTTPS redirect works
- [ ] Cron endpoints require `secret` parameter

---

## 📊 Monitoring Setup

### 1. Vercel Dashboard Monitoring
- Go to your project → Analytics
- Monitor:
  - Function invocations
  - Edge network requests
  - Build duration
  - Error rate

### 2. Webhook Alert Testing

Test webhook manually:
```powershell
$WEBHOOK_URL = "your_webhook_url_here"

# Test Discord/Slack webhook
$body = @{
    embeds = @(
        @{
            title = "🧪 Test Alert - SabiScore Deployment"
            description = "Testing webhook integration after production deployment"
            color = 5814783
            fields = @(
                @{ name = "Status"; value = "Deployment Verified"; inline = $true },
                @{ name = "Timestamp"; value = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"); inline = $true }
            )
            footer = @{ text = "SabiScore 3.0 Production" }
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri $WEBHOOK_URL -Method Post -Body $body -ContentType "application/json"
```

### 3. Set Up Alerts

Configure Vercel Notifications:
1. Project Settings → Notifications
2. Enable:
   - Deployment Failed
   - Deployment Ready
   - Function Error Rate Spike

---

## 🐛 Troubleshooting

### Issue: Cron jobs not executing

**Symptoms**: No drift checks or odds updates in logs

**Check**:
```powershell
# Verify CRON_SECRET is set
vercel env ls

# Check Vercel cron logs
# Dashboard → Deployments → [Latest] → Functions → Search "cron"
```

**Fix**:
1. Ensure `CRON_SECRET` is set in all environments
2. On Hobby plans, run frequent schedules via GitHub Actions (`.github/workflows/keep_alive.yml`)
3. If using Pro/Enterprise Vercel cron, configure cron entries in `apps/web/vercel.json` and redeploy

---

### Issue: Webhook alerts not sending

**Symptoms**: No Discord/Slack messages on drift

**Check**:
```powershell
# Test webhook URL
curl -X POST "your_webhook_url" -H "Content-Type: application/json" -d '{"content":"Test"}'
```

**Fix**:
1. Verify `ALERT_WEBHOOK_URL` format:
   - Discord: `https://discord.com/api/webhooks/{id}/{token}`
   - Slack: `https://hooks.slack.com/services/{T}/{B}/{...}`
2. Check drift threshold is exceeded (≥5% for alerts)
3. Review function logs for errors

---

### Issue: Model warmup timing out

**Symptoms**: 504 timeout on `/api/warmup`

**Check**:
```powershell
# Check function timeout setting
# Dashboard → Settings → Functions → Max Duration
```

**Fix**:
1. Increase function timeout to 30s (current: 30s in route.ts)
2. Verify TensorFlow.js models are accessible
3. Check IndexedDB has cached models:
   - Open browser DevTools → Application → IndexedDB → tensorflowjs

---

### Issue: Large bundle size

**Symptoms**: Slow initial page load

**Check**:
```powershell
# Analyze bundle
cd apps/web
npm run build
# Check .next/analyze output
```

**Fix**:
1. Verify webpack chunking in `next.config.js`:
   - `tensorflow` chunk (priority 40)
   - `radix-ui` chunk (priority 35)
   - `charts` chunk (priority 30)
2. Ensure dynamic imports for heavy components:
```typescript
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  ssr: false,
  loading: () => <Spinner />
})
```

---

### Issue: Football-data.org API rate limit

**Symptoms**: No upcoming matches returned

**Check**:
```powershell
# Test API directly
$API_KEY = "your_api_key"
curl "https://api.football-data.org/v4/matches" -H "X-Auth-Token: $API_KEY"
```

**Fix**:
1. Check rate limits: 10 req/min (free tier)
2. Increase cache TTL in `/api/cron/update-odds` (current: 30 min)
3. Use fallback mode: Remove `FOOTBALL_DATA_API_KEY` env var

---

## 📈 Performance Optimization

### Bundle Analysis

Add to `apps/web/package.json`:
```json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^15.5.6"
  }
}
```

Run analysis:
```powershell
cd apps/web
npm install --save-dev @next/bundle-analyzer
npm run analyze
```

### Lighthouse Audit

Run production audit:
```powershell
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://your-app.vercel.app --view
```

Target scores:
- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: ≥90

---

## 🔄 Continuous Deployment

### Automatic Deployments

Vercel automatically deploys on:
- **Push to `main`** → Production deployment
- **Pull request** → Preview deployment
- **Push to branch** → Development deployment

### Manual Deployments

Force redeploy without code changes:
```powershell
# Redeploy latest production
vercel --prod

# Redeploy specific deployment
vercel deploy --prod
```

---

## 📝 Environment Variable Reference

See [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) for comprehensive documentation.

### Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_SECRET` | ✅ Yes | - | Authenticates cron requests |
| `ALERT_WEBHOOK_URL` | ⚠️ Recommended | - | Discord/Slack webhook |
| `FOOTBALL_DATA_API_KEY` | ⚠️ Recommended | - | Upcoming matches API |
| `WARMUP_SECRET` | ⚠️ Optional | - | Forced warmup auth |
| `NEXT_PUBLIC_BASE_BANKROLL` | ❌ No | 10000 | Starting bankroll |
| `NEXT_PUBLIC_KELLY_FRACTION` | ❌ No | 0.125 | Kelly fraction |
| `NEXT_PUBLIC_MIN_EDGE_NGN` | ❌ No | 66 | Minimum edge |

---

## ✅ Production Readiness Checklist

### Code Quality
- [x] Webhook alerts for drift detection
- [x] Football-data.org API integration
- [x] Enhanced team autocomplete with fuzzy search
- [x] Monitoring data export (JSON/CSV)
- [x] Webpack chunk splitting
- [x] Security headers (CSP, XSS-Protection)
- [x] Model warmup endpoint
- [x] Aggregated metrics endpoint
- [x] Resource hints (preconnect, dns-prefetch)

### Configuration
- [ ] Environment variables set in Vercel
- [ ] Cron secrets generated and secured
- [ ] Webhook URLs configured
- [ ] API keys obtained and set

### Testing
- [ ] Local build succeeds
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Verification script passes

### Deployment
- [ ] Vercel project linked
- [ ] Production deployment successful
- [ ] All endpoints responding
- [ ] Cron jobs executing
- [ ] Webhook alerts working

1. On Hobby plans, run frequent schedules through GitHub Actions (`.github/workflows/keep_alive.yml`)
2. If using Pro/Enterprise Vercel cron, configure cron entries in `apps/web/vercel.json` and redeploy
Your deployment is production-ready when:

1. ✅ `verify_production_env.ps1` passes with 0 failures
2. ✅ All API endpoints return 200 status
3. ✅ Cron jobs execute on schedule
4. ✅ Webhook alerts deliver to Discord/Slack
5. ✅ Frontend loads in <2s
6. ✅ Model predictions complete in <1.5s
7. ✅ Bundle size <5MB (initial load)
8. ✅ Lighthouse performance score ≥90

---

## 📚 Additional Resources

- **Architecture Documentation**: [`ARCHITECTURE_V3.md`](./ARCHITECTURE_V3.md)
- **Environment Setup**: [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md)
- **Quick Reference**: [`DEVELOPER_QUICKREF.md`](./DEVELOPER_QUICKREF.md)
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Discord Webhooks**: https://discord.com/developers/docs/resources/webhook
- **Football-data.org API**: https://www.football-data.org/documentation/quickstart

---

**Last Updated**: December 10, 2025  
**Version**: 3.0 Production  
**Status**: ✅ Ready for Deployment
