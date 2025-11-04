# 🚀 Phase 5: Edge Deployment & Production Scale

## Executive Summary

**Phase 5** transforms Sabiscore from a high-performance monorepo into a **globally distributed, edge-first platform** delivering sub-100ms predictions to 10k+ concurrent users with 99.95% uptime.

### Strategic Objectives

| Goal | Current (Phase 4) | Target (Phase 5) | Improvement |
|------|-------------------|------------------|-------------|
| **P50 TTFB** | 98ms (API) | **45ms** (Edge) | **-54%** ⚡ |
| **P99 TTFB** | ~185ms | **<148ms** | **-20%** ⚡ |
| **Cache Hit Rate** | 85% | **95%+** | **+12%** 📈 |
| **Concurrent Users** | ~50 | **10,000** | **200x** 🚀 |
| **Geographic Latency** | Single region | **Multi-region <50ms** | Global ⚡ |
| **Model Serving** | Sync | **Async + streaming** | Real-time 📡 |
| **Monitoring** | Sentry | **Sentry + Prometheus + Grafana** | Full observability 👁️ |

---

## 🎯 Phase 5 Deliverables

### 1. Cloudflare Edge Deployment
**Deploy Next.js to Cloudflare Pages with KV cache for <45ms TTFB**

#### Infrastructure Changes
```yaml
# Current: Vercel (single region)
apps/web → Vercel Edge (IAD1)

# Target: Cloudflare (global edge)
apps/web → Cloudflare Pages (300+ POPs)
  ├─ KV Cache (2-5ms reads)
  ├─ Durable Objects (stateful WebSocket)
  └─ Workers (Edge compute)
```

#### Implementation Steps

**A. Cloudflare Pages Setup**
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create "SABISCORE_CACHE"
wrangler kv:namespace create "SABISCORE_CACHE" --preview

# Update wrangler.toml
cat > wrangler.toml << 'EOF'
name = "sabiscore-web"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"

[[kv_namespaces]]
binding = "SABISCORE_CACHE"
id = "your-namespace-id"
preview_id = "your-preview-id"

[env.production]
routes = [
  { pattern = "sabiscore.io/*", zone_name = "sabiscore.io" }
]
EOF

# Deploy
npm run build
npx wrangler pages deploy .next
```

**B. Edge Cache Layer (`apps/web/src/lib/edge-cache.ts`)**
```typescript
// KV → Upstash → API fallback chain
interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}

class CloudflareKVCache implements CacheProvider {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json');
    return value as T | null;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: ttl
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}

class UpstashRedisCache implements CacheProvider {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value as string) : null;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// Hierarchical cache with fallback
export class EdgeCacheManager {
  private providers: CacheProvider[];

  constructor(providers: CacheProvider[]) {
    this.providers = providers;
  }

  async get<T>(key: string): Promise<T | null> {
    for (const provider of this.providers) {
      try {
        const value = await provider.get<T>(key);
        if (value !== null) {
          return value;
        }
      } catch (error) {
        console.error('Cache provider error:', error);
        continue;
      }
    }
    return null;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    // Set in all providers (fire-and-forget for non-primary)
    const promises = this.providers.map(provider =>
      provider.set(key, value, ttl).catch(err => console.error(err))
    );
    await Promise.allSettled(promises);
  }

  async delete(key: string): Promise<void> {
    const promises = this.providers.map(provider =>
      provider.delete(key).catch(err => console.error(err))
    );
    await Promise.allSettled(promises);
  }
}

// Usage in Edge Runtime
export const edgeCache = new EdgeCacheManager([
  new CloudflareKVCache(SABISCORE_CACHE), // 2-5ms
  new UpstashRedisCache()                  // 8-15ms
]);
```

**C. Edge-Optimized API Client (`apps/web/src/lib/api-edge.ts`)**
```typescript
import { edgeCache } from './edge-cache';

export async function getMatchInsights(matchup: string, league: string) {
  const cacheKey = `insights:${matchup.toLowerCase()}:${league.toLowerCase()}`;

  // Try edge cache first
  const cached = await edgeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from origin API
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/insights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchup, league }),
      // Edge-specific optimizations
      cf: {
        cacheTtl: 900,        // 15 minutes
        cacheEverything: true
      }
    }
  );

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();

  // Cache for 15 minutes
  await edgeCache.set(cacheKey, data, 900);

  return data;
}
```

**D. Performance Monitoring**
```typescript
// apps/web/src/middleware.ts
export async function middleware(request: NextRequest) {
  const startTime = Date.now();

  const response = NextResponse.next();

  const duration = Date.now() - startTime;

  // Log to Cloudflare Analytics
  console.log(JSON.stringify({
    path: request.nextUrl.pathname,
    method: request.method,
    duration_ms: duration,
    cache_status: response.headers.get('x-cache'),
    country: request.geo?.country || 'unknown'
  }));

  // Alert if P99 threshold breached
  if (duration > 148) {
    await fetch(process.env.SENTRY_WEBHOOK_URL!, {
      method: 'POST',
      body: JSON.stringify({
        level: 'warning',
        message: `P99 latency breached: ${duration}ms`,
        extra: { path: request.nextUrl.pathname }
      })
    });
  }

  return response;
}

