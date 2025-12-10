# SabiScore 3.0 Production Deployment Guide

## 🚀 Complete Vercel Deployment (100% Free Tier)

This guide covers deploying SabiScore 3.0 to Vercel's free tier with all features enabled.

---

## Prerequisites

- [x] GitHub account
- [x] Vercel account (free tier)
- [x] Odds API key (free tier: 500 req/month)
- [x] Basic understanding of Next.js and Edge Functions

---

## Step 1: Prepare Repository

### 1.1 Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Required
ODDS_API_KEY=your_odds_api_key_here
CRON_SECRET=$(openssl rand -base64 32)

# Optional (pre-filled)
NEXT_PUBLIC_API_URL=https://sabiscore-api.onrender.com
NEXT_PUBLIC_CURRENCY=NGN
NEXT_PUBLIC_BASE_BANKROLL=10000
```

### 1.2 Get Odds API Key

1. Visit https://the-odds-api.com/
2. Sign up for free tier (500 requests/month)
3. Copy API key to `.env.local`

### 1.3 Commit Changes

```bash
git add .
git commit -m "feat: complete ML extensions and betting integration"
git push origin main
```

---

## Step 2: Deploy to Vercel

### 2.1 Connect Repository

1. Visit https://vercel.com/new
2. Import your GitHub repository
3. Select `SabiScore` project

### 2.2 Configure Build Settings

Vercel should auto-detect Next.js. Verify:

- **Framework Preset:** Next.js
- **Build Command:** `cd apps/web && npm run build`
- **Output Directory:** `apps/web/.next`
- **Install Command:** `npm install`
- **Node Version:** 18.x or 20.x

### 2.3 Set Environment Variables

In Vercel project settings → Environment Variables, add:

```
ODDS_API_KEY=your_odds_api_key_here
CRON_SECRET=your_generated_secret
NEXT_PUBLIC_API_URL=https://sabiscore-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://sabiscore-api.onrender.com
NEXT_PUBLIC_CURRENCY=NGN
NEXT_PUBLIC_CURRENCY_SYMBOL=₦
NEXT_PUBLIC_BASE_BANKROLL=10000
NEXT_PUBLIC_KELLY_FRACTION=0.125
NEXT_PUBLIC_MIN_EDGE_NGN=66
```

Set all variables for **Production**, **Preview**, and **Development**.

### 2.4 Deploy

Click **Deploy**. Vercel will:

1. Install dependencies
2. Build Next.js app with Turbopack
3. Deploy to Edge Network
4. Set up automatic HTTPS

---

## Step 3: Verify Deployment

### 3.1 Check Health Endpoint

Visit `https://your-app.vercel.app/api/health`:

```json
{
  "status": "healthy",
  "metrics": {
    "accuracy": 0,
    "brierScore": 0,
    "roi": 0,
    "predictionCount": 0
  },
  "issues": ["Insufficient data (< 50 predictions)"],
  "lastUpdate": "2024-12-07T12:00:00.000Z",
  "timestamp": "2024-12-07T12:00:00.000Z"
}
```

### 3.2 Test Prediction API

```bash
curl -X GET https://your-app.vercel.app/api/predict
```

Expected response:

```json
{
  "status": "ready",
  "models": {
    "dense": { "loaded": true, "inputShape": [null, 48] },
    "lstm": { "loaded": true, "inputShape": [null, 10, 4] },
    "cnn": { "loaded": true, "inputShape": [null, 12, 8, 2] }
  },
  "timestamp": "2024-12-07T12:00:00.000Z"
}
```

### 3.3 Test Odds API

```bash
curl https://your-app.vercel.app/api/odds/odds-api?sport=soccer_epl
```

### 3.4 Check Metrics

Visit `https://your-app.vercel.app/api/metrics`

---

## Step 4: Enable Cron Jobs

### 4.1 Verify vercel.json

Ensure `vercel.json` contains:

```json
{
  "crons": [
    {
      "path": "/api/cron/drift-check",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/update-odds",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

### 4.2 Cron Schedule Explanation

- **Drift Check:** Every 6 hours (`0 */6 * * *`)
- **Update Odds:** Every 30 minutes (`*/30 * * * *`)

### 4.3 Verify Cron Security

Cron routes check `Authorization: Bearer ${CRON_SECRET}` header.

Test manually:

```bash
curl -H "Authorization: Bearer your_cron_secret" \
  https://your-app.vercel.app/api/cron/drift-check
