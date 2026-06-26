# SabiScore Betting Intelligence Production Setup Guide

## Architecture

SabiScore now uses a hybrid zero-paid-API ingestion and intelligence path:

1. `apps/scraper` scrapes allowlisted public football data sources with rate limiting, robots checks, user-agent rotation, retry/backoff, and circuit breaking.
2. Scraper outputs are written to `data/raw/node-scraper` and `data/processed/node-scraper` with a manifest for freshness and provenance.
3. The FastAPI backend owns prediction and strict betting analysis through `/api/v1/betting-intelligence/*`.
4. The Next.js app proxies strict analysis through `/api/betting-intelligence/analyze` and renders the dashboard at `/intelligence`.

No new production path requires a paid API key.

## Environment Setup

Install dependencies from the repo root:

```powershell
pnpm install
python -m venv .venv
.\.venv\Scripts\pip.exe install -r backend\requirements.txt
```

Minimum local environment:

```text
SABISCORE_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
ENABLE_LEGACY_INFERENCE=false
USE_PHASE7_MODELS=true
SABISCORE_SCRAPER_RESPECT_ROBOTS=true
SABISCORE_SCRAPER_DELAY_MS=2500
```

## Running Locally

Validate scraper storage and policy:

```powershell
pnpm --filter @sabiscore/scraper validate
```

Run public fixture scraping:

```powershell
pnpm --filter @sabiscore/scraper scrape:fixtures
```

Run metric placeholder validation:

```powershell
pnpm --filter @sabiscore/scraper scrape:metrics
```

Start backend:

```powershell
$env:PYTHONPATH="backend"
uvicorn src.api.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

Start web:

```powershell
pnpm --filter @sabiscore/web dev
```

Open:

```text
http://localhost:3000/intelligence
```

## Strict Engine API

Backend routes:

```text
POST /api/v1/betting-intelligence/analyze
POST /api/v1/betting-intelligence/analyze/single
GET  /api/v1/betting-intelligence/policy
GET  /api/v1/betting-intelligence/health
```

Frontend proxy:

```text
POST /api/betting-intelligence/analyze
GET  /api/betting-intelligence/policy
```

The strict engine evaluates all three 1X2 markets, de-vigs market probabilities, requires positive edge and EV for actionable verdicts, and returns `PARTIAL` instead of substituting fabricated values when critical evidence is absent.

## UI/UX Notes

The strict analysis surface lives at:

```text
http://localhost:3000/intelligence
```

Production UI defaults:

- `NO_BET`, `HOLD`, and `PARTIAL` are displayed as pass/no-execution outcomes.
- Missing odds or invalid model probabilities are sent as `DATA_GAP`, never as fabricated values.
- Placeholder numeric values render as `-` so missing data cannot be mistaken for zero.
- The dashboard uses local/system font stacks and CSS motion only, avoiding external font requests.
- Responsible-gambling copy remains visible on every analysis result.

## Verification

Backend contract tests:

```powershell
$env:PYTHONPATH="backend"
pytest -q backend\tests\test_betting_intelligence_engine.py --no-cov
python backend\scripts\verify_core_engine.py
```

Scraper tests:

```powershell
pnpm --filter @sabiscore/scraper test
```

If the local pnpm shim cannot verify its package-manager binary in a restricted network, the scraper tests can be run directly:

```powershell
node --test apps\scraper\tests\*.test.mjs
```

Frontend checks:

```powershell
pnpm --filter @sabiscore/web typecheck
pnpm --filter @sabiscore/web lint
pnpm --filter @sabiscore/web build
```

Equivalent direct commands, useful when pnpm is unavailable:

```powershell
cd apps\web
..\..\node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit
..\..\node_modules\.bin\eslint.cmd src --ext .ts,.tsx --max-warnings 0
..\..\node_modules\.bin\next.cmd build
```

## Production Defaults

- Treat `NO_BET`, `HOLD`, and `PARTIAL` as pass/no-execution verdicts.
- Treat `freshness_tag="UNKNOWN"` as not live.
- Keep `SABISCORE_SCRAPER_RESPECT_ROBOTS=true`.
- Keep paid connector env vars unset for this pipeline.
- Review `data/processed/node-scraper/manifest.json` before each ingestion promotion.