export const config = {
  matcher: ['/match/:path*', '/api/:path*']
};
```

---

### 2. Prometheus + Grafana Monitoring
**Real-time performance dashboards with alerting**

#### Infrastructure Setup

**A. Backend Metrics Exporter (`backend/src/monitoring/prometheus.py`)**
```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from prometheus_client import CONTENT_TYPE_LATEST
from starlette.responses import Response

# Define metrics
REQUEST_COUNT = Counter(
    'sabiscore_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'sabiscore_http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    buckets=[0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0]
)

MODEL_INFERENCE_DURATION = Histogram(
    'sabiscore_model_inference_duration_seconds',
    'Model inference duration',
    ['model_name'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

CACHE_HIT_RATE = Gauge(
    'sabiscore_cache_hit_rate',
    'Cache hit rate percentage'
)

ACTIVE_WEBSOCKET_CONNECTIONS = Gauge(
    'sabiscore_websocket_connections_active',
    'Active WebSocket connections'
)

MODEL_ACCURACY = Gauge(
    'sabiscore_model_accuracy',
    'Model accuracy on recent predictions',
    ['model_name']
)

# Middleware
@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time
    endpoint = request.url.path

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=endpoint,
        status=response.status_code
    ).inc()

    REQUEST_DURATION.labels(
        method=request.method,
        endpoint=endpoint
    ).observe(duration)

    return response

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

**B. Docker Compose Monitoring Stack**
```yaml
# docker-compose.monitoring.yml
version: '3.9'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - sabiscore-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - sabiscore-network

  node_exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    networks:
      - sabiscore-network

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - sabiscore-network

volumes:
  prometheus_data:
  grafana_data:

networks:
  sabiscore-network:
    external: true
```

**C. Prometheus Configuration (`monitoring/prometheus.yml`)**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'sabiscore-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node_exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

# Alerting rules
rule_files:
  - 'alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

**D. Alerting Rules (`monitoring/alerts.yml`)**
```yaml
groups:
  - name: sabiscore_alerts
    interval: 30s
    rules:
      # P99 latency alert
      - alert: HighP99Latency
        expr: histogram_quantile(0.99, rate(sabiscore_http_request_duration_seconds_bucket[5m])) > 0.148
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency exceeds 148ms"
          description: "P99 latency is {{ $value }}s (threshold: 0.148s)"

      # Cache hit rate alert
      - alert: LowCacheHitRate
        expr: sabiscore_cache_hit_rate < 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 85%"
          description: "Current hit rate: {{ $value }}%"

      # Model accuracy degradation
      - alert: ModelAccuracyDrop
        expr: sabiscore_model_accuracy < 0.50
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Model accuracy dropped below 50%"
          description: "{{ $labels.model_name }} accuracy: {{ $value }}"

      # High error rate
      - alert: HighErrorRate
        expr: rate(sabiscore_http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx error rate detected"
          description: "Error rate: {{ $value }}/s"
```

**E. Grafana Dashboard JSON (`monitoring/grafana/dashboards/sabiscore.json`)**
```json
{
  "dashboard": {
    "title": "SabiScore Production Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(sabiscore_http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "P50/P95/P99 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(sabiscore_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(sabiscore_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(sabiscore_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "sabiscore_cache_hit_rate"
          }
        ]
      },
      {
        "title": "Model Accuracy (Rolling 24h)",
        "targets": [
          {
            "expr": "sabiscore_model_accuracy"
          }
        ]
      }
    ]
  }
}
```

---

### 3. Progressive Web App (PWA)
**Offline support + push notifications**

#### Implementation

**A. Service Worker (`apps/web/public/sw.js`)**
```javascript
const CACHE_VERSION = 'sabiscore-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_FILES = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/logo-192.png',
  '/logo-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API requests: network-first
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const clonedResponse = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, clonedResponse);
        });
        return response;
      });
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/logo-192.png',
    badge: '/badge.png',
    data: { url: data.url }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

**B. Manifest (`apps/web/public/manifest.json`)**
```json
{
  "name": "SabiScore - Football Intelligence",
  "short_name": "SabiScore",
  "description": "Sub-150ms football predictions with +18% ROI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#10b981",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/logo-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/logo-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Today's Matches",
      "url": "/?filter=today",
      "icons": [{ "src": "/icon-today.png", "sizes": "96x96" }]
    },
    {
      "name": "Value Bets",
      "url": "/value-bets",
      "icons": [{ "src": "/icon-value.png", "sizes": "96x96" }]
    }
  ]
}
```

**C. PWA Registration (`apps/web/src/app/layout.tsx`)**
```tsx
export default function RootLayout({ children }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);

          // Request notification permission
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
        });
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10b981" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

### 4. Backend Optimizations

