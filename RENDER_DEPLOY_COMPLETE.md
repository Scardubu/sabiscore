# Render Deployment Guide for Sabiscore FastAPI Backend

## Overview
Deploy Sabiscore's FastAPI backend to Render with zero-downtime, auto-scaling, and production-grade monitoring.

**Target Performance:**
- **TTFB**: <150ms (p92)
- **Concurrency**: 10,000 CCU
- **Uptime**: 99.94%
- **Auto-scaling**: 2-12 instances

---

## Prerequisites

1. **Render Account**: [Sign up](https://render.com/register)
2. **GitHub Repository**: `https://github.com/Scardubu/sabiscore`
3. **PostgreSQL**: Render PostgreSQL (or external)
4. **Redis**: Upstash Redis or Render Redis
5. **Model Storage**: AWS S3 or Render Static Files

---

## Step 1: Create `render.yaml`

Create this file in the repository root:

```yaml
# render.yaml
services:
  # FastAPI Backend
  - type: web
    name: sabiscore-api
    runtime: python
    region: frankfurt  # or oregon, singapore
    plan: standard  # $25/mo, autoscaling
    branch: feat/edge-v3
    buildCommand: |
      cd backend
      pip install --upgrade pip
      pip install -r requirements.txt
      python -m nltk.downloader punkt
    startCommand: |
      cd backend
      gunicorn src.api.main:app \
        --workers 4 \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:$PORT \
        --timeout 120 \
        --keep-alive 5 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --access-logfile - \
        --error-logfile -
    healthCheckPath: /api/v1/health
    autoDeploy: true
    envVars:
      - key: PYTHON_VERSION
        value: "3.11"
      - key: DATABASE_URL
        fromDatabase:
          name: sabiscore-db
          property: connectionString
      - key: REDIS_URL
        sync: false  # Set manually from Upstash
      - key: MODEL_BASE_URL
        value: https://sabiscore-models.s3.eu-central-1.amazonaws.com
      - key: SECRET_KEY
        generateValue: true
      - key: ENVIRONMENT
        value: production
      - key: LOG_LEVEL
        value: INFO
      - key: SENTRY_DSN
        sync: false  # Optional monitoring
      - key: ALLOW_ORIGINS
        value: https://sabiscore.vercel.app,https://www.sabiscore.io
      - key: KELLY_FRACTION
        value: "0.125"
      - key: MIN_EDGE_NGN
        value: "66"
      - key: BASE_BANKROLL_NGN
        value: "10000"

  # WebSocket Server (separate for connection management)
  - type: web
    name: sabiscore-ws
    runtime: python
    region: frankfurt
    plan: starter  # $7/mo
    branch: feat/edge-v3
    buildCommand: |
      cd backend
      pip install -r requirements.txt
    startCommand: |
      cd backend
      uvicorn src.websocket.main:app \
        --host 0.0.0.0 \
        --port $PORT \
        --ws-ping-interval 20 \
        --ws-ping-timeout 20
    healthCheckPath: /ws/health
    autoDeploy: true
    envVars:
      - key: REDIS_URL
        sync: false
      - key: ENVIRONMENT
        value: production

  # Background Worker (Celery for calibration loop)
  - type: worker
    name: sabiscore-worker
    runtime: python
    region: frankfurt
    plan: starter
    branch: feat/edge-v3
    buildCommand: |
      cd backend
      pip install -r requirements.txt
    startCommand: |
      cd backend
      celery -A src.tasks.celery_app worker \
        --loglevel=info \
        --concurrency=4 \
        --max-tasks-per-child=100
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: sabiscore-db
          property: connectionString
      - key: REDIS_URL
        sync: false
      - key: MODEL_BASE_URL
        value: https://sabiscore-models.s3.eu-central-1.amazonaws.com

databases:
  - name: sabiscore-db
    databaseName: sabiscore_production
    user: sabiscore
    region: frankfurt
    plan: standard  # $20/mo, 1GB RAM, 10GB storage
    ipAllowList:  # Empty = allow all (for Render services)
      - source: 0.0.0.0/0
        description: Allow all Render services

  - name: sabiscore-redis
    plan: starter  # $10/mo (or use Upstash for better latency)
    maxmemoryPolicy: allkeys-lru
    region: frankfurt
```

---

## Step 2: Set Up PostgreSQL

### Option A: Render PostgreSQL (Recommended for simplicity)
1. Database is auto-created from `render.yaml`
2. Connection string auto-injected as `DATABASE_URL`

### Option B: External PostgreSQL (Better performance)
1. Use AWS RDS, DigitalOcean, or Supabase
2. Set `DATABASE_URL` manually in Render dashboard:
   ```
   postgresql://user:password@host:5432/sabiscore_production
   ```

### Run Migrations
```bash
# After first deploy, run migrations via Render Shell
render shell sabiscore-api
cd backend
alembic upgrade head
python scripts/seed_data.py  # Optional: seed initial data
```

---

## Step 3: Set Up Redis

### Option A: Upstash Redis (Recommended for <8ms latency)
1. Create database at [Upstash](https://console.upstash.com/)
2. Choose **Frankfurt** region (match Render)
3. Copy connection string:
   ```
   redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379
   ```
4. Set `REDIS_URL` in Render dashboard

### Option B: Render Redis
- Auto-created from `render.yaml` (higher latency ~15ms)

---

## Step 4: Model Storage Setup

### Store Models in AWS S3
```bash
# Upload models to S3
aws s3 cp backend/models/epl_ensemble.pkl \
  s3://sabiscore-models/v3/epl_ensemble.pkl --acl public-read

aws s3 cp backend/models/bundesliga_ensemble.pkl \
  s3://sabiscore-models/v3/bundesliga_ensemble.pkl --acl public-read
```

### Set Model Base URL
```env
MODEL_BASE_URL=https://sabiscore-models.s3.eu-central-1.amazonaws.com/v3
```

Backend will auto-download models on startup.

---

## Step 5: Deploy to Render

### Method 1: Via Dashboard
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Blueprint**
3. Connect GitHub repo: `Scardubu/sabiscore`
4. Select branch: `feat/edge-v3`
5. Render detects `render.yaml` automatically
6. Click **Apply** → Wait 5-10 minutes

### Method 2: Via CLI
```bash
# Install Render CLI
brew install render  # macOS
# or
curl -fsSL https://render.com/install-cli.sh | sh

# Deploy
render blueprint deploy \
  --repo https://github.com/Scardubu/sabiscore \
  --branch feat/edge-v3
```

---

## Step 6: Verify Deployment

### Health Check
```bash
curl https://sabiscore-api.onrender.com/api/v1/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-11-11T14:32:00Z",
  "version": "3.0",
  "database": "connected",
  "redis": "connected",
  "models_loaded": true,
  "uptime_seconds": 3847
}
```

### Performance Test
```bash
# TTFB test (target: <150ms)
curl -w "\nTime: %{time_total}s\n" \
  https://sabiscore-api.onrender.com/api/v1/matches/upcoming

# Load test (10k requests, 100 concurrent)
ab -n 10000 -c 100 \
  https://sabiscore-api.onrender.com/api/v1/health
```

---

## Step 7: Auto-Scaling Configuration

### Edit Service in Dashboard
1. Go to **sabiscore-api** service
2. Click **Settings** → **Scaling**
3. Configure:
   ```
   Min Instances: 2
   Max Instances: 12
   CPU Threshold: 70%
   Memory Threshold: 80%
   Scale Up After: 2 minutes
   Scale Down After: 10 minutes
   ```

---

## Step 8: Monitoring & Alerts

### Option A: Render Metrics (Built-in)
- Dashboard shows CPU, memory, response time
- Set up alerts in **Notifications**

### Option B: Sentry (Recommended)
```python
# backend/src/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    integrations=[FastApiIntegration()],
    environment="production"
)
```

Set `SENTRY_DSN` in Render env vars.

### Option C: Prometheus + Grafana (Advanced)
Deploy separate monitoring stack:
```yaml
# Add to render.yaml
  - type: web
    name: sabiscore-prometheus
    runtime: docker
    dockerfilePath: ./monitoring/Dockerfile.prometheus
    plan: starter
```

---

## Step 9: Custom Domain Setup

### Add Custom Domain
1. In Render dashboard, go to **sabiscore-api**
2. Click **Settings** → **Custom Domains**
3. Add: `api.sabiscore.io`
4. Add DNS records (provided by Render):
   ```
   CNAME api -> sabiscore-api.onrender.com
   ```
5. SSL auto-provisioned via Let's Encrypt

### Update Frontend
```env
# In Vercel project settings
NEXT_PUBLIC_API_URL=https://api.sabiscore.io
NEXT_PUBLIC_WS_URL=wss://ws.sabiscore.io
```

---

## Step 10: CI/CD Pipeline

### GitHub Actions Integration
```yaml
# .github/workflows/deploy-render.yml
name: Deploy to Render

on:
  push:
    branches: [feat/edge-v3, main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Trigger Render Deploy
        run: |
          curl -X POST \
            https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }} \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}"
      
      - name: Wait for Deploy
        run: sleep 120
      
      - name: Health Check
        run: |
          STATUS=$(curl -s https://sabiscore-api.onrender.com/api/v1/health | jq -r '.status')
          if [ "$STATUS" != "healthy" ]; then
            echo "Deploy failed health check"
            exit 1
          fi
```

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection | `postgresql://...` |
| `REDIS_URL` | ✅ | Redis connection | `redis://...` |
| `MODEL_BASE_URL` | ✅ | Model storage URL | `https://s3...` |
| `SECRET_KEY` | ✅ | JWT signing key | Auto-generated |
| `ALLOW_ORIGINS` | ✅ | CORS origins | `https://sabiscore.io` |
| `SENTRY_DSN` | ❌ | Error tracking | `https://...` |
| `LOG_LEVEL` | ❌ | Logging verbosity | `INFO` (default) |
| `KELLY_FRACTION` | ❌ | Kelly criterion | `0.125` (⅛ Kelly) |
| `MIN_EDGE_NGN` | ❌ | Min edge threshold | `66` (₦66) |

---

## Troubleshooting

### Issue: Slow Response Times (>150ms)
**Solution:**
1. Check Redis connection: `redis-cli -u $REDIS_URL ping`
2. Enable connection pooling in `src/core/database.py`
3. Add database indexes: `CREATE INDEX idx_match_kickoff ON matches(kickoff_time);`
4. Scale up to more instances

### Issue: Out of Memory
**Solution:**
1. Upgrade plan: **Standard Plus** ($85/mo, 4GB RAM)
2. Reduce model size: Use quantized models
3. Enable model lazy loading

### Issue: WebSocket Disconnects
**Solution:**
1. Increase ping interval in `uvicorn` command
2. Use separate WS service (already in `render.yaml`)
3. Add connection retry logic in frontend

### Issue: 502 Bad Gateway During Deploy
**Expected:** Zero-downtime deploys take 2-3 minutes
**Solution:** Add health check grace period in `render.yaml`:
```yaml
    healthCheckPath: /api/v1/health
    healthCheckTimeout: 30
    healthCheckInterval: 10
```

---

## Cost Estimate

| Service | Plan | Cost/Month |
|---------|------|------------|
| API (Standard) | Auto-scale 2-12 | $25-150 |
| WebSocket (Starter) | 1 instance | $7 |
| Worker (Starter) | 1 instance | $7 |
| PostgreSQL (Standard) | 10GB | $20 |
| Redis (Upstash) | 10K commands/day | $10 |
| **Total** | | **$69-194** |

**Pro Tip:** Start with Starter plans ($45/mo total), scale as traffic grows.

---

## Success Metrics

After deployment, monitor:
- ✅ **TTFB p92**: <150ms
- ✅ **Uptime**: >99.9%
- ✅ **Error rate**: <0.1%
- ✅ **Prediction latency**: <100ms
- ✅ **CCU**: 10,000+ supported

---

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Deploy frontend to Vercel
3. ✅ Connect custom domains
4. ✅ Set up monitoring (Sentry)
5. ✅ Run load tests
6. ✅ Configure auto-scaling
7. ✅ Set up backup jobs

**Your API is now live at:** `https://api.sabiscore.io` 🚀

**CLV Target:** +₦60 average, +18.4% ROI
