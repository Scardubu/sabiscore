# 🚀 Phase 5 Quick Reference

## One-Command Operations

### Setup Phase 5 Environment
```powershell
.\deploy-phase5.ps1 -Mode setup
```
Installs: Wrangler CLI, KV namespaces, Prometheus config, PWA assets

### Deploy to Production
```powershell
.\deploy-phase5.ps1 -Mode deploy -Environment production
```
Deploys: Next.js → Cloudflare Pages, API → Railway, Monitoring stack

### Open Monitoring Dashboards
```powershell
.\deploy-phase5.ps1 -Mode monitor
```
Opens: Grafana (3001), Prometheus (9090), Cloudflare Analytics

### Run Performance Tests
```powershell
.\deploy-phase5.ps1 -Mode test
```
Tests: Edge cache, API latency, WebSocket, Prometheus metrics

---

## Manual Commands Reference

### Cloudflare Operations

#### Login to Cloudflare
```bash
wrangler login
```

#### Create KV Namespace (Production)
```bash
wrangler kv:namespace create "SABISCORE_CACHE" --env production
```

#### Deploy to Cloudflare Pages
```bash
cd apps/web
npm run build
wrangler pages deploy .next --project-name=sabiscore-web --branch=main
```

#### List KV Keys
```bash
wrangler kv:key list --namespace-id=<your-namespace-id>
```

#### Get KV Value
```bash
wrangler kv:key get "insights:arsenal-vs-chelsea:epl" --namespace-id=<your-namespace-id>
```

#### Delete KV Key
```bash
wrangler kv:key delete "insights:old-match:epl" --namespace-id=<your-namespace-id>
```

### Monitoring Stack

#### Start Prometheus + Grafana
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

#### View Logs
```bash
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

#### Stop Monitoring Stack
```bash
docker-compose -f docker-compose.monitoring.yml down
```

#### Restart Services
```bash
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

#### Check Metrics Endpoint
```bash
curl http://localhost:8000/metrics
```

### PWA Testing

#### Test Service Worker (Chrome DevTools)
1. Open DevTools (F12)
2. Application tab → Service Workers
3. Verify "sabiscore-v1" is active
4. Test offline: Network tab → Throttling → Offline

#### Test Push Notifications
```javascript
// Browser console
Notification.requestPermission().then(permission => {
  if (permission === 'granted') {
    new Notification('SabiScore', {
      body: 'Arsenal vs Chelsea - 92% confidence',
      icon: '/logo-192.png'
    });
  }
});
```

#### Lighthouse PWA Score
```bash
npm install -g lighthouse
lighthouse https://sabiscore.pages.dev --view --preset=desktop --only-categories=pwa
```

---

## Key Endpoints

### Production URLs
- **Frontend**: https://sabiscore.pages.dev
- **API**: https://sabiscore-api.up.railway.app
- **WebSocket**: wss://sabiscore-api.up.railway.app/ws/edge/{match_id}

### Monitoring Dashboards
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Cloudflare Analytics**: https://dash.cloudflare.com/analytics

### Health Checks
- **API Health**: GET /api/v1/health
- **Prometheus Metrics**: GET /metrics
- **Edge Cache Status**: Check `cf-cache-status` header

---

## Performance Testing

### k6 Load Test Script
```javascript
// test-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<150'], // P99 < 150ms
  },
};

export default function () {
  let res = http.post('https://sabiscore-api.up.railway.app/api/v1/insights', {
    matchup: 'Arsenal vs Chelsea',
    league: 'EPL'
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 150ms': (r) => r.timings.duration < 150,
  });

  sleep(1);
}
```

### Run k6 Test
```bash
k6 run test-load.js
```

### Artillery Test (Alternative)
```bash
npm install -g artillery
artillery quick --count 1000 --num 10 https://sabiscore.pages.dev/
```

---

## Prometheus Queries

### P50/P95/P99 Latency
```promql
# P50
histogram_quantile(0.50, rate(sabiscore_http_request_duration_seconds_bucket[5m]))

# P95
histogram_quantile(0.95, rate(sabiscore_http_request_duration_seconds_bucket[5m]))

# P99
histogram_quantile(0.99, rate(sabiscore_http_request_duration_seconds_bucket[5m]))
```