#### A. Async Model Serving (`backend/src/models/async_ensemble.py`)
```python
import asyncio
from typing import List, Dict
import numpy as np

class AsyncEnsembleModel:
    def __init__(self, models: List):
        self.models = models

    async def predict_async(self, X: np.ndarray) -> Dict:
        """Parallel prediction across all models"""
        tasks = [
            asyncio.to_thread(model.predict_proba, X)
            for model in self.models
        ]

        predictions = await asyncio.gather(*tasks)

        # Average ensemble
        ensemble_proba = np.mean(predictions, axis=0)

        return {
            'home_win': float(ensemble_proba[0]),
            'draw': float(ensemble_proba[1]),
            'away_win': float(ensemble_proba[2]),
            'confidence': float(np.max(ensemble_proba))
        }
```

#### B. Database Connection Pooling (`backend/src/core/database.py`)
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

# Async engine with optimized pooling
engine = create_async_engine(
    settings.database_url.replace('postgresql://', 'postgresql+asyncpg://'),
    poolclass=QueuePool,
    pool_size=20,          # Matches replica count
    max_overflow=10,       # Burst capacity
    pool_pre_ping=True,    # Connection health check
    pool_recycle=3600,     # Recycle connections every hour
    echo=False
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

---

## 🚀 Deployment Checklist

### Pre-Launch (Week 1)

- [ ] **Cloudflare Setup**
  - [ ] Create Cloudflare account + domain
  - [ ] Configure KV namespaces (prod + preview)
  - [ ] Set up Durable Objects for WebSocket
  - [ ] Deploy Next.js to Cloudflare Pages
  - [ ] Configure custom domain + SSL

- [ ] **Monitoring Setup**
  - [ ] Deploy Prometheus + Grafana stack
  - [ ] Configure alert rules (P99, cache, errors)
  - [ ] Set up Slack/Email alerting webhooks
  - [ ] Create production dashboard
  - [ ] Test alert delivery

- [ ] **PWA Implementation**
  - [ ] Create service worker + manifest
  - [ ] Generate PWA icons (192px, 512px)
  - [ ] Test offline functionality
  - [ ] Test push notifications
  - [ ] Validate Lighthouse PWA score >90

### Launch Week (Week 2)

- [ ] **Backend Deployment**
  - [ ] Deploy to Railway/Render with autoscaling
  - [ ] Configure 12 API replicas
  - [ ] Set up Redis Cluster (3 nodes)
  - [ ] Migrate to PostgreSQL 16 with read replicas
  - [ ] Enable connection pooling (20 + 10 overflow)

- [ ] **Performance Testing**
  - [ ] Load test: 10k CCU via k6/Artillery
  - [ ] Verify P99 latency <148ms
  - [ ] Verify cache hit rate >90%
  - [ ] Test WebSocket under load
  - [ ] Validate edge cache response times

- [ ] **Security Hardening**
  - [ ] Enable Cloudflare WAF
  - [ ] Configure rate limiting (100 req/min per IP)
  - [ ] Rotate all API keys
  - [ ] Enable HTTPS-only + HSTS
  - [ ] Configure CORS policies

### Post-Launch (Week 3+)

- [ ] **Monitoring & Optimization**
  - [ ] Review Grafana dashboards daily
  - [ ] Analyze P99 latency trends
  - [ ] Optimize slow endpoints
  - [ ] Tune cache TTLs based on hit rates
  - [ ] Monitor model accuracy drift

- [ ] **Documentation**
  - [ ] Update README with production URLs
  - [ ] Document alerting runbook
  - [ ] Create incident response playbook
  - [ ] Write scaling guidelines
  - [ ] Document rollback procedures

---

## 📊 Success Metrics (30 Days Post-Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **P50 TTFB** | <45ms | Cloudflare Analytics |
| **P99 TTFB** | <148ms | Prometheus histogram |
| **Cache Hit Rate** | >95% | Redis INFO stats |
| **Uptime** | >99.95% | Uptime Robot |
| **Error Rate** | <0.01% | Sentry dashboard |
| **Model Accuracy** | >54% | Daily batch evaluation |
| **API Throughput** | 1,000 req/s | Prometheus rate() |
| **WebSocket Latency** | <30ms | Custom middleware |

---

## 💰 Infrastructure Costs (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Cloudflare Pages | Pro | $20 |
| Upstash Redis | Pro 10GB | $80 |
| Railway (API) | Pro | $100 |
| Neon Postgres | Scale | $70 |
| Sentry | Team | $29 |
| Prometheus Cloud | 10k series | $0 (self-hosted) |
| **Total** | | **~$299/month** |

*Scales to 10k CCU with 99.95% uptime*

---

## 🎯 Phase 6 Preview

- **Multi-Region Deployment**: US-East, EU-West, APAC-Singapore
- **Kubernetes + ArgoCD**: GitOps-driven deployments
- **Model Drift Detection**: Automated rollback on >2% accuracy drop
- **A/B Testing**: Traffic splitting for model experiments
- **Advanced Analytics**: BigQuery data warehouse + Looker Studio

---

**Built with ⚡ for global scale**  
**Next: Cloudflare Workers + Prometheus → <45ms TTFB** 🚀
