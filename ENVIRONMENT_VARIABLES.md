# 🔐 SabiScore 3.0 Environment Variables Guide

**Last Updated**: 2026-06-11 (Phase 8 Sprint 4 Phase 1)  
**Status**: PRODUCTION READY ✅

## 📋 Quick Reference - Production Values

Set these in your provider dashboards (do not commit raw values):

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | `<set-in-vercel-secret-store>` |
| `WARMUP_SECRET` | `<set-in-vercel-secret-store>` |
| `FOOTBALL_DATA_API_KEY` | `<set-in-provider-secret-store>` |
| `ODDS_API_KEY` | `<set-in-provider-secret-store>` |

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Required Variables](#required-variables)
3. [Optional Variables](#optional-variables)
4. [Production Deployment](#production-deployment)
5. [Security Best Practices](#security-best-practices)

---

## Overview

SabiScore 3.0 uses environment variables for configuration. Variables are categorized by requirement level:

- **🔴 REQUIRED**: Must be set for production deployment
- **🟡 OPTIONAL**: Has sensible defaults, can be customized
- **🟢 AUTO-SET**: Automatically configured by deployment platform

---

## Required Variables

### 🔴 CRON_SECRET
**Purpose**: Authenticates Vercel cron job requests to prevent unauthorized execution

**Production Value**: Set via provider secret store (never commit raw value)

**How to Generate** (if you need a new one):
```bash
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Bash/macOS
openssl rand -base64 32
```

**Where to Set**:
- Vercel Dashboard → Project Settings → Environment Variables
- Add to all environments (Production, Preview, Development)

**Used By**:
- `/api/cron/drift-check` - Runs every 6 hours
- `/api/cron/update-odds` - Runs every 30 minutes

---

### 🟡 ALERT_WEBHOOK_URL
**Purpose**: Webhook URL for sending critical drift alerts (Discord/Slack compatible)

**Required**: No (drift detection still runs without it)

**Format**: 
- Discord: `https://discord.com/api/webhooks/{webhook_id}/{token}`
- Slack: `https://hooks.slack.com/services/{T...}/{B...}/{...}`

**How to Get**:

**Discord**:
1. Server Settings → Integrations → Webhooks
2. Create New Webhook
3. Copy Webhook URL

**Slack**:
1. Browse Apps → Incoming Webhooks
2. Add to Workspace
3. Copy Webhook URL

**Alert Triggers**:
- Brier Score drift ≥ 0.10 (Critical)
- Brier Score drift ≥ 0.05 (Significant)

**Example Payload**:
```json
{
  "embeds": [{
    "title": "🚨 Critical Model Drift Detected",
    "color": 15548997,
    "fields": [
      {"name": "Current Brier", "value": "0.287", "inline": true},
      {"name": "Baseline", "value": "0.215", "inline": true},
      {"name": "Drift", "value": "+0.072 (33.5%)", "inline": true}
    ],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }]
}
```

---

### 🟢 FOOTBALL_DATA_API_KEY
**Purpose**: Fetches upcoming match schedules from football-data.org API

**Production Value**: Set via provider secret store (never commit raw value)

**Required**: No (fallback mode uses cached/sample data)

**Free Tier Limits**:
- 10 requests/minute
- 12 requests/hour  
- Competitions: PL, BL1, SA, PD, FL1, CL

**Used By**:
- `/api/cron/update-odds` - Fetches next 20 upcoming matches
- Cache: 30 minutes

**Fallback Behavior**:
- Returns sample fixtures if API key missing
- Odds cron continues with manual match entry workflow

---

### 🟢 WARMUP_SECRET
**Purpose**: Authenticates forced model warmup requests (POST /api/warmup)

**Production Value**: Set via provider secret store (never commit raw value)

**Required**: No (GET endpoint works without auth)

**Usage**:
```bash
# Force warmup (bypasses 5-minute cooldown)
curl -X POST https://sabiscore.vercel.app/api/warmup \
   -H "Authorization: Bearer <WARMUP_SECRET>"
```

**Warmup Details**:
- Initializes TensorFlow.js ensemble (Dense, LSTM, CNN)
- Reduces first prediction latency from ~3s to ~500ms
- Cooldown: 5 minutes (GET), none (POST with auth)

---

### 🟢 ODDS_API_KEY
**Purpose**: Fetches live betting odds from The Odds API

**Production Value**: Set via provider secret store (never commit raw value)

**Required**: No (manual odds entry still works)

**How to Get**:
1. Visit https://the-odds-api.com/
2. Sign up for free account
3. Copy API key from dashboard

**Free Tier Limits**:
- 500 requests/month
- ~16 requests/day
- Update frequency: Every 30 minutes = 48/day ❌

**⚠️ Recommendation**: 
- Use free aggregator sources (current implementation)
- Reserve Odds API for premium features only

**Alternative Sources** (No API Key):
- OddsPortal scraping (current implementation)
- BetExplorer aggregation
- FlashScore public data

---

## Phase 5 Variables (Backend — Python / Render)

### 🟡 PREDICTION_CACHE_TTL
**Purpose**: TTL in seconds for ML prediction cache entries (T1 Redis → T3 in-memory)
**Default**: `30`
**Alias in config.py**: `PREDICTION_CACHE_TTL`
**Recommended production value**: `30` (balances freshness vs. compute cost)

---

### 🟡 FIXTURE_CACHE_TTL
**Purpose**: TTL in seconds for upcoming-fixture cache entries
**Default**: `300`
**Alias in config.py**: `FIXTURE_CACHE_TTL`
**Recommended production value**: `300` (fixtures change infrequently)

---

### 🟡 UPSTASH_REDIS_URL
**Purpose**: Connection URL for Upstash serverless Redis (Tier-2 cache)
**Default**: not set (Upstash tier disabled)
**Alias in config.py**: `UPSTASH_REDIS_URL`
**Format**: `rediss://default:<token>@<host>.upstash.io:<port>`
**How to get**: Upstash Console → Database → REST API → Redis URL

**Note**: Must also set `UPSTASH_ENABLED=true` to activate.

---

### 🟡 UPSTASH_ENABLED
**Purpose**: Activates the Upstash Tier-2 cache when `UPSTASH_REDIS_URL` is set
**Default**: `false`
**Alias in config.py**: `UPSTASH_ENABLED`
**Values**: `true` | `false`

---

### 🟡 USE_OPTUNA_V4
**Purpose**: Routes prediction requests through Optuna-tuned v4 ensemble models
**Default**: `true`
**Alias in config.py**: `USE_OPTUNA_V4`
**Values**: `true` | `false`
**Note**: Set to `false` to fall back to legacy `_ensemble.pkl` files.

---

### 🟡 OPTUNA_V4_CANARY_PCT
**Purpose**: Fraction of leagues routed to v4_optuna models (0.0 = none, 1.0 = all)
**Default**: `1.0` (100% — full rollout)
**Alias in config.py**: `OPTUNA_V4_CANARY_PCT`
**Range**: `0.0` – `1.0`
**Routing**: MD5 hash of league slug for deterministic, per-league assignment

**Staged rollout example**:
```bash
# 10% canary
OPTUNA_V4_CANARY_PCT=0.10

# 50% rollout
OPTUNA_V4_CANARY_PCT=0.50

# Full rollout (default)
OPTUNA_V4_CANARY_PCT=1.0
```

---

## Phase 6 Variables (Backend — BNN · Causal · RL Agent)

### 🟡 USE_BNN_MEMBER
**Purpose**: Activates the BNN uncertainty path in inference (MCDropout fallback when `false`)
**Default**: `false`
**Alias in config.py**: `USE_BNN_MEMBER`
**Values**: `true` | `false`
**Note**: Set to `true` only after `backend/models/bnn_ensemble.pt` passes all four P6-A gates (ECE ≤ 0.050, Brier ≤ 0.220, 90% CI cov ≥ 0.880, draw ratio ≥ 0.60).

---

### 🟡 EPISTEMIC_THRESHOLD
**Purpose**: Epistemic uncertainty value above which abstention is triggered in the RL agent and marked "LOW_EVIDENCE" in the UI
**Default**: `0.15`
**Alias in config.py**: `EPISTEMIC_THRESHOLD`

---

## Phase 8 Variables (Backend — Sprint 1 Strict Model Readiness)

### 🔴 ACTIVE_LEAGUES
**Purpose**: Comma-separated list of league slugs whose model artifacts are loaded at startup. The backend startup sequence (`_startup_load_models_strict`) fails fast if any listed league has no artifact.  
**Default**: `epl,la_liga,bundesliga,serie_a,ligue_1` (5 leagues; Eredivisie excluded until v6_phase8 artifacts are confirmed)  
**Alias in config.py**: `ACTIVE_LEAGUES`  
**Valid values**: any subset of `epl,la_liga,bundesliga,serie_a,ligue_1,eredivisie`  
**Render env**: set via `render.yaml` `envVars` block; override in the Render dashboard for staged rollouts

**Deployment pattern**:
```bash
# Minimal — 1 league (initial deploy)
ACTIVE_LEAGUES=epl

# Standard — 5 leagues
ACTIVE_LEAGUES=epl,la_liga,bundesliga,serie_a,ligue_1

# Full roster — 6 leagues
ACTIVE_LEAGUES=epl,la_liga,bundesliga,serie_a,ligue_1,eredivisie
```

---

### 🔴 ACTIVE_BASELINE_VERSION
**Purpose**: Artifact version string appended to the league model filename.  
The loader constructs filenames like `{league}_ensemble_{version}.pkl`.  
**Default**: `v5_phase7`  
**Alias in config.py**: `ACTIVE_BASELINE_VERSION`  
**When to change**: bump to `v6_phase8` after Phase 8 retraining produces passing accuracy/log-loss gates and Optuna artifact upload completes.

---

### 🟡 MODEL_BASE_URL
**Purpose**: HTTPS base URL for remote model artifact store (e.g., S3-compatible bucket, GitHub LFS). When set, the loader attempts `{MODEL_BASE_URL}/{version}/{league}_ensemble_{version}.pkl` before falling back to local paths.  
**Default**: not set (local-only loading)  
**Alias in model_fetcher.py**: `MODEL_BASE_URL`  
**Security**: always pair with `MODEL_FETCH_TOKEN`; never expose this URL publicly.

---

### 🟡 MODEL_FETCH_TOKEN
**Purpose**: Bearer token for authenticated artifact downloads from `MODEL_BASE_URL`.  
**Default**: not set  
**Format**: any opaque token string passed as `Authorization: Bearer <token>`  
**Secret management**: set via Render secret group; never commit.

---

### 🔴 BACKEND_URL (Keep-alive target URL)
**Purpose**: Full HTTPS URL of the Render backend, used by `apps/web/src/app/api/cron/ping-backend/route.ts` and by `scripts/keep_alive.py` to warm `/health/ready`.  
**Default**: not set — keep-alive routes/scripts return `{ status: "misconfigured" }` and exit  
**Where to set**:  
- Vercel Dashboard → Project Settings → Environment Variables → Production (for manual or scheduled `/api/cron/ping-backend` calls)  
- GitHub Actions secret `BACKEND_URL` (for `.github/workflows/keep_alive.yml`)  
**Value format**: `https://sabiscore-api.onrender.com` (no trailing slash)  
**Note**: this is a **server-side secret** — do NOT use `NEXT_PUBLIC_` prefix.

**Hobby plan note**: Vercel Hobby blocks sub-daily cron expressions in `apps/web/vercel.json`. Keep frequent warmups in GitHub Actions (`*/14 * * * *`) and trigger Vercel cron routes manually or only on Pro plans.

---

### 🟡 COLD_START_THRESHOLD_S (GitHub Actions keep-alive)
**Purpose**: Latency threshold in seconds above which the `scripts/keep_alive.py` pinger classifies the response as a cold-start event and logs at WARN level.  
**Default**: `5.0`  
**Used by**: `.github/workflows/keep_alive.yml`

---

### 🟡 USE_PHASE8_FEATURES
**Purpose**: Enables the Phase 8 feature-enrichment pipeline (Pi-ratings, Berrar ratings, EWMA form, market movement, match importance).  
**Default**: `false`  
**Values**: `true` | `false`  
**Note**: Do not set to `true` until Phase 8 v6 ensemble artifacts pass all gate checks and `ACTIVE_BASELINE_VERSION=v6_phase8`.  
**Sprint 3 update**: Setting either `USE_PHASE8_FEATURES=true` OR `USE_PHASE8_MODELS=true` now activates the unified `settings.phase8_enabled` gate. Either flag is sufficient to enable Phase 8 enrichment paths across all endpoints (`full_analysis`, `phase8_features`, `upcoming_matches`). This eliminates the prior divergence where the two flags activated different code paths independently.

---

### 🟡 STATSBOMB_STALENESS_MAX_DAYS
**Purpose**: Maximum age (in days) of the StatsBomb feature cache before features are treated as DATA_GAPs rather than stale-but-usable values.  
**Default**: `7` (7 days)  
**Range**: `0` (disabled) – `365`  
**Note**: When set to `0`, staleness enforcement is disabled and all cached rows are used regardless of age. Setting this too low degrades prediction quality; setting too high surfaces stale tactical context as live data.

---

### 🟡 PHASE8_CANARY_PCT
**Purpose**: Fraction of prediction requests routed through the Phase 8 enrichment pipeline (0.0 = none, 1.0 = all).  
**Default**: `0.0`  
**Range**: `0.0` – `1.0`  
**Routing**: deterministic by MD5 hash of `{league}:{match_id}` for per-request stability

**Staged rollout**:
```bash
# 5% canary
PHASE8_CANARY_PCT=0.05

# 25% shadow rollout
PHASE8_CANARY_PCT=0.25

# Full rollout after gate validation
PHASE8_CANARY_PCT=1.0
```

---

## Phase 7 Variables (Backend — Expanded 68 Features)

### 🟡 USE_PHASE7_MODELS
**Purpose**: Enables loading `*_ensemble_v5_phase7.pkl` artifacts with 68-feature inference support
**Default**: `false`
**Alias in config.py**: `USE_PHASE7_MODELS`
**Values**: `true` | `false`

---

### 🟡 PHASE7_CANARY_PCT
**Purpose**: Fraction of leagues routed to Phase 7 model artifacts
**Default**: `0.0`
**Alias in config.py**: `PHASE7_CANARY_PCT`
**Range**: `0.0` – `1.0`
**Routing**: Deterministic by league hash (`phase7:{league}`)

**Suggested rollout**:
```bash
# Canary
PHASE7_CANARY_PCT=0.10

# Half rollout
PHASE7_CANARY_PCT=0.50

# Full rollout
PHASE7_CANARY_PCT=1.0
```

---

### 🟡 ELO_PARQUET_PATH
**Purpose**: Path to persisted Elo pre/post snapshots used by leakage-safe feature generation
**Default**: `data/processed/elo_ratings.parquet`
**Alias in config.py**: `ELO_PARQUET_PATH`

---

### 🟡 STATSBOMB_CACHE_PATH
**Purpose**: Path to tactical feature cache used by StatsBomb aggregation
**Default**: `data/processed/statsbomb_features_cache.parquet`
**Alias in config.py**: `STATSBOMB_CACHE_PATH`

---

### 🟡 STATSBOMB_STALENESS_MAX_DAYS
**Purpose**: Max age in days before tactical cache is considered stale and flagged in `data_gaps`
**Default**: `7`
**Alias in config.py**: `STATSBOMB_STALENESS_MAX_DAYS`
**Range**: `0.0` – `1.0`
**Note**: Matches the `confidence_tier` gate in `UncertaintyService.decompose()` (C12).

---

### 🟡 BNN_MC_SAMPLES
**Purpose**: Number of Monte Carlo forward passes used to compute the 95% credible interval
**Default**: `50`
**Alias in config.py**: `BNN_MC_SAMPLES`
**Range**: `10` – `500` (higher = more accurate CI, slower inference)

---

### 🟡 BNN_MODEL_PATH
**Purpose**: Filesystem path to the trained BNN checkpoint (`.pt` file)
**Default**: `backend/models/bnn_ensemble.pt`
**Alias in config.py**: `BNN_MODEL_PATH`
**Note**: Also accepted at `backend/models/bnn_fallback_mc.pt` (canonical fallback path). MCDropout fallback is activated automatically when this file is absent.

---

### 🟡 RL_AGENT_PATH
**Purpose**: Filesystem path to the trained SAC RL agent checkpoint (`.zip` file, stable-baselines3 format)
**Default**: `backend/models/rl_betting_agent.zip`
**Alias in config.py**: `RL_AGENT_PATH`
**Note**: Kelly-fraction advisory fallback is active when this file is absent. Agent is only written to this path after all four C16 production gates pass on 500 held-out episodes (see `scripts/train_rl_agent.py`).

---

### 🟡 RL_MAX_KELLY_CAP
**Purpose**: Maximum Kelly stake fraction the RL agent may recommend
**Default**: `0.025` (2.5%)
**Alias in config.py**: `RL_MAX_KELLY_CAP`
**Range**: `0.01` – `0.25`
**Note**: Mirrors `MAX_KELLY_CAP` in `apps/web/src/components/betting-agent-panel.tsx`. Both values must match for the UI gauge to display correctly. Lowered from `0.05` to `0.025` for more conservative production bankroll management.

---

### 🟡 RL_ABSTENTION_ENABLED
**Purpose**: Allows the RL agent to output `abstain=true` when epistemic uncertainty exceeds `EPISTEMIC_THRESHOLD`
**Default**: `true`
**Alias in config.py**: `RL_ABSTENTION_ENABLED`
**Values**: `true` | `false`
**Note**: The R_abs reward component (weight 0.05) and the "⚠ Abstain" UI badge are only active when this is `true`.

---

## Optional Variables

---

### Sprint 4 Slice A — CLV Advisory & Ensemble Diversity

#### EDGE_QUALITY_ABSTAIN_THRESHOLD
**Default**: `0.30`
**Type**: float (0.0–1.0)
**Purpose**: Advisory abstain gate for the CLV-centered actionability block. When the composite `edge_quality_score` falls below this threshold the system sets `abstain=true` and `suggested_stake_pct=0.0` regardless of the RL recommendation.
**Raise to** `0.40`+ for a more conservative advisory; **lower to** `0.20` for a more permissive signal.
**Used By**: `backend/src/api/endpoints/full_analysis.py` → `_build_actionability()`

#### ENSEMBLE_CORRELATION_PRUNE_THRESHOLD
**Default**: `0.92`
**Type**: float (0.0–1.0)
**Purpose**: Walk-forward diversity diagnostic threshold. When the max pairwise Pearson correlation between any two base learner home-win probability outputs exceeds this value, a WARNING-level log message advises pruning the redundant learner. Does **not** automatically remove any learner.
**Used By**: `backend/scripts/retrain_with_expanded_features.py` → `_run_walk_forward_eval()` diversity report

#### SHAP_PRUNE_THRESHOLD
**Default**: `0.002`
**Type**: float (≥ 0)
**Purpose**: SHAP ablation prune gate in `validate_feature_expansion.py`. A Phase 8 feature family is flagged `prune_flag=True` when holding it out improves (lowers) RPS by more than this threshold, indicating it adds no signal. Set lower to prune more aggressively; set to `0` to disable pruning.
**Used By**: `backend/scripts/validate_feature_expansion.py`

#### USE_CATBOOST_LEARNER
**Default**: `false`
**Type**: boolean (`true` / `false`)
**Purpose**: Enables CatBoost as a 4th base learner in the stacked ensemble during retraining. CatBoost must be installed (`pip install catboost`). Silently ignored if the package is unavailable.
**Used By**: `backend/scripts/retrain_with_expanded_features.py` → `_build_base_learners()`

#### USE_TWO_STAGE_DRAW_MODEL
**Default**: `false`
**Type**: boolean (`true` / `false`)
**Purpose**: Enables the two-stage draw model during retraining. The draw stage (binary LightGBM + isotonic calibration) is only applied when the per-league walk-forward draw-F1 improvement ≥ `0.03` vs the base model; otherwise the three-class ensemble is used unchanged.
**Used By**: `backend/scripts/retrain_with_expanded_features.py`

#### TRAINING_RECENCY_HALFLIFE_SEASONS
**Default**: `2.0`
**Type**: float (seasons, e.g. `1.5`, `2.0`, `3.0`)
**Purpose**: Exponential decay half-life for recency sample weighting during training. Matches `halflife_seasons` ago receive weight ≈ 0.5. Lower values bias toward recent form; higher values give more weight to historical base-rates.
**Used By**: `backend/scripts/retrain_with_expanded_features.py` → `_compute_recency_weights()`

#### ODDS_STALENESS_MAX_HOURS
**Default**: `24`
**Type**: integer (hours)
**Purpose**: Maximum age of live odds data before the market-drift Phase 8 features are classified as `DATA_GAP`. If the most recent `OddsHistory` row is older than this threshold the five market features (`odds_drift_home`, `odds_drift_draw`, `odds_drift_away`, `odds_volume_change`, `sharp_action_indicator`) are excluded from the live feature vector.
**Used By**: `backend/src/features/market.py` → `compute_market_drift()`

#### PHASE8_ENRICHMENT_SHADOW
**Default**: `false`
**Type**: boolean (`true` / `false`)
**Purpose**: Enables shadow mode for Phase 8 market and match-context enrichment. In shadow mode the enrichment pipeline runs and logs results but does not inject them into the canonical feature vector — all Phase 8 market/context features remain `DATA_GAP`. Useful for validating the pipeline without affecting prediction outputs.
**Used By**: `backend/src/core/config.py` (accessed as `settings.phase8_enrichment_shadow`), `backend/src/services/upcoming_match_feature_service.py`

#### LIVE_THRESHOLD_SECONDS

**Default**: `3600`
**Type**: integer (seconds, min 60)
**Alias in config.py**: `LIVE_THRESHOLD_SECONDS`
**Purpose**: Staleness threshold for the `edge_quality_score` freshness component. The freshness sub-score decays linearly from `1.0` (age = 0) to `0.0` (age ≥ threshold): `freshness_score = max(0, 1 − staleness_seconds / LIVE_THRESHOLD_SECONDS)`. Features older than this value score `0.0` on freshness. Also controls whether a feature's `freshness_seconds` is displayed as `null` (DATA_GAP) vs a live staleness value in the Phase 8 feature endpoint.
**Recommended**: `3600` (1 hour) — matches typical pre-match enrichment window. Reduce to `1800` for higher-frequency markets.
**Used By**: `backend/src/services/upcoming_match_feature_service.py` → `_inject_phase8_features()`, `backend/src/api/endpoints/full_analysis.py` → `_build_actionability()`

---

### Sprint 4 Final Integration — Upcoming Matches & Team Intelligence

No new required env vars. The Sprint 4 final integration adds the following changes to existing endpoints — all governed by existing variables:

| Signal | Governing variable | Default |
| --- | --- | --- |
| `edge_quality_score` freshness decay in `/upcoming/matches` | `LIVE_THRESHOLD_SECONDS` | `3600` |
| Market drift DATA_GAP gate for `edge_quality_score` | `ODDS_STALENESS_MAX_HOURS` | `24` |
| Off-season response fields (`offseason`, `next_season_start`) | hardcoded season table in `offseason.py` | n/a |
| Phase 8 enrichment shadow mode | `PHASE8_ENRICHMENT_SHADOW` | `false` |

New routes added (no additional env vars; all inherit `SABISCORE_BACKEND_URL`):

- `GET /api/v1/teams/{slug}/intelligence` — backend: rolling form, H2H, upcoming fixtures
- `GET /api/teams/{slug}/intelligence` — Next.js proxy
- `/team/{slug}` — frontend team intelligence page

Deployment checklist additions for Sprint 4 Final:

- [ ] Confirm `LIVE_THRESHOLD_SECONDS` is set (default `3600` is production-ready)
- [ ] Confirm `ODDS_STALENESS_MAX_HOURS` is set (default `24` is production-ready)
- [ ] Confirm `PHASE8_ENRICHMENT_SHADOW=false` once Phase 8 enrichment is validated

---

## CORS & Proxy Configuration (Backend — Render)

### CORS_ORIGINS
**Required**: Yes (production)
**Default**: `http://localhost:3000,http://localhost:3001,http://localhost:5173`
**Purpose**: Comma-separated list of exact origins the FastAPI CORS middleware allows.
Must include the Vercel production URL and any custom domain.
```
CORS_ORIGINS=https://sabiscore.vercel.app,https://sabiscore-web.vercel.app,http://localhost:3000
```

### CORS_ORIGIN_REGEX
**Required**: No (but recommended for Vercel preview deployments)
**Default**: unset
**Purpose**: Regex pattern passed to Starlette's `allow_origin_regex`. Allows preview
deployment URLs without listing each one explicitly. `CORS_ORIGINS` only supports exact
string matching — this env var is the only way to cover dynamic preview URLs.
```
CORS_ORIGIN_REGEX=https://sabiscore(-[a-z0-9-]+)?\.vercel\.app
```
**How it works**: Rendered by `backend/src/main.py` as `allow_origin_regex` on the
`CORSMiddleware`. Set alongside `CORS_ORIGINS` — they are additive (either matching
origin list OR regex passes the CORS check).

**CORS architecture note**: All browser-to-backend calls should go through the Vercel
proxy (`/api/v1/*` rewrite → Render), not directly to `sabiscore-api.onrender.com`.
This avoids preflight failures when the Render free-tier instance is cold. The following
patterns have been fixed to use the proxy:
- `BackendWarmup` → `/api/health` (Next.js route)
- `api.ts healthCheck()` → `/api/health`
- `ultra-api-client.ts` → relative base URL in browser

---

### Build Configuration

#### NEXT_TELEMETRY_DISABLED
**Default**: `1` (disabled)
**Purpose**: Disables Next.js anonymous telemetry collection

#### NODE_OPTIONS
**Default**: `--max-old-space-size=8192`
**Purpose**: Allocates 8GB heap for TensorFlow.js model training

---

### API Configuration

#### NEXT_PUBLIC_API_URL
**Default**: `https://sabiscore-api.onrender.com`
**Purpose**: Backend API endpoint for health checks

#### NEXT_PUBLIC_WS_URL
**Default**: `wss://sabiscore-api.onrender.com`
**Purpose**: WebSocket endpoint for real-time updates (future feature)

---

### Betting Configuration

#### NEXT_PUBLIC_CURRENCY
**Default**: `NGN` (Nigerian Naira)
**Options**: `NGN`, `USD`, `EUR`, `GBP`

#### NEXT_PUBLIC_CURRENCY_SYMBOL
**Default**: `₦`
**Linked to**: `NEXT_PUBLIC_CURRENCY`

#### NEXT_PUBLIC_BASE_BANKROLL
**Default**: `10000` (₦10,000)
**Purpose**: Starting bankroll for Kelly Criterion calculations

#### NEXT_PUBLIC_KELLY_FRACTION
**Default**: `0.125` (1/8 Kelly)
**Options**:
- `0.125` - Conservative (recommended)
- `0.25` - Moderate
- `0.5` - Aggressive (full Kelly)

#### NEXT_PUBLIC_MIN_EDGE_NGN
**Default**: `66` (6.6% edge)
**Purpose**: Minimum expected value to recommend bet
**Calculation**: 6.6% of ₦1,000 stake = ₦66 profit

---

### Monitoring Configuration

#### DRIFT_SENSITIVITY
**Default**: `0.05` (5% drift threshold)
**Purpose**: Brier score change threshold for alerts

#### MONITORING_RETENTION_DAYS
**Default**: `90` days
**Purpose**: localStorage data retention period

---

## Production Deployment

### Vercel Setup

1. **Connect Repository**:
   ```bash
   vercel link
   ```

2. **Set Required Variables**:
   ```bash
   # Generate secrets
   $CRON_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   
   # Set in Vercel
   vercel env add CRON_SECRET
   # Paste generated secret
   # Select: Production, Preview, Development
   ```

3. **Set Optional Variables** (Recommended):
   ```bash
   vercel env add ALERT_WEBHOOK_URL
   vercel env add FOOTBALL_DATA_API_KEY
   vercel env add WARMUP_SECRET
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

---

### Environment Checklist

#### Before First Deploy:
- [ ] `CRON_SECRET` generated and set in Vercel
- [ ] `ALERT_WEBHOOK_URL` configured (Discord/Slack)
- [ ] `FOOTBALL_DATA_API_KEY` obtained and set
- [ ] `WARMUP_SECRET` generated and set

#### Phase 8 Sprint 1 — Before Deploy:
- [ ] `ACTIVE_LEAGUES` set to the leagues with uploaded model artifacts
- [ ] `ACTIVE_BASELINE_VERSION` set to match artifact filenames (default `v5_phase7`)
- [ ] `BACKEND_URL` set in Vercel **secret** store (server-side; no `NEXT_PUBLIC_` prefix)
- [ ] `MODEL_BASE_URL` + `MODEL_FETCH_TOKEN` set in Render secret group if using remote artifact store
- [ ] `USE_PHASE8_FEATURES=false` (default; enable only after Phase 8 retraining gates pass)

#### Phase 8 Sprint 4 Phase 1 — Before Deploy:
- [ ] `ODDS_STALENESS_MAX_HOURS=24` (default; reduce to `12` for more aggressive DATA_GAP enforcement)
- [ ] `LIVE_THRESHOLD_SECONDS=3600` (default; reduce to `1800` for high-frequency markets)
- [ ] `EDGE_QUALITY_ABSTAIN_THRESHOLD=0.30` (default; raise to `0.40` for a more conservative advisory)
- [ ] `PHASE8_ENRICHMENT_SHADOW=false` (shadow mode off after Phase 8 enrichment is validated)
- [ ] `STATSBOMB_STALENESS_MAX_DAYS=7` (default; verify data/processed/statsbomb_features_cache.parquet is up to date)
- [ ] Apply migration `backend/migrations/004_add_competition_stage_to_matches.sql` on production DB
- [ ] Confirm UCL fixture rows have `competition_stage` set correctly (`qualifying`, `group`, `r16`, `qf`, `sf`, `final`)

#### After Deploy:
- [ ] Test drift-check cron: `curl https://your-app.vercel.app/api/cron/drift-check?secret=YOUR_CRON_SECRET`
- [ ] Test odds cron: `curl https://your-app.vercel.app/api/cron/update-odds?secret=YOUR_CRON_SECRET`
- [ ] Test warmup: `curl https://your-app.vercel.app/api/warmup`
- [ ] Verify webhook alert (trigger drift manually)
- [ ] Test keep-alive ping: `curl https://your-app.vercel.app/api/cron/ping-backend`
- [ ] Verify `/health/ready` returns `{ status: "ok", models_loaded: true, leagues_loaded: [...] }`

---

## Security Best Practices

### ✅ DO

1. **Use Strong Secrets**:
   - Minimum 32 bytes (256 bits)
   - Cryptographically random
   - Base64 encoded

2. **Rotate Regularly**:
   - `CRON_SECRET`: Every 90 days
   - `WARMUP_SECRET`: Every 90 days
   - `ALERT_WEBHOOK_URL`: After team changes

3. **Limit Scope**:
   - Use read-only API keys when possible
   - Set shortest TTL on tokens
   - Use separate keys per environment

4. **Monitor Usage**:
   - Check API quota consumption
   - Review webhook delivery logs
   - Track cron execution frequency

### ❌ DON'T

1. **Never Commit Secrets**:
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   .env.*.local
   ```

2. **Never Log Secrets**:
   ```typescript
   // ❌ BAD
   console.log('Cron secret:', process.env.CRON_SECRET)
   
   // ✅ GOOD
   console.log('Cron secret:', process.env.CRON_SECRET ? '[REDACTED]' : 'NOT SET')
   ```

3. **Never Share Webhook URLs**:
   - Webhook URLs contain authentication tokens
   - Revoke and regenerate if leaked
   - Use separate webhooks per environment

4. **Never Use Default Values**:
   - Change all `your_*_here` placeholders
   - Generate unique secrets per deployment
   - Don't reuse secrets across projects

---

## Troubleshooting

### Cron Jobs Not Running

**Symptoms**: Drift checks not executing, odds not updating

**Check**:
```bash
# Test cron endpoint manually
curl https://your-app.vercel.app/api/cron/drift-check?secret=YOUR_CRON_SECRET

# Expected response
{"success": true, "message": "Drift check completed"}
```

**Solutions**:
1. Verify `CRON_SECRET` matches route validation, environment variables, and any cron entries configured in `apps/web/vercel.json`
2. Check Vercel Deployments → Functions → Logs
3. Ensure cron schedule is valid (crontab format)

---

### Webhook Alerts Not Sending

**Symptoms**: No Discord/Slack messages on drift detection

**Check**:
```bash
# Test webhook directly
curl -X POST https://discord.com/api/webhooks/YOUR_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

**Solutions**:
1. Verify `ALERT_WEBHOOK_URL` format (must include full URL with token)
2. Check webhook is not rate limited
3. Ensure drift threshold is exceeded (≥5% for significant, ≥10% for critical)
4. Review Vercel function logs for errors

---

### Football Data API Failing

**Symptoms**: No upcoming matches in odds update cron

**Check**:
```bash
# Test API key
curl https://api.football-data.org/v4/matches \
  -H "X-Auth-Token: YOUR_API_KEY"
```

**Solutions**:
1. Verify API key is valid (not expired)
2. Check rate limits (10 req/min)
3. Ensure competitions are in free tier (PL, BL1, SA, PD, FL1, CL)
4. Fallback: Remove `FOOTBALL_DATA_API_KEY` to use manual entry mode

---

### Model Warmup Timeout

**Symptoms**: Warmup endpoint returns 504 timeout

**Solutions**:
1. Increase Vercel function timeout (max 60s for Hobby tier)
2. Use warmup scheduling (not on-demand during traffic)
3. Check TensorFlow.js model files are accessible
4. Review IndexedDB model cache status

---

## Additional Resources

- **Vercel Environment Variables**: https://vercel.com/docs/environment-variables
- **Cron Job Format**: https://crontab.guru/
- **Discord Webhooks**: https://discord.com/developers/docs/resources/webhook
- **Slack Webhooks**: https://api.slack.com/messaging/webhooks
- **Football Data API**: https://www.football-data.org/documentation/quickstart
- **The Odds API**: https://the-odds-api.com/liveapi/guides/v4/

---

## Summary

### Minimum Production Setup (3 variables):
```bash
CRON_SECRET=<generated-32-byte-secret>
ALERT_WEBHOOK_URL=<discord-or-slack-webhook>
FOOTBALL_DATA_API_KEY=<football-data-org-key>
```

### Full Production Setup (6 variables):
```bash
# Required
CRON_SECRET=<generated-32-byte-secret>

# Highly Recommended
ALERT_WEBHOOK_URL=<discord-or-slack-webhook>
FOOTBALL_DATA_API_KEY=<football-data-org-key>
WARMUP_SECRET=<generated-24-byte-secret>

# Optional
NEXT_PUBLIC_BASE_BANKROLL=10000
NEXT_PUBLIC_KELLY_FRACTION=0.125
```

All other variables have production-ready defaults and do not require configuration.
