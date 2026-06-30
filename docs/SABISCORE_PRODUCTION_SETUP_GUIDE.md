# SabiScore Production Setup Guide

Last updated: 2026-06-28

This is the authoritative setup and deployment guide for the finalized production shape.

## Canonical Services

| Surface | Path | Role |
|---|---|---|
| Backend | `backend/src/api/main.py` | FastAPI authority for evidence, providers, analysis, verdicts, EV, and Kelly sizing |
| Web | `apps/web` | Next.js public frontend and backend proxy routes |
| Scraper | `apps/scraper` | Permitted batch acquisition, raw snapshots, processed files, manifests, parser validation |

`apps/api` and `frontend/` are legacy-only and must not be referenced by production scripts, deploy configuration, or runbooks.

## Safe Defaults

Production and template defaults must remain fail-closed:

```env
DEBUG=false
MOCK_MODE=false
ENABLE_LEGACY_INFERENCE=false
SCRAPER_ALLOW_INSECURE_FALLBACK=false
ALLOW_SQLITE_FALLBACK=false
SABISCORE_ALLOW_INSECURE_FALLBACK=false
PROVIDER_LIVE_TESTS=false
```

Database tables are created by Alembic only. App import/startup does not call `Base.metadata.create_all()` or `Base.metadata.drop_all()`.

SQLite fallback is permitted only for isolated tests or an explicit local development opt-in with `SABISCORE_ALLOW_INSECURE_FALLBACK=true` and a non-production `APP_ENV`. Production rejects SQLite fallback.

## Environment Matrix

Backend-only provider keys:

| Variable | Required | Notes |
|---|---:|---|
| `FOOTBALL_DATA_API_KEY` | Optional | Official fixture/standing provider |
| `API_FOOTBALL_KEY` | Optional | Authenticated enrichment provider |
| `SPORTMONKS_API_KEY` | Optional | Authenticated enrichment provider |
| `THE_ODDS_API_KEY` | Optional | Current market snapshots |

Frontend/server variables:

| Variable | Scope | Notes |
|---|---|---|
| `SABISCORE_DATABASE_URL` | Docker Compose backend | Optional compose override; defaults to the `postgres` service DNS name |
| `SABISCORE_REDIS_URL` | Docker Compose backend | Optional compose override; defaults to the `redis` service DNS name |
| `SABISCORE_BACKEND_URL` | Next.js server | Backend origin for proxy routes |
| `NEXT_PUBLIC_APP_URL` | Browser-safe | Public app URL only |
| `NEXT_PUBLIC_CURRENCY` | Browser-safe | Display currency |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | Browser-safe | Display label |
| `NEXT_PUBLIC_BASE_BANKROLL` | Browser-safe | UI default only |

ESPN is keyless. Any previously exposed provider key must be rotated in the provider/platform console after repo sanitization.

Credential safety:

- Keep `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `DB_PASSWORD`, and provider keys blank in committed templates.
- Do not create `NEXT_PUBLIC_*` provider keys.
- Rotate any provider key that ever appeared in historical documentation. The current tree is redacted; `.gitleaksignore` only suppresses known legacy fingerprints until a reviewed history rewrite is scheduled.
- Run the focused safety gate before release:

```bash
cd backend
python -m pytest tests/test_secret_safety.py tests/test_database_migration_hardening.py tests/test_providers_gateway.py -q --no-cov
```

- CI runs Gitleaks with redacted output and full Git history before test jobs in `.github/workflows/ci.yml`.
- Local release scans should use the installed Gitleaks binary before committing:

```bash
gitleaks detect --source . --redact --verbose
```

## Install

Python 3.11 through 3.14 is supported for the API runtime. Python 3.14 installs use newer wheel-backed scientific packages in `backend/requirements.txt`. Optional training/experiment packages such as CatBoost, SHAP, MLflow, and Great Expectations remain Python <3.14 extras because they are not required for API boot or provider intelligence and have historically been fragile on brand-new Python releases.

Kafka clients and browser automation packages are optional worker dependencies on Python 3.14/Windows and are not part of the canonical API/provider-gateway boot path. Install them in a Python 3.11-3.13 worker environment if Kafka or dynamic browser scraping is explicitly enabled.

Use Node 22 through 24 and pnpm 8 through 11 with the committed `pnpm-lock.yaml`. On Windows, skip `corepack enable` unless running an elevated shell; a user-scoped pnpm install is sufficient.

Windows PowerShell:

```powershell
pnpm install --frozen-lockfile

py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

Linux/macOS:

