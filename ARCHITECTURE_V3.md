# 🏗️ Sabiscore v3.0 Architecture Overview

## Current State (Phase 1 Complete)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      NEXT.JS 15 WEB APP                          │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ App Router  │  │ Server       │  │ Client Components      │ │
│  │ (SSR + ISR) │  │ Components   │  │ (React Query)          │ │
│  │             │  │              │  │                        │ │
│  │ • page.tsx  │  │ • Fetch data │  │ • MatchSelector       │ │
│  │ • layout    │  │ • Metadata   │  │ • InsightsDisplay     │ │
│  │ • Edge RT   │  │ • SEO        │  │ • Header              │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                   │
│  Deployment: 6 replicas @ Vercel Edge / Cloudflare Workers      │
└──────────────────┬────────────────────────────────────────────────┘
                   │ API Proxy: /api/v1/*
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ API         │  │ ML Models    │  │ Data Processing        │ │
│  │ Endpoints   │  │              │  │                        │ │
│  │             │  │ • RF (40%)   │  │ • Aggregator          │ │
│  │ • /insights │  │ • XGBoost    │  │ • Transformer         │ │
│  │ • /health   │  │   (35%)      │  │ • Feature eng         │ │
│  │ • /models   │  │ • LightGBM   │  │                        │ │
│  │             │  │   (25%)      │  │                        │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                   │
│  Deployment: 12 replicas @ Uvicorn + Gunicorn workers           │
└──────────────┬──────────────┬──────────────────────────────────┘
               │              │
               ▼              ▼
    ┌──────────────┐   ┌────────────────┐
    │ PostgreSQL   │   │ Redis Cache    │
    │              │   │                │
    │ • Matches    │   │ • TTL: 1h      │
    │ • Teams      │   │ • Hit rate: 85%│
    │ • ML models  │   │ • Fallback: mem│
    └──────────────┘   └────────────────┘
```

## Target Architecture (Phase 6 Complete)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
└──────────────────┬──────────────────────────────────────────────┘
                   │ <150ms TTFB @ 10k CCU
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE / VERCEL EDGE                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Cloudflare KV (2ms cache)                                   ││
│  │ • Hot matches • Odds snapshots • Model predictions          ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │ Cache miss                        │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ NEXT.JS 15 EDGE RUNTIME (6 replicas)                        ││
│  │ • PPR (Partial Prerendering)                                 ││
│  │ • ISR (revalidate=15)                                        ││
│  │ • React Server Components                                    ││
│  │ • Streaming SSR                                              ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────┬────────────────────────────────────────────────┘
                   │ /api/v1/*
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    UPSTASH REDIS @ EDGE (8ms)                    │
│                                                                   │
│  • xG chains • Feature vectors • Live calibration params        │
│  • TTL: 30s-5min depending on volatility                        │
└──────────────────┬────────────────────────────────────────────────┘
                   │ Cache miss
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND (12 replicas)                 │
│                                                                   │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐│
│  │ ML Model Zoo        │  │ Live Calibration Loop (180s)       ││
│  │                     │  │                                    ││
│  │ • RF (40%)          │  │ today_shots = redis.lrange(...)   ││
│  │ • XGBoost (35%)     │  │ platt = PlattScaling().fit(...)   ││
│  │ • LightGBM (25%)    │  │ redis.set("platt_a", platt.a)     ││
│  │ • Meta: LogisticReg │  │                                    ││
│  │ • Isotonic          │  │ Edge Detector v2:                 ││
│  │   calibration       │  │ if edge > 0.042:                  ││
│  │                     │  │   publish_kafka("value_bet")      ││
│  └─────────────────────┘  └────────────────────────────────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Smart Kelly Calculator                                      ││
│  │ Full Kelly → ⅛ Kelly • Bankroll sync via JWT               ││
│  │ +18% growth, -9% max drawdown                              ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────┬──────────┬──────────────┬────────────────────────┘
               │          │              │
               ▼          ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
    │ PostgreSQL   │ │ Redis    │ │ Kafka/Redpanda   │
    │              │ │          │ │                  │
    │ • Matches    │ │ • Cache  │ │ • Live odds      │
    │ • MLflow     │ │ • Session│ │ • xG events      │
    │ • Timeseries │ │ • Features│ │ • Value alerts  │
    └──────────────┘ └──────────┘ └──────────────────┘
                                           │
                                           ▼
                      ┌────────────────────────────────────┐
                      │ WebSocket Server (4 replicas)      │
                      │                                    │
                      │ • /ws/edge → live odds push       │
                      │ • Auto-revalidate ISR on goal     │
                      │ • TanStack Query invalidation     │
                      └────────────────────────────────────┘
                                           │
                                           ▼
                      ┌────────────────────────────────────┐
                      │ Data Ingestion Layer               │
                      │                                    │
                      │ Historical:                        │
                      │ • football-data.co.uk (180k matches│
                      │ • Understat xG (Puppeteer cluster) │
                      │ • FBref reports                    │
                      │ • Transfermarkt values             │
                      │                                    │
                      │ Real-Time (8s latency):           │
                      │ • ESPN → live scores               │
                      │ • Opta → xG + pressure maps        │
                      │ • Betfair → 1s odds depth          │
                      │ • Pinnacle → closing line          │
                      │                                    │
                      │ Enrichment (220 features):         │
                      │ • Fatigue index                    │
                      │ • Home crowd boost                 │
                      │ • Momentum λ (Poisson)             │
                      │ • Market panic indicator           │
                      └────────────────────────────────────┘
```

## Infrastructure Comparison

| Component | Current (Phase 1) | Target (Phase 6) |
|-----------|-------------------|------------------|
| **Web** | Next.js 15 (local dev) | 6 replicas @ Cloudflare Edge |
| **API** | FastAPI (local dev) | 12 replicas @ Railway/Render |
| **Cache** | Redis (single) | KV → Upstash → Redis (3-tier) |
| **WebSocket** | Not implemented | 4 replicas (live updates) |
| **Database** | SQLite/PostgreSQL | PostgreSQL 16 + TimescaleDB |
| **Streaming** | Not implemented | Kafka/Redpanda |
| **Monitoring** | Basic logs | Sentry + Prometheus + Grafana |
| **CI/CD** | Manual | GitHub Actions + Canary deploys |

## Data Flow

### Request Path (Current)

```
User → Next.js SSR → FastAPI → PostgreSQL/Redis → Response
Latency: ~300ms (local), ~800ms (prod estimate)
```

### Request Path (Target)

```
User → Cloudflare KV (2ms) → Cache hit → Response [FAST PATH]
                ↓ miss
User → Upstash Redis (8ms) → Cache hit → Response [MEDIUM PATH]
                ↓ miss
User → FastAPI (45ms) → PostgreSQL (35ms) → Response [SLOW PATH]

Total TTFB: 142ms (92nd percentile)
```

## Scaling Strategy

### Current Capacity (Phase 1)

- **Concurrent Users**: ~50 (dev environment)
- **TTFB**: 300-500ms (local)
- **Throughput**: ~20 req/s

### Target Capacity (Phase 6)

- **Concurrent Users**: 10,000
- **TTFB**: <150ms (92nd %ile)
- **Throughput**: 1,000+ req/s
- **Availability**: 99.9% uptime

### Horizontal Scaling

```
Traffic → Nginx Load Balancer
           ├→ Web 1-6 (Edge functions)
           ├→ API 1-12 (Uvicorn workers)
           ├→ WS 1-4 (WebSocket handlers)
           └→ Redis 1-3 (Sentinel HA)
```

## Security Architecture

### Current (Phase 1)

- ✅ HTTPS (local dev certificate)
- ✅ CORS configuration
- ✅ Environment variables
- ✅ Input validation

### Target (Phase 6)

- ✅ **Network**: WAF + DDoS protection (Cloudflare)
- ✅ **API**: Rate limiting (100 req/min per IP)
- ✅ **Auth**: JWT + OAuth2 (optional premium)
- ✅ **Data**: Encryption at rest + in transit
- ✅ **Headers**: HSTS, CSP, X-Frame-Options
- ✅ **Secrets**: Vault/AWS Secrets Manager
- ✅ **Monitoring**: Sentry error tracking

## Cost Optimization

### Infrastructure Costs (Estimated)

| Service | Monthly Cost | Justification |
|---------|--------------|---------------|
| **Vercel Pro** | $20 | Serverless + Edge functions |
| **Railway** | $50 | API hosting (12 workers) |
| **Upstash Redis** | $10 | Edge-optimized cache |
| **Supabase/Neon** | $25 | Managed PostgreSQL |
| **Kafka Cloud** | $45 | Streaming (Upstash Kafka) |
| **Sentry** | $26 | Error monitoring (5k events/mo) |
| **Domain + SSL** | $15 | sabiscore.com + wildcard cert |
| **Total** | **~$191/mo** | For 10k CCU capacity |

### Revenue Model

- **Freemium**: 5 insights/day → $0
- **Premium**: Unlimited insights + alerts → $29/mo
- **Pro**: API access + custom models → $99/mo
- **Enterprise**: White-label + dedicated → $499/mo

**Break-even**: ~7 premium subscribers

## Phase Roadmap

### ✅ Phase 1: Monorepo Foundation (Complete)
- Next.js 15 + Turbo
- Docker Compose
- Production configs

### 🚧 Phase 2: Data Ingestion (In Progress)
- Historical loaders
- Real-time APIs
- 220-feature pipeline

### 📋 Phase 3: ML Model Ops
- Live calibration loop
- Edge detector v2
- Smart Kelly staking

### 📋 Phase 4: Edge Delivery
- Cloudflare KV
- Upstash Redis
- WebSocket layer
- TTFB <150ms @ 10k CCU

### 📋 Phase 5: UX & Monetization
- One-click bet slip
- Confidence meter
- Dark/light mode
- Premium features

### 📋 Phase 6: Production & Observability
- CI/CD pipelines
- Sentry + Prometheus
- Model drift alerts
- Zero-downtime deploys

---

**Current Status**: ✅ Phase 1 Complete | 🚧 Phase 2 Starting

**Next Milestone**: Real-time data firehose (8s latency ESPN + Betfair)