### Request Rate (RPS)
```promql
rate(sabiscore_http_requests_total[5m])
```

### Error Rate
```promql
rate(sabiscore_http_requests_total{status=~"5.."}[5m])
```

### Cache Hit Rate
```promql
sabiscore_cache_hit_rate
```

### Model Inference Duration
```promql
histogram_quantile(0.95, rate(sabiscore_model_inference_duration_seconds_bucket[5m]))
```

### Active WebSocket Connections
```promql
sabiscore_websocket_connections_active
```

---

## Grafana Dashboard Panels

### Create Dashboard (Manual Steps)
1. Open Grafana: http://localhost:3001
2. Login: admin/admin
3. Create → Dashboard → Add Visualization
4. Select Prometheus as data source
5. Add query from examples above
6. Choose visualization type (Time series, Gauge, Stat)
7. Save dashboard

### Import Pre-Built Dashboard (JSON)
1. Dashboards → Import
2. Upload `monitoring/grafana/dashboards/sabiscore.json`
3. Select Prometheus data source
4. Import

---

## Troubleshooting

### Issue: Cloudflare deployment fails
**Solution**:
```bash
# Re-authenticate
wrangler logout
wrangler login

# Check wrangler.toml configuration
cat wrangler.toml

# Retry deployment
wrangler pages deploy .next --project-name=sabiscore-web
```

### Issue: Prometheus not scraping metrics
**Solution**:
```bash
# Check if API exposes metrics
curl http://localhost:8000/metrics

# Verify Prometheus config
cat monitoring/prometheus.yml

# Check Prometheus targets
# Open http://localhost:9090/targets
```

### Issue: Grafana dashboard shows "No data"
**Solution**:
1. Check Prometheus data source connection
2. Verify query syntax in Prometheus UI first
3. Ensure correct time range (Last 5 minutes)
4. Check if metrics exist: `sabiscore_http_requests_total`

### Issue: Service Worker not updating
**Solution**:
```javascript
// Force update in browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.update());
});

// Or clear and re-register
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
location.reload();
```

### Issue: High P99 latency (>150ms)
**Debug Steps**:
1. Check cache hit rate: `sabiscore_cache_hit_rate`
2. Review slow queries in PostgreSQL logs
3. Check Redis connection pool exhaustion
4. Verify model inference time: `sabiscore_model_inference_duration_seconds`
5. Review Sentry performance traces

---

## Environment Variables Checklist

### Frontend (.env.production)
```bash
✓ NEXT_PUBLIC_API_URL
✓ NEXT_PUBLIC_WS_URL
✓ NEXT_PUBLIC_SENTRY_DSN
✓ KV_NAMESPACE_ID
✓ UPSTASH_REDIS_URL
✓ UPSTASH_REDIS_TOKEN
```

### Backend (.env)
```bash
✓ DATABASE_URL (PostgreSQL)
✓ REDIS_URL
✓ NEXT_URL (for ISR revalidation)
✓ REVALIDATE_SECRET
✓ SENTRY_DSN
✓ OPTA_API_KEY
✓ BETFAIR_APP_KEY
✓ PINNACLE_API_KEY
```

---

## Performance Targets (Phase 5)

| Metric | Target | Command to Verify |
|--------|--------|-------------------|
| P50 TTFB | <45ms | k6 load test |
| P99 TTFB | <148ms | Prometheus query |
| Cache Hit Rate | >95% | Grafana dashboard |
| API Throughput | 1,000 req/s | Artillery test |
| Error Rate | <0.01% | Sentry dashboard |
| Model Accuracy | >54% | Custom evaluation script |
| Uptime | >99.95% | Cloudflare Analytics |

---

## Quick Links

- **Phase 5 Documentation**: [PHASE_5_DEPLOYMENT_PLAN.md](./PHASE_5_DEPLOYMENT_PLAN.md)
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Railway Dashboard**: https://railway.app/dashboard
- **Upstash Console**: https://console.upstash.com
- **Sentry Dashboard**: https://sentry.io/organizations/sabiscore

---

**Built with ⚡ for edge-first performance**  
**Ship it: `.\deploy-phase5.ps1 -Mode deploy -Environment production`** 🚀
