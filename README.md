# SabiScore

> **Production-grade football intelligence platform — ensemble ML predictions, value bet detection, and 6-layer match analysis for Europe's top leagues.**

Sub-150 ms TTFB · 52.8% 3-way Accuracy · 86-Feature Intelligence · Phase 8 Live Enrichment

SabiScore is a sports ML platform that turns football match data into actionable betting intelligence. It combines a stacked ensemble model trained on 10,700+ real matches with live market signals, causal feature analysis, Elo ratings, and reinforcement-learning stake sizing — all presented through a fast, accessible web interface.

---

## Live Platform

| Surface | URL |
|---|---|
| **Web App** | [sabiscore.vercel.app](https://sabiscore.vercel.app) |
| **Backend API** | [sabiscore-api.onrender.com](https://sabiscore-api.onrender.com) |
| **API Docs** | `/docs` (Swagger UI, auto-generated) |

---

## What SabiScore Does

### For Analysts & Bettors

**Match Intelligence Dashboard** — for any upcoming fixture, SabiScore generates a 6-layer verdict:

| Layer | What it tells you |
|---|---|
| Ensemble Prediction | Win/draw/lose probabilities from a stacked ML model calibrated on 10,700+ matches |
| BNN Uncertainty | Epistemic vs aleatoric breakdown — is the model confident or is this a genuinely noisy game? |
| Causal Drivers | Which features are causally linked to the outcome (not just correlated) |
| RL Stake Sizing | Kelly-criterion stake recommendation from a reinforcement-learning agent |
| Elo Context | Team strength ratings with 5-game trend and momentum cross-signal |
| Phase 8 Signals | Pi-ratings, Berrar ratings, EWMA form, live market drift, match importance score |

Each fixture gets a **verdict**: `HIGH_CONVICTION`, `ACTIONABLE`, `SPECULATIVE`, `HOLD`, or `PARTIAL` (when live data is incomplete).

**Value Bet Scanner** — scans upcoming fixtures and surfaces bets where the model's implied probability exceeds the market's implied probability by ≥ 4.2%. Ranked by edge with Kelly stake sizing.

**Freshness Transparency** — every feature on the dashboard carries a staleness indicator (`LIVE` / `RECENT` / `STALE`). Missing live data is never silently substituted — it surfaces as a `DATA_GAP` and forces a `PARTIAL` verdict.

---

## Model Performance

| Metric | Value | Context |
|---|---|---|
| 3-way accuracy | **52.8%** | Home/Draw/Away classification on 1,606 held-out matches |
| CV accuracy | **51.0%** | 5-fold time-series cross-validation |
| Log loss | **0.973** | Well-calibrated probability outputs |
| Ranked Probability Score | **≤ 0.210** | Release gate for Phase 8 retrained models |
| Value bet ROI (backtest) | **+234%** | With 5% minimum edge filter on test set |
| TTFB (p92) | **118 ms** | Next.js edge rendering + Upstash Redis cache |
| Training data | **10,707 matches** | EPL, La Liga, Serie A, Bundesliga, Ligue 1 · 2019–2025 |

> A 3-way accuracy of 52.8% is professional-grade. The random baseline is 33%; betting-market implied accuracy is 48–52%.

---

## Intelligence Architecture

```
Upcoming Match
      │
      ▼
UpcomingMatchFeatureProjector
  ├── 65 Phase 7 features (form, goals, H2H, Elo, market signals, StatsBomb)
  └── 21 Phase 8 features (Pi-ratings, Berrar, EWMA form, market drift, match importance)
      ↓ per-feature freshness metadata
      │
      ├─ Layer 1: Ensemble Prediction  ────── RF + XGB + LightGBM + CatBoost (gated)
      ├─ Layer 2: BNN Uncertainty      ────── Epistemic / aleatoric decomposition
      ├─ Layer 3: Causal Drivers       ────── Causal selector with ATE / CI / p-values
      ├─ Layer 4: RL Recommendation    ────── Kelly stake sizing agent
      ├─ Layer 5: Elo Context          ────── ELO-based strength + trend + momentum
      └─ Layer 6: Phase 8 Signals      ────── Live market drift, match importance
            │
            ▼
    IntelligenceSynthesizer
    → FullMatchAnalysisResponse
      { verdict, narrative, ensemble, uncertainty, causal_drivers,
        rl_recommendation, elo_context, odds_edge,
        data_gaps, staleness_seconds, per_feature_freshness_seconds }
```

### Feature Registry
| Family | Features | Description |
|---|---|---|
| Phase 7 core (65) | Form, goals, H2H, venue, temporal, market | Production baseline |
| Pi-ratings (6) | `pi_home`, `pi_away`, `pi_diff`, attack/defense | Dynamic team strength |
| Berrar ratings (3) | `berrar_home`, `berrar_away`, `berrar_diff` | Alternative rating system |
| EWMA form (6) | Exponentially weighted win/draw/loss rates | Recency-weighted form |
| Market drift (5) | `odds_drift_home/draw/away`, `max_abs_odds_drift`, `sharp_money_direction` | Sharp money signals |
| Match context (1) | `match_importance_score` | Stage × title race × relegation weight |

### Core Engine v2.1

`POST /api/v1/core-engine/analyze` is the deterministic betting-decision layer for verified pre-match envelopes. It does not fetch live data or reuse legacy value-bet fallbacks. It validates model probabilities, unified 1X2 odds, source status, and freshness metadata before calculating de-vigged market probabilities, edge, expected value, confidence-adjusted value, and capped fractional Kelly stake sizing.

Supported verdicts are `HIGH_CONVICTION`, `ACTIONABLE`, `SPECULATIVE`, `HOLD`, `NO_BET`, and `PARTIAL`. `PARTIAL`, `HOLD`, and `NO_BET` always return `stake: "pass"` and `stake_fraction: 0.0`; `PARTIAL` also locks value fields such as `best_market`, `edge`, `expected_value`, and `minimum_acceptable_odds` to `null`.

### Data Quality Contracts

- **No synthetic fill** — missing live data is never substituted with fake values. It goes in `data_gaps`.
- **PARTIAL verdict** — any `data_gaps` force a `PARTIAL` verdict, regardless of model confidence.
- **True CLV** — Closing Line Value is computed as `model_prob − 1/closing_odds` and is only available post-match. Pre-match EV is labelled `ev_cents`, not CLV.
- **Walk-forward evaluation only** — all release gate metrics use expanding-window temporal splits. No random k-fold.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18 + RSC, Tailwind CSS v3, Framer Motion |
| Backend | FastAPI, Python 3.11+, SQLAlchemy (async), Pydantic v2 |
| ML | scikit-learn, XGBoost, LightGBM, CatBoost (gated), SHAP |
| Database | PostgreSQL 16, Alembic migrations |
| Cache | Redis (Upstash-compatible), in-memory LRU |
| Infra | Vercel (frontend), Render (backend), GitHub Actions CI |
| Observability | Prometheus + Grafana, Sentry, Vercel Speed Insights |

---

## Monorepo Layout

```
sabiscore/
├── apps/
│   ├── web/                 # Next.js 15 App Router frontend
│   └── ws/                  # WebSocket relay for live odds
├── backend/
│   ├── src/
│   │   ├── api/endpoints/   # FastAPI routes (predictions, full-analysis, phase8-features…)
│   │   ├── models/          # Ensemble, BNN, causal selector, feature registry
│   │   ├── services/        # Intelligence synthesizer, prediction, RL agent, Elo engine
│   │   ├── features/        # Pi-ratings, market drift, match context feature builders
│   │   └── data/            # Scrapers, enrichment, StatsBomb aggregator
│   └── scripts/
│       ├── retrain_with_expanded_features.py   # 86-dim Phase 8 retraining pipeline
│       ├── validate_feature_expansion.py       # SHAP ablation gate
│       └── evaluate_baseline_v8.py             # RPS / draw_F1 / balanced_accuracy gates
├── packages/
│   ├── ui/                  # Shared component library (Radix + shadcn)
│   └── analytics/           # Shared TypeScript helpers
└── models/                  # Calibrated model artifacts
```

---

## Getting Started

### Prerequisites

- Node.js **22.x** · Python **3.11+** · PostgreSQL 16 · Redis 7

### Local Development

```bash
# 1. Clone
git clone https://github.com/Scardubu/sabiscore.git
cd sabiscore

# 2. Install JS dependencies (pnpm workspaces)
pnpm install

# 3. Start frontend
cd apps/web && pnpm dev          # http://localhost:3000

# 4. Start backend (separate terminal)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000
```

### Environment Variables

**`backend/.env`**
```env
DATABASE_URL=postgresql://sabiscore:<password>@localhost:5432/sabiscore
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=replace_me_with_a_random_secret
APP_ENV=development

# Phase 8 feature flags
USE_PHASE8_FEATURES=true
ACTIVE_BASELINE_VERSION=v6_phase8
PHASE8_FEATURES_ENABLED=true
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
SABISCORE_BACKEND_URL=http://localhost:8000
BACKEND_TOKEN=development-token
```

### Generate Local Model Artifacts

```bash
# Create dummy models when production artifacts are unavailable
python backend/scripts/generate_dummy_models.py --outdir ./models
python backend/scripts/validate_models.py --models-dir ./models
```

---

## Retraining Pipeline (Phase 8)

```bash
# Full 86-dim retrain with walk-forward evaluation and RPS gate
python backend/scripts/retrain_with_expanded_features.py \
  --walk-forward \
  --leagues EPL "La Liga" Bundesliga "Serie A" "Ligue 1" \
  --halflife 2.0

# SHAP ablation — test each Phase 8 feature family
python backend/scripts/validate_feature_expansion.py \
  --shap-ablation \
  --shap-threshold 0.002

# Evaluate against prior baseline (regression gate)
python backend/scripts/evaluate_baseline_v8.py \
  --baseline-report reports/baseline_v7.json \
  --model-path models/ensemble_v6_phase8.pkl
```

Release gates (all must pass):
- RPS ≤ 0.210
- draw_F1 non-degrading vs baseline
- balanced_accuracy non-degrading vs baseline

---

## API Reference

All routes are prefixed `/api/v1`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Service health + model readiness |
| `POST` | `/insights` | Full prediction for a matchup string |
| `POST` | `/core-engine/analyze` | Deterministic v2.1 betting decision engine for verified pre-match inputs |
| `GET` | `/matches/upcoming` | Upcoming fixtures with enriched odds |
| `GET` | `/matches/upcoming/{id}/full-analysis` | 6-layer intelligence verdict |
| `GET` | `/matches/upcoming/{id}/phase8-features` | Phase 8 enriched feature groups |
| `GET` | `/predictions/value-bets/today` | Today's value bets |
| `GET` | `/value-bets/` | Paginated value bet list with filters |

**Full-analysis response shape (abridged):**
```json
{
  "match_id": "Arsenal vs Chelsea",
  "verdict": "ACTIONABLE",
  "ensemble": { "home_win_prob": 0.48, "draw_prob": 0.27, "away_win_prob": 0.25, "confidence": 0.48 },
  "uncertainty": { "epistemic_unc": 0.11, "aleatoric_unc": 0.14, "confidence_tier": "OK" },
  "causal_drivers": ["elo_difference", "pi_home_attack", "sharp_money_direction"],
  "rl_recommendation": { "stake_fraction": 0.018, "abstain": false },
  "elo_context": { "home_elo": 1724, "away_elo": 1698, "elo_difference": 26 },
  "odds_edge": { "market": "home_win", "edge": 0.063, "kelly_stake": 0.012 },
  "narrative": "Model: home win (48.0%, OK). Elo: home +26pts. Causal: elo_difference, pi_home_attack. RL: stake 1.8%. [ACTIONABLE]",
  "partial_intelligence": false,
  "data_gaps": [],
  "staleness_seconds": 1840,
  "freshness_tag": "RECENT",
  "per_feature_freshness_seconds": { "pi_home_attack": 1840, "sharp_money_direction": 720 }
}
```

**Core-engine response shape (abridged):**
```json
{
  "engine_version": "2.1.0-prod",
  "top_opportunities": ["match-123"],
  "matches": [
    {
      "match_id": "match-123",
      "verdict": "ACTIONABLE",
      "best_market": "HOME_ML",
      "edge": 0.058,
      "expected_value": 0.12,
      "stake": "1u",
      "stake_fraction": 0.015,
      "data_gaps": [],
      "calculation_audit": {
        "bookmaker": "TestBook",
        "market_overround": 1.061,
        "kelly_fraction": 0.125,
        "kelly_cap": 0.025
      }
    }
  ]
}
```

Full contract: [`docs/CORE_ENGINE.md`](./docs/CORE_ENGINE.md).

---

## Quality Gates

| Scope | Command |
|---|---|
| Lint + Types | `pnpm lint && pnpm typecheck` |
| Frontend tests | `cd apps/web && pnpm test` |
| Backend tests | `cd backend && pytest tests -v --cov=src` |
| Backend smoke | `./scripts/smoke-test-backend.ps1` |
| ML gates | `python backend/scripts/evaluate_baseline_v8.py` |

---

## Deployment

- **Frontend**: Vercel auto-deploys from the default branch (`master` in this repository). `apps/web/vercel.json` is the canonical config.
- **Backend**: Render auto-deploys via `render.yaml`. Health check at `/health`.
- **CI**: GitHub Actions validates lint, tests, and model artifacts on every push.

---

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md) for the full history of changes, including Phase 8 Sprint 4+ entries covering:
- Per-feature freshness propagation through the full stack
- True CLV correction (CLV now null pre-match; EV labelled correctly)
- Async session migration in the full-analysis endpoint
- Phase 8 narrative enrichment with live market drift and match importance
- 86-dim retraining pipeline with SHAP ablation and RPS gates

---

## Contributing

1. Fork and create a feature branch: `git checkout -b feat/your-feature`
2. Run `pnpm lint && pnpm typecheck` and `pytest tests -v` locally
3. Commit using conventional commits (`feat:`, `fix:`, `docs:`) with a clear body
4. Open a PR — CI must stay green before merge

---

## License

MIT — see [`LICENSE`](./LICENSE) for details.