```

---

## Step 5: Monitor Performance

### 5.1 Vercel Analytics

1. Go to Vercel project → Analytics
2. Enable Web Analytics (free)
3. Monitor:
   - Page views
   - Core Web Vitals
   - Edge function performance

### 5.2 Application Monitoring

Visit `/api/health` regularly:

- **Healthy:** Accuracy ≥65%, Brier ≤0.25, ROI >0%
- **Degraded:** 50% ≤ Accuracy < 65%, 0.20 < Brier ≤ 0.25
- **Critical:** Accuracy < 50%, Brier > 0.25, ROI < -5%

### 5.3 Drift Detection

Check `/api/drift` for model performance:

- **None:** No action needed
- **Low:** Monitor closely
- **Medium:** Plan retraining within 1 week
- **High:** Retrain within 24 hours
- **Critical:** Immediate retraining required

---

## Step 6: Production Checklist

- [ ] Environment variables set in Vercel
- [ ] HTTPS enabled (automatic)
- [ ] Cron jobs scheduled
- [ ] Health endpoint returns 200
- [ ] Prediction API returns model info
- [ ] Odds API returns data
- [ ] Metrics tracking initialized
- [ ] Domain configured (optional)

---

## Architecture Overview

### Edge Functions (Vercel Edge Runtime)

- `/api/predict` - TensorFlow.js ensemble inference
- `/api/odds/*` - Multi-source odds aggregation
- `/api/health` - System health check
- `/api/metrics` - Rolling performance metrics
- `/api/drift` - Model drift detection

### Cron Jobs (Vercel Cron)

- Drift check every 6 hours
- Odds update every 30 minutes

### Storage

- **IndexedDB:** Model weights (browser)
- **localStorage:** Monitoring data (browser)
- **Vercel KV:** (Optional) Centralized storage

---

## Resource Limits (Free Tier)

### Vercel

- **Bandwidth:** 100 GB/month
- **Invocations:** 100,000/month (Edge functions)
- **Execution Duration:** 10s per invocation
- **Cron Jobs:** 2 jobs (drift + odds)

### Odds API

- **Requests:** 500/month (~16/day)
- **Update Frequency:** Every 30 min = 48/day
- **Solution:** Cache odds for 5 min (reduces to ~16/day)

### StatsBomb Open Data

- **Requests:** Unlimited (GitHub-hosted)
- **Matches:** 10,000+ historical matches
- **Cost:** $0

### FBref Scraping

- **Requests:** Unlimited (public website)
- **Rate Limit:** Respect robots.txt
- **Cost:** $0

---

## Optimization Tips

### 1. Reduce Odds API Calls

Current implementation caches odds for 5 minutes:

```typescript
private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

Increase to 15 minutes for lower usage:

```typescript
private readonly CACHE_TTL = 15 * 60 * 1000;
```

### 2. Model Caching

Models persist to IndexedDB:

- Dense: `indexeddb://sabiscore-dense-model`
- LSTM: `indexeddb://sabiscore-lstm-model`
- CNN: `indexeddb://sabiscore-cnn-model`

No redownload on page refresh.

### 3. Edge Function Optimization

- Models load on first request (cold start: ~2-3s)
- Subsequent requests: <100ms
- Keep functions warm with periodic health checks

---

## Troubleshooting

### Models Not Loading

**Error:** `Model not initialized`

**Solution:**

1. Check browser console for IndexedDB errors
2. Clear IndexedDB: Dev Tools → Application → IndexedDB
3. Reload page to retrain

### Odds API 429 (Rate Limit)

**Error:** `Failed to fetch odds from odds-api`

**Solution:**

1. Increase cache TTL (see Optimization Tips)
2. Reduce cron frequency to `0 */2 * * *` (every 2 hours)
3. Consider upgrading to paid tier (10,000 req/month for $9)

### Cron Jobs Not Running

**Error:** No cron executions in Vercel logs

**Solution:**

1. Verify `vercel.json` is in project root
2. Redeploy after adding cron configuration
3. Check Vercel project settings → Cron Jobs

### Drift Detection Shows "Insufficient data"

**Error:** `Insufficient baseline data. Need 100+ predictions.`

**Solution:**

1. Make 100+ predictions with actual outcomes
2. Use `/api/metrics` to track progress
3. Baseline sets automatically after 100 predictions

---

## Production Monitoring

### Daily Checks

1. Visit `/api/health` - Verify status = "healthy"
2. Check Vercel Analytics - Monitor traffic spikes
3. Review `/api/drift` - Ensure no critical drift

### Weekly Tasks

1. Review `/api/metrics` - Track accuracy trends
2. Analyze betting ROI - Verify positive returns
3. Check Odds API usage - Stay under 500/month limit

### Monthly Maintenance

1. Review model performance - Consider retraining
2. Audit cron job executions - Verify schedules
3. Optimize odds cache TTL - Balance freshness vs limits

---

## Next Steps

1. **Custom Domain:** Add your domain in Vercel settings
2. **Analytics:** Enable Vercel Web Analytics (free)
3. **Monitoring:** Set up uptime monitoring (UptimeRobot free)
4. **Retraining:** Implement automated retraining with fresh data
5. **UI Polish:** Add loading states, error boundaries, animations

---

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **TensorFlow.js:** https://www.tensorflow.org/js
- **StatsBomb:** https://github.com/statsbomb/open-data
- **Odds API:** https://the-odds-api.com/liveapi/guides/v4/

---

## License

MIT License - See LICENSE file for details