```bash
pnpm install --frozen-lockfile

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

## Run Locally

```bash
cd backend
alembic upgrade head
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
pnpm --filter @sabiscore/web dev
```

```bash
pnpm --filter @sabiscore/scraper doctor
pnpm --filter @sabiscore/scraper test
```

## Provider Gateway

All provider traffic goes through `backend/src/providers/`.

Provider responsibilities:

| Provider | Trust tier | Use |
|---|---|---|
| ESPN | `UNOFFICIAL_PUBLIC` | Keyless supplementary discovery/readiness only |
| football-data.org | `OFFICIAL_AUTHENTICATED` | Fixtures and standings |
| API-Football | `OFFICIAL_AUTHENTICATED` | Enrichment, lineups, injuries, stats, odds where licensed |
| Sportmonks | `OFFICIAL_AUTHENTICATED` | Optional enrichment where licensed |
| The Odds API | `OFFICIAL_AUTHENTICATED` | Coherent current 1X2 market snapshots |

CLI:

```bash
cd backend
python -m src.cli providers doctor
python -m src.cli providers capabilities
python -m src.cli providers quota
```

API:

```text
GET /api/v1/providers
GET /api/v1/providers/health
GET /api/v1/providers/capabilities
GET /api/v1/providers/quota
```

Provider output is redacted and returned in a standard envelope with trust tier, status, quota, warnings, snapshot hash, and acquired timestamp.

Provider health distinguishes configuration from verification. With live provider probes disabled, enabled providers return `CONFIGURED_UNVERIFIED`, not `VERIFIED`. A provider reaches `VERIFIED` only after a provider-specific live probe or successful live data operation validates the upstream path.

The provider registry and its shared `httpx.AsyncClient` are created once in the FastAPI lifespan (`app.state.provider_registry`, `app.state.http_client`) and injected into every request via `Depends(get_provider_registry)` — never instantiated per request. CLI tools and tests may still call `build_provider_registry()` directly without a client; providers fall back to an ad-hoc per-call client in that case.

## Intelligence Flow

Fixture workflow:

```text
GET  /api/v1/fixtures/upcoming
GET  /api/v1/fixtures/{fixture_id}
GET  /api/v1/fixtures/{fixture_id}/evidence
POST /api/v1/fixtures/{fixture_id}/refresh
GET  /api/v1/fixtures/{fixture_id}/odds-snapshots
POST /api/v1/fixtures/{fixture_id}/odds-snapshot
POST /api/v1/fixtures/{fixture_id}/analyze
```

The strict betting engine remains the only source of verdict, expected value, edge, and Kelly stake sizing. UCL fixtures cannot become `HIGH_CONVICTION`.

Only critical gaps force a `PARTIAL` verdict: missing/invalid required model probabilities, unresolved fixture identity, missing coherent 1X2 market data for value analysis, or stale required inputs. Advisory gaps and risks such as provisional lineups, optional injury context, or low-confidence contextual signals may reduce confidence or hold promotion, but they do not trigger `PARTIAL` by themselves. Conflicting source evidence remains fail-closed and is reported separately from critical gaps.

Market rules:

- Analysis uses one bookmaker's coherent 1X2 snapshot.
- Manual odds require explicit user confirmation and one bookmaker.
- Cross-bookmaker comparison is display-only.
- Missing or conflicting evidence returns a pass/partial state.

## Web

`apps/web` must not call provider hosts directly and must not import TensorFlow.js for production inference/training. Next.js server routes proxy the backend using `SABISCORE_BACKEND_URL`. The browser-side TensorFlow.js modules (`lib/ml/`) and their unreachable demo components have been removed from the tree entirely — `/dev/train-tfjs` is a static disabled-state page with no client-side model code behind it.

The `/intelligence` UI includes competition selection, team autocomplete, date filtering, fixture cards, readiness rail, odds auto-fill candidates, manual fallback, decision card, model-vs-market comparison, evidence passport, price window, source comparison drawer, and outage states.

Language must remain quiet and analytical. Do not add promotional betting copy.

The certified match dashboard renders backend-returned probabilities, edge, expected value, Kelly sizing, critical gaps, advisory gaps, conflicts, and decision identifiers. It must not recompute official verdicts, expected value, or stake sizing in the browser.

## Scraper Boundaries And Activated Data Flow

`apps/scraper` may acquire permitted open/batch data, write immutable raw snapshots, produce processed files, write manifests, and validate parsers. It must not calculate predictions, verdicts, EV, Kelly stakes, or user-facing decisions.

The reviewed keyless Football-Data CSV path now produces three distinct artifact classes:

```bash
pnpm --filter @sabiscore/scraper scrape:fixtures -- --competition EPL --season 2425
pnpm --filter @sabiscore/scraper scrape:results -- --competition EPL --season 2425
pnpm --filter @sabiscore/scraper scrape:metrics -- --competition EPL --season 2425
```

Outputs are written atomically under `data/processed/node-scraper/` with immutable manifests under `data/manifests/node-scraper/`. Team-form projections include only completed-match evidence and are consumed by `backend/src/services/scraped_feature_store.py` when database form data is unavailable. Historical market columns remain training/audit evidence and are explicitly non-executable.

Legacy Betfair, Flashscore, OddsPortal, Soccerway, Transfermarkt, Understat, and WhoScored compatibility modules no longer generate random odds, xG, scores, lineups, ratings, form, or squad values. They return reviewed local snapshots or fail closed. Dynamic/Puppeteer acquisition remains disabled until a source-specific terms, robots, parser, and operational review is approved.

## Release Gates

Run deterministic offline checks first:

```bash
make verify-core
```

This runs focused backend safety/provider/engine/scraper regressions, OpenAPI validation, the provider doctor in offline mode, scraper parser and manifest checks, and Python compilation.

Run the full production certification gate in an environment with pnpm, PostgreSQL, Docker, Playwright browsers, and Gitleaks:

```bash
make verify
```

The full target additionally requires:

- a real Gitleaks scan;
- the complete backend suite;
- Alembic upgrade and schema drift validation;
- web lint, typecheck, component tests, and production build;
- Docker Compose validation and image builds;
- Playwright desktop/mobile smoke tests;
- final OpenAPI regeneration.

No material gate is suppressed with `|| true`. A skipped or unavailable dependency prevents production certification and must be reported.

## Rollback

1. Disable optional provider flags first.
2. Keep the backend up so the web app can render fail-closed outage states.
3. Roll back database schema only with reviewed Alembic downgrade or forward-fix migration.
4. Re-run `python -m src.cli providers doctor` and `make verify` before restoring traffic.

## Known Limitations

- Live provider tests are opt-in with `PROVIDER_LIVE_TESTS=false` by default.
- Provider quotas are observed and exposed but require provider-specific headers for exact remaining/reset values.
- Legacy code remains for compatibility, but production entrypoints are canonicalized to `backend`, `apps/web`, and `apps/scraper`.

## Final certification workflow

### Canonical Vercel project

The canonical frontend project is `sabiscore` (`prj_OZ9E1XDcZMO1G5Zdhj4Dq6OeSzjo`), which owns `sabiscore.vercel.app`. The repository-level ignored-build command automatically skips the duplicate `web` and `sabiscore-web` projects. This is non-destructive: the legacy projects remain available for rollback but no longer perform duplicate builds.

`SABISCORE_BACKEND_URL` is server-only and must resolve to the deployed FastAPI origin. The checked-in Vercel configuration uses `https://sabiscore-api.onrender.com`; replace that value in both `vercel.json` files if the backend moves. Browser CSP remains `connect-src 'self'` because provider and backend traffic is proxied by Next.js server routes.

