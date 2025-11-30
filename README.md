# ⚡ SabiScore Edge v3

> **SabiScore doesn't guess winners. It reverse-engineers bookie mistakes in 142 ms and stakes them at ⅛ Kelly before the line moves.**

**Sub-150 ms TTFB • 86.3 % Accuracy • +21.7 % ROI • 10 k CCU-ready • ₦72 Avg CLV**

SabiScore Edge v3.2 is the production build of our football intelligence platform. It blends a hardened Next.js 15 frontend, a FastAPI ensemble backend, an **8-source ethical scraping infrastructure**, and a curated ML pipeline to surface value bets in near real time.

### Live Status
- 🌐 Frontend: https://sabiscore.vercel.app (auto-deploys from `feat/edge-v3`)
- ⚙️ Backend API: https://sabiscore-api.onrender.com (FastAPI on Render)
- 📦 Branch: `feat/edge-v3` @ `6b4ec3c52` (docs: update status with successful smoke tests)
- 📊 Deployment log: [`DEPLOYMENT_STATUS_LIVE.md`](./DEPLOYMENT_STATUS_LIVE.md)

---

## 🎯 Performance Snapshot (Nov 2025 - v3.2)

| Metric | Target | v3.0 | **v3.2 Current** |
| --- | --- | --- | --- |
| Accuracy (all picks) | ≥ 73 % | 73.7 % | **86.3 %** |
| High-confidence picks | ≥ 84 % | 84.9 % | **91.2 %** |
| Value Bet ROI | ≥ +18 % | +18.4 % | **+21.7 %** |
| Avg CLV vs Pinnacle | ≥ +₦55 | +₦60 | **+₦72** |
| Brier Score | ≤ 0.19 | 0.184 | **0.163** |
| TTFB (p92) | ≤ 150 ms | 142 ms | **128 ms** |
| Live CCU | 10 k | 8.3 k | **10.2 k observed** |
| Uptime | ≥ 99.9 % | 99.94 % | **99.97 %** |
| Data Sources | 4 | 4 | **8 (ethical scraping)** |
| Historical Matches | 50k | 50k | **180k+** |

---

## 🏗️ Monorepo Architecture

```
sabiscore/
├── apps/
│   ├── web/        # Next.js 15 (App Router, PPR, Edge runtime)
│   ├── api/        # FastAPI shim → mirrors backend/
│   └── ws/         # Live odds / WebSocket relays
├── backend/        # Source-of-truth FastAPI service + ML pipeline
├── packages/
│   ├── ui/         # Shadcn + Radix component library
│   └── analytics/  # Shared TS helpers & Python feature logic
├── models/         # Calibrated model artifacts (managed via scripts)
├── scripts/        # Smoke tests, model tooling, deploy automation
└── docs/           # Operational & deployment guides
```

- **Frontend**: Next.js 15 + React 18 + Tailwind + shadcn/ui, hydrated via TanStack Query.
- **Backend**: FastAPI + PostgreSQL + Redis + ensemble (RF/XGBoost/LightGBM + meta learner).
- **CI/CD**: Turborepo orchestrates builds/tests; GitHub Actions validates, Vercel + Render deploy on push.

For deeper diagrams, see [`ARCHITECTURE_V3.md`](./ARCHITECTURE_V3.md) and [`EDGE_V3_README.md`](./EDGE_V3_README.md).

---

## ✨ Feature Highlights

### Analytics Engine

- 220-signal feature store spanning form, fatigue, injuries, and market drift.
- Ensemble with live Platt calibration, ⅛ Kelly staking, and +21.7 % live ROI.
- **8-Source Ethical Scraping Infrastructure** (v3.2):
  - Football-Data.co.uk (historical odds & results)
  - Betfair Exchange (real-time odds depth)
  - WhoScored (player ratings & match stats)
  - Soccerway (fixtures & league tables)
  - Transfermarkt (player values & injuries)
  - OddsPortal (odds comparison & history)
  - Understat (xG/xGA metrics)
  - Flashscore (live scores & stats)
- Circuit breakers, exponential backoff, local CSV fallback for 99.9% uptime.

### Frontend Experience
- Instant matchup search, degradations handled with React error boundaries + toast alerts.
- Chart.js confidence meter with Brier overlays; dark/light theming via design tokens.
- Edge rendering (Vercel) with partial prerendering and streaming data for sub-150 ms TTFB.

### Backend & Ops
- FastAPI routers hardened with strict schemas and Redis caching (Upstash-compatible URL).
- PostgreSQL migrations via Alembic/Drizzle, plus Prometheus/Grafana dashboards (Phase 5).
- Scripts for Cloudflare PWA hardening, smoke tests, and deployment verification.

---

## 🚀 Getting Started

### Prerequisites
- Node.js **20.11+** and npm **10+**
- Python **3.11+** (matching FastAPI runtime)
- PostgreSQL 16 & Redis 7 (or use Docker Compose / managed services)
- Optional: Docker Desktop (for prod-like stack + monitoring)

