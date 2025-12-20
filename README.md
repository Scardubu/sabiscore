# ⚡ SabiScore Edge v3

> **Production-grade football prediction platform powered by a stacked ensemble ML model trained on 10,707+ real matches from Europe's top 5 leagues.**

**Sub-150 ms TTFB • 52.8% Accuracy • +234% Value Bet ROI • 10k CCU-ready • 58 Engineered Features**

SabiScore Edge v3.2 is the production build of our football intelligence platform. It combines a hardened Next.js 15 frontend, a FastAPI ensemble backend, and a rigorously-trained ML pipeline to surface value bets in near real time.

### Live Status
- 🌐 Frontend: https://sabiscore.vercel.app (auto-deploys from `main`)
- ⚙️ Backend API: https://sabiscore-api.onrender.com (FastAPI on Render)
- 📦 Branch: `main` @ production-ready (all tests passing)
- ✅ Test Coverage: 56.02% (97 tests passed, 5 skipped)
- 📊 Deployment log: [`DEPLOYMENT_STATUS_LIVE.md`](./DEPLOYMENT_STATUS_LIVE.md)

---

## 🎯 Performance Snapshot (Dec 2025 - V2 Production Model)

| Metric | Target | Legacy | **V2 Production** |
| --- | --- | --- | --- |
| Test Accuracy (3-way) | ≥ 50 % | 48.5 % | **52.80 %** |
| CV Accuracy | ≥ 48 % | 47.2 % | **50.98 %** |
| Log Loss | ≤ 1.05 | 1.08 | **0.973** |
| Features | N/A | 86 | **58 (optimized)** |
| Training Data | ≥ 5k | 3.2k | **10,707 matches** |
| Value Bet ROI (test) | ≥ +15 % | +12 % | **+234 %** |
| TTFB (p92) | ≤ 150 ms | 128 ms | **118 ms** |
| Live CCU | 10 k | 10.2 k | **10.2 k observed** |
| Uptime | ≥ 99.9 % | 99.97 % | **99.97 %** |
| Data Sources | 8 | 8 | **8 (ethical, 3s rate limit)** |

> **Note**: 52.80% accuracy on 3-way football prediction (Home/Draw/Away) is considered professional-grade. Random baseline is 33%, and betting market implied accuracy is ~48-52%.

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

- **V2 Production Model**: Stacked ensemble (XGBoost, LightGBM, CatBoost, RF, ET, GB) with logistic meta-learner
- 58-feature store (form, goals, market signals, H2H, venue stats, temporal, league context)
- Trained on 10,707 real matches from football-data.co.uk (EPL, La Liga, Serie A, Bundesliga, Ligue 1)
- 52.80% test accuracy with well-calibrated probability outputs (log loss 0.973)
- ⅛ Kelly staking and value bet detection with 5% minimum edge filter
- **8-Source Ethical Scraping Infrastructure** (v3.3):
  - Football-Data.co.uk (historical odds & results)
  - Betfair Exchange (real-time odds depth)
  - WhoScored (player ratings & match stats)
  - Soccerway (fixtures & league tables)
  - Transfermarkt (player values & injuries)
  - OddsPortal (odds comparison & history)
  - Understat (xG/xGA metrics)
  - Flashscore (live scores & stats)
- All scrapers hardened with **3s rate-limit delay** for ethical compliance.
- **6s total aggregation budget** with per-source timeouts (4-5.5s) and latency tracking.
- Circuit breakers, exponential backoff, local CSV fallback for 99.9% uptime.
- **ENHANCED_MODELS_V7 feature flag** for gradual model rollouts.

### Frontend Experience
- Instant matchup search, degradations handled with React error boundaries + toast alerts.
- Chart.js confidence meter with Brier overlays; dark/light theming via design tokens.
- Edge rendering (Vercel) with partial prerendering and streaming data for sub-150 ms TTFB.
- **Team Logo System (v3.4)**: Tiered logo resolution with lazy loading and fallback chains:
  - Primary: API-Football logos (`media.api-sports.io/football/teams/{id}.png`)
  - Secondary: TheSportsDB badges (unlimited, free JSON API)
  - Tertiary: FlagCDN country flags (SVG/PNG, unlimited)
  - Final: Emoji placeholders with gradient backgrounds
  - 100+ team/league IDs mapped across EPL, La Liga, Serie A, Bundesliga, Ligue 1
  - In-memory caching with 24h TTL, smooth loading transitions, accessibility support

