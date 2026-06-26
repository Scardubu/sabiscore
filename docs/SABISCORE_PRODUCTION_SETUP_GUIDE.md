# SabiScore Production Setup Guide

Last updated: 2026-06-26

This guide reflects the production finalization slice implemented in this repository. The canonical services are:

- Backend: `backend/src/api/main.py`, served as `uvicorn src.api.main:app`
- Frontend: `apps/web`
- Scraper worker: `apps/scraper`

The system is evidence-first and fail-closed. Missing model evidence, missing coherent 1X2 odds, unknown market freshness, stale critical evidence, or source conflict returns `PARTIAL` with `stake="pass"` rather than fabricated probabilities or prices.

Model feature freshness is a critical input. If the stored prediction age is unknown or older than the configured live threshold, the strict engine returns `PARTIAL` instead of treating the forecast as current.

Stored predictions must also carry strict betting-intelligence metadata before they can become executable evidence: `calibration_method`, `calibration_validated`, `epistemic_uncertainty`, `aleatoric_uncertainty`, and `confidence_tier`. If any of those fields are absent or malformed, fixture analysis fails closed with model metadata `DATA_GAP` entries rather than inventing uncertainty.

## Prerequisites

- Python 3.11
- Node.js 22.x
- pnpm 8.x through Corepack
- PostgreSQL 15 or 16
- Redis 7
- Docker with Compose plugin

Puppeteer/Chromium is not required for the default scraper path. Dynamic scrapers must remain disabled unless a reviewed source explicitly requires browser rendering.

## Environment

Use this as the production-safe baseline. Do not require paid odds providers for local verification.

```env
APP_ENV=development
DEBUG=false

DATABASE_URL=postgresql+asyncpg://sabi:local-password@localhost:5432/sabiscore
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=replace-with-random-32-plus-character-secret

SABISCORE_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000

ENABLE_NODE_SCRAPER=true
ENABLE_DYNAMIC_SCRAPERS=false
ENABLE_OPTIONAL_FREE_KEY_PROVIDERS=false
ENABLE_WEATHER=false
ENABLE_LEGACY_INFERENCE=false

SCRAPER_MODE=fixture
SCRAPER_DATA_ROOT=./data
SCRAPER_USER_AGENT=SabiScoreDataResearch/1.0
SCRAPER_MAX_CONCURRENCY=2

MODEL_ARTIFACT_ROOT=./backend/models
BETTING_POLICY_VERSION=1.0
```

Optional provider keys must be disabled by default. If an optional provider fails, returns incomplete data, or exhausts quota, the backend must return unavailable evidence rather than substituting mock/default odds.

## Installation

Linux/macOS:

```bash
corepack enable
pnpm install --frozen-lockfile

python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

Windows PowerShell:

```powershell
corepack enable
pnpm install --frozen-lockfile

py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

Note: in this environment, direct `pnpm --filter ...` commands attempted network package-manager signature verification and failed under restricted network. Local binary equivalents were used for verification where possible.

## Services And Migrations

Start database services:

```bash
docker compose up -d postgres redis
```

Run the backend:

```bash
cd backend
alembic upgrade head
PYTHONPATH=. uvicorn src.api.main:app --reload --port 8000
```

Run the frontend:

```bash
pnpm --filter @sabiscore/web dev
```

The frontend proxies backend calls through server routes and uses `SABISCORE_BACKEND_URL` server-side. Do not expose service tokens to browser code.

## Scraper Worker

Default mode is keyless and fixture-based.

```bash
pnpm --filter @sabiscore/scraper doctor
pnpm --filter @sabiscore/scraper validate
pnpm --filter @sabiscore/scraper scrape:fixtures -- --mode fixture
```

Available commands:

```bash
pnpm --filter @sabiscore/scraper scrape
pnpm --filter @sabiscore/scraper scrape:fixtures
pnpm --filter @sabiscore/scraper scrape:results
pnpm --filter @sabiscore/scraper scrape:metrics
pnpm --filter @sabiscore/scraper scrape:availability
pnpm --filter @sabiscore/scraper scrape:markets
pnpm --filter @sabiscore/scraper validate
pnpm --filter @sabiscore/scraper doctor
pnpm --filter @sabiscore/scraper test
```

The worker uses one stable honest user agent, robots checks, source throttling, retry backoff, and atomic temp-file writes followed by rename. Manifests are immutable JSON files under `data/manifests/node-scraper/`.

Each source registry entry must declare allowed domains, URL patterns, collected fields, transport type, terms-review status, robots policy, frequency, concurrency, timeout, parser/schema versions, enabled environments, owner, attribution, and a kill-switch environment variable. Sources with unclear permission stay disabled by default.

Backend ingestion validates a manifest before trusting any scraper payload:

- manifest JSON schema fields and version;
- status is `SUCCESS` or `PARTIAL`, never `FAILED` or `DISABLED`;
- adapter version is explicitly allowed;
- every raw/processed file stays inside the configured `data/` root;
- no temporary file is ingested;
- every payload exists and matches its SHA-256 hash;
- processed JSON payloads parse successfully.

The validation helper is `backend/src/services/manifest_ingestion.py`; persistence jobs should call it before writing canonical fixtures, feature snapshots, or source-run rows.

## Backend Intelligence Flow

Public API surface:

```text
POST /api/v1/betting-intelligence/analyze
POST /api/v1/betting-intelligence/analyze/single
GET  /api/v1/betting-intelligence/policy
GET  /api/v1/betting-intelligence/health
GET  /api/v1/fixtures/upcoming
GET  /api/v1/fixtures/{fixture_id}/evidence
POST /api/v1/fixtures/{fixture_id}/odds-snapshot
POST /api/v1/fixtures/{fixture_id}/analyze
```

Manual odds snapshots must contain one bookmaker, home/draw/away decimal odds, an observed timestamp, and explicit user confirmation. The backend records provenance and does not fetch user-submitted URLs.

The strict engine ranks qualifying opportunities by confidence-adjusted value first, then expected value, freshness, and stable match ID. Verdict class alone does not promote an opportunity above a stronger evidence-adjusted value score.

## Frontend Intelligence Experience

The production interface is anchored at `/intelligence`. It keeps market math in the backend and renders only returned evidence, verdicts, audits, and freshness states.

UI expectations:

- Use clinical verdict language: `QUALIFIES AT CURRENT PRICE`, `WATCHLIST`, `WAIT FOR LINEUPS`, `PASS`, and `MORE EVIDENCE REQUIRED`.
- Preserve null quantitative fields as unavailable; never render missing evidence as zero.
- Show deliberate states for `NO_BET`, `PARTIAL`, forecast-only analysis, stale data, and source conflict.
- Require one bookmaker, three decimal odds, an observed timestamp, and explicit confirmation before a manual odds snapshot can be submitted.
- Use accessible text and Lucide icons rather than emoji status art.
- Keep animations and motion within the existing CSS/React stack; do not add scroll hijacking or additional motion libraries without a measured need.

## Verification

Commands executed successfully in this environment:

```powershell
$env:DEBUG='false'
.\.venv\Scripts\python.exe -m pytest -q backend\tests\test_manifest_ingestion.py backend\tests\test_betting_intelligence_engine.py --no-cov
.\.venv\Scripts\python.exe -m pytest -q backend\tests\test_core_engine.py --no-cov

$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe backend\scripts\verify_core_engine.py

node apps\scraper\tests\parsers.test.mjs
node apps\scraper\src\cli.mjs validate
node apps\scraper\src\cli.mjs doctor

.\node_modules\.bin\tsc.cmd --noEmit -p apps\web\tsconfig.json
```

Observed results:

- Backend strict engine plus manifest tests: `67 passed`
- Legacy core-engine tests: `6 passed`
- Core smoke: `35/35 passed`
- Scraper tests: `6 passed`
- Scraper validation and doctor: passed, generated immutable audit manifests
- Web TypeScript: passed

Note: this workstation's local `.env` currently contains a non-boolean `DEBUG` value, so verification commands set `DEBUG=false` at process scope. Treat that as an environment hygiene issue before deployment.

Additional release gates still required before claiming full production certification:

- Full backend suite
- Alembic fresh-database upgrade
- OpenAPI validation
- Frontend lint, test, and build through pnpm once package-manager verification is available
- Docker Compose config/build validation
- Secret scan and dependency audit
- Playwright desktop/mobile evidence for the intelligence workflow

## Deployment

Frontend:

- Deploy `apps/web` to Vercel or an equivalent Next.js host.
- Configure `SABISCORE_BACKEND_URL` as a server-only environment variable.
- Do not run scraper or Chromium in Vercel functions.

Backend:

- Deploy FastAPI on a persistent container platform.
- Run migrations as a release command before serving traffic.
- Mount verified model artifacts read-only.
- Configure health/readiness, logs, metrics, PostgreSQL, and Redis.

Scraper:

- Deploy `apps/scraper` as a dedicated worker/container or controlled cron job.
- Use a persistent `data/` volume or object storage.
- Run exactly one scheduler instance.
- Keep source-level kill switches available.

## Rollback

Rollback is service-specific:

- Frontend: redeploy the previous `apps/web` build.
- Backend: deploy the previous image and restore the previous migration state from backup when schema changed.
- Scraper: disable the worker and keep existing immutable manifests for audit.
- Models: revert to the previous approved artifact bundle by version/hash; never auto-promote a retrained model.

## Responsible Use

SabiScore outputs are analytical estimates, not guarantees. `PARTIAL`, `NO_BET`, `PASS`, and `WAIT_FOR_LINEUPS` are deliberate safety outcomes. Users must never treat a model result as financial advice or guaranteed return.