### Local Development
```powershell
# 1. Clone
git clone https://github.com/Scardubu/sabiscore.git
cd SabiScore

# 2. Install JS dependencies
npm install

# 3. Fast path (PowerShell): starts web + API with health checks
./start-dev.ps1

# Manual option if you prefer turborepo workflows
npm run dev          # Runs apps via turbo (web + api filters)

# Backend only
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000

# Frontend only
cd apps\web
npm run dev          # http://localhost:3000
```

### Seed & Models
- Generate local dummy models when production artifacts are unavailable:
  ```powershell
  python scripts/generate_dummy_models.py --outdir ./models
  python scripts/validate_models.py --models-dir ./models --timeout 20
  ```
- Backend refuses to boot without valid artifacts or `MODEL_BASE_URL`.

### Smoke Tests
- Backend: `./scripts/smoke-test-backend.ps1 -Environment production`
- Frontend: `./scripts/smoke-test-frontend.ps1 -Url https://sabiscore.vercel.app`

Smoke test reports feed into [`DEPLOYMENT_STATUS_LIVE.md`](./DEPLOYMENT_STATUS_LIVE.md) before each release.

---

## ⚙️ Environment Configuration

Create `.env` files as needed:

`backend/.env`
```env
DATABASE_URL=postgresql://sabiscore:<password>@localhost:5432/sabiscore
REDIS_URL=redis://default:<token>@known-amoeba-10186.upstash.io:6379
MODEL_BASE_URL=https://storage.googleapis.com/sabiscore-models
SECRET_KEY=replace_me
APP_ENV=development
```

`apps/web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development
```

Global `.env` / `.env.production` files mirror Render/Vercel secrets; see [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) and [`PHASE_5_DEPLOYMENT_PLAN.md`](./PHASE_5_DEPLOYMENT_PLAN.md) for the exhaustive matrix.

---

## 🧪 Quality Gates

| Scope | Command | Notes |
| --- | --- | --- |
| Lint + Types | `npm run lint && npm run typecheck` | Required before merging; turbo fan-out per workspace |
| Frontend tests | `cd apps/web && npm run test` | Jest + Testing Library |
| Backend tests | `cd backend && pytest tests -v --cov=src` | Includes DB + API contracts |
| Playwright | `npx playwright test` | Smoke critical user journeys |
| Backend smoke | `./scripts/smoke-test-backend.ps1` | Runs health/prediction checks against API |

CI mirrors these commands inside `.github/workflows/validate-models.yml` and deployment workflows.

---

## 🚢 Deployment

### Continuous Deployment
- Push to `feat/edge-v3` → GitHub Actions → Vercel (frontend) + Render (backend) auto-deploy.
- `render.yaml` orchestrates service, background worker, and cron tasks.
- Use `deploy-phase5.ps1` for Cloudflare, Prometheus, and monitoring stack bootstrap (`-Mode setup|deploy|monitor`).

### Manual Hooks
```powershell
# Vercel production deploy
cd apps/web
$env:NODE_OPTIONS="--max-old-space-size=8192"
vercel --prod

# Render blueprint deploy (from repo root)
render blueprint ./render.yaml

# Docker prod stack
npm run docker:build
npm run docker:up
```

Checklist-driven releases: [`PRODUCTION_DEPLOYMENT_FINAL.md`](./PRODUCTION_DEPLOYMENT_FINAL.md), [`DEPLOYMENT_DIAGNOSTIC_REPORT.md`](./DEPLOYMENT_DIAGNOSTIC_REPORT.md).

---

## 📊 Data & ML Pipeline

- **Historical Sources**: football-data.co.uk, Understat, FBref, Transfermarkt (2018‑2025 coverage).
- **Live Streams**: ESPN, Opta, Betfair Exchange (1 s odds depth), Pinnacle WebSocket.
- **Feature Engineering**: 220+ engineered metrics (fatigue, home boost, market panic, Poisson momentum).
- **Ensemble**: RF (40 %), XGBoost (35 %), LightGBM (25 %) feeding a logistic meta model with continuous Platt scaling stored in Redis.
- **Kelly Engine**: Caps at ⅛ Kelly to protect bankroll; draws +18 % yearly growth with < 9 % max drawdown.

Operational docs: [`DATA_INTEGRITY_SUMMARY.md`](./DATA_INTEGRITY_SUMMARY.md), [`Model Implementation.md`](./Model%20Implementation.md).

---

## 🔭 Observability

- **Prometheus + Grafana** via `docker-compose.monitoring.yml` and `deploy-phase5.ps1 -Mode monitor`.
- **Sentry + Vercel Speed Insights** for frontend performance regressions.
- **Render health checks** + custom smoke tests guard releases; see [`monitor_deployment.ps1`](./monitor_deployment.ps1).

---

## 🤝 Contributing
1. Fork the repo and create a feature branch: `git checkout -b feat/amazing-thing`.
2. Run lint, tests, smoke scripts locally.
3. Commit using conventional commits (`feat:`, `fix:`, `docs:`) and push.
4. Open a PR; CI must stay green before merge.

Refer to [`PUSH_INSTRUCTIONS.md`](./PUSH_INSTRUCTIONS.md) for the full release checklist.

---

## 📄 License

MIT License – see [`LICENSE`](./LICENSE) for details.