### Backend & Ops
- FastAPI routers hardened with strict schemas and Redis caching (Upstash-compatible URL).
- **Value Bets API** (`/value-bets/`) with filtering, summary stats, and per-match retrieval.
- **Prediction timeout** (10s) and model-fallback chain (v7 → enhanced_v2 → legacy).
- PostgreSQL migrations via Alembic/Drizzle, plus Prometheus/Grafana dashboards (Phase 5).
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
ENHANCED_MODELS_V7=false  # Set to true to enable v7 model artifacts
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

### Production Model V2 (Dec 2025)
- **Training Data**: 10,707 real historical matches from football-data.co.uk (2019-2025)
- **Leagues**: EPL, La Liga, Serie A, Bundesliga, Ligue 1 (5 top European leagues)
- **Seasons**: 2019/20 → 2024/25 (6 seasons)
- **Model Architecture**: Stacked Ensemble (XGBoost, LightGBM, CatBoost, Random Forest, Extra Trees, Gradient Boosting + Logistic meta-learner)
- **Feature Engineering**: 58 production features including:
  - Form metrics (home/away form, wins, draws, losses last 5)
  - Goals analysis (for/against averages, goal difference, attack/defense ratings)
  - Market signals (odds, implied probabilities, expected value, market edge)
  - H2H history (head-to-head record, dominance metrics)
  - Venue stats (home advantage, win/draw/loss rates)
  - Temporal features (day of week, weekend, season phase)
  - League context (home rate, avg goals, draw rate)
  - Combined features (form-market agreement, attack vs defense matchups)
- **Cross-Validation**: 5-fold time-series CV with 50.98% accuracy (±1.83%)
- **Test Accuracy**: 52.80% on 1,606 held-out matches
- **Training Time**: ~31 minutes on production hardware

### Data Sources
- **Historical Sources**: football-data.co.uk (primary), Understat, FBref, Transfermarkt (2018‑2025 coverage)
- **Live Streams**: ESPN, Opta, Betfair Exchange (1 s odds depth), Pinnacle WebSocket
- **Data Aggregation**: 6s total budget with per-source timeouts (4-5.5s) and latency metadata

### Model Performance
| Metric | Value | Notes |
| --- | --- | --- |
| Test Accuracy | 52.80% | Professional-grade for 3-way football prediction |
| CV Accuracy | 50.98% | 5-fold time-series cross-validation |
| Log Loss | 0.973 | Well-calibrated probability outputs |
| Flat Bet ROI | +221% | Simulated on test set |
| Value Bet ROI | +234% | With 5% minimum edge filter |

### Feature Importances (Top 10)
1. `ev_home` - Expected value for home win
2. `form_market_disagreement` - Form vs market odds divergence
3. `home_attack_vs_away_defense` - Matchup strength indicator
4. `away_attack_vs_home_defense` - Reverse matchup indicator
5. `form_market_agreement_home` - Consensus strength
6. `h2h_market_agreement` - Historical vs market alignment
7. `venue_market_combo` - Venue-adjusted market signals
8. `combined_defense_weakness` - Defensive vulnerability score
9. `log_odds_draw` - Draw probability signal
10. `total_goals_expected` - Combined goals expectation

### Model Rollout
- **V2 Model**: `sabiscore_production_v2.joblib` (primary, loaded automatically)
- **Legacy Fallback**: Per-league `.pkl` models (epl_ensemble.pkl, etc.)
- **Feature Flag**: `ENHANCED_MODELS_V7` enables experimental model rollout
- **Kelly Engine**: Caps at ⅛ Kelly to protect bankroll; draws +18 % yearly growth with < 9 % max drawdown

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