### Scraped feature activation

Run the reviewed static-source pipeline before prediction refreshes:

```bash
pnpm --filter @sabiscore/scraper scrape:results
```

Artifacts are written under `data/processed/node-scraper/`. `ScrapedTeamFormStore` validates the artifact schema, result counts, PPG arithmetic, goal-difference arithmetic, source date, team identity, competition, and prediction cutoff. The canonical projector uses this real data only when database match history is unavailable; unresolved fields remain explicit `DATA_GAP` values.

### Complete release gate

Requirements: Python 3.11, Node 22, pnpm 11.8, Docker with Compose, PostgreSQL, Redis, and Chromium dependencies. Then run:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
corepack enable
corepack prepare pnpm@11.8.0 --activate
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
cp .env.production.example .env.production
# Fill DATABASE_URL, REDIS_URL, SECRET_KEY, BACKEND_TOKEN, and provider keys.
make verify
```

The same command runs in `.github/workflows/production-certification.yml` for every pull request and push to `master`. Live provider calls remain disabled; enable and verify them separately with controlled quotas.

### Backend artifact path in containers

The backend reads scraper projections from `SCRAPER_PROCESSED_ROOT`. For the
committed production Compose topology this is `/app/data/processed/node-scraper`,
backed by the read-only `./data:/app/data` mount. For non-container deployments,
set the variable to an absolute persistent-disk path or keep the canonical
repository layout so automatic discovery resolves `data/processed/node-scraper`.

### Non-destructive Vercel consolidation

Do not delete the `web` or `sabiscore-web` projects until DNS, aliases, and
rollback retention have been reviewed in the Vercel dashboard. The committed
ignored-build script makes `sabiscore` the only project that builds new Git
commits; the other projects remain inert rollback references. After one stable
release, archive or delete the duplicates manually in Vercel Project Settings.
