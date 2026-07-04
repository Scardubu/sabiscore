# SabiScore Production Setup Guide

Last updated: 2026-07-04

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
| `API_FOOTBALL_API_KEY` | Optional | Authenticated enrichment provider |
| `SPORTMONKS_API_TOKEN` | Optional | Authenticated enrichment provider |
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
python -m src.cli providers status       # one-line health summary per provider
python -m src.cli providers doctor
python -m src.cli providers capabilities
python -m src.cli providers quota
```

`providers status` and `providers doctor` are safe offline/configuration commands
by default. Their public report shape is intentionally limited to `provider` and
one of `configured`, `missing`, `invalid`, `quota_exhausted`, or
`temporarily_unavailable`. Live validation is opt-in only with
`providers doctor --validate-live`; startup and default CI must not spend
free-tier provider quota.

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

The strict betting engine remains the only source of verdict, expected value,
edge, and Quarter-Kelly stake sizing. UCL fixtures cannot become
`HIGH_CONVICTION`. Raw Kelly math is internal audit detail and is not returned by
public backend schemas or frontend TypeScript contracts.

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

The certified match dashboard renders backend-returned probabilities, edge,
expected value, Quarter-Kelly sizing, critical gaps, advisory gaps, conflicts,
and decision identifiers. It must not recompute official verdicts, expected
value, or stake sizing in the browser. Do not expose `NEXT_PUBLIC_KELLY_FRACTION`
or any provider credential to the web bundle.

## Scraper Boundaries

`apps/scraper` may acquire permitted open/batch data, write immutable raw snapshots, produce processed files, write manifests, and validate parsers. It must not calculate predictions, verdicts, EV, Kelly stakes, or user-facing decisions.

## Release Gates

```bash
make verify
```

The target runs:

- secret/public-provider scans and database migration hardening checks;
- provider gateway tests;
- backend regression tests;
- provider CLI doctor;
- scraper tests;
- web lint;
- web typecheck;
- web tests;
- web build.

Additional deployment gates:

- Alembic upgrade against a fresh database;
- OpenAPI validation;
- Docker Compose config/build validation;
- Playwright desktop/mobile `/intelligence` smoke where browser tooling is available.

Latest local Phase 1-2 evidence on 2026-07-04:

- `python -m src.cli providers doctor` and `providers status` passed in offline
  mode with the five-state public contract and no credential values printed.
- `pytest tests/test_provider_cli_contract.py tests/test_league_policy_contract.py tests/test_zero_fabrication_contract.py -q --no-cov` passed.
- `pytest tests/test_betting_intelligence_engine.py tests/test_core_engine.py -q --no-cov` passed.
- `pnpm --filter @sabiscore/web typecheck` passed.
- `python scripts/verify_openapi.py` passed with 78 paths.
- `gitleaks detect --no-git --source . --redact --exit-code 1` passed after
  excluding ignored local env files, backend artifacts, and local worktrees from
  source scans.
- `pnpm --filter @sabiscore/web test` and `pnpm --filter @sabiscore/web build`
  remain blocked in this Windows shell by child-process `spawn EPERM` during
  Vitest/esbuild or Next.js post-compile worker startup.
- `docker compose -f docker-compose.prod.yml config` passed; Docker image build
  remains blocked in this shell by local Docker Buildx lock-file permissions.
- `backend/src/data/transformers.py` still contains legacy `FEATURE_DEFAULTS[...]`
  fallback usage in feature-engineering code. Do not mark zero-fabrication fully
  certified until that path raises `DataUnavailableError` or is proven outside
  production inference.

Do not merge a certification branch directly if it is stale against `master` or
contains unrelated broad churn. Port verified fixes onto current `master`, then
run the full release matrix before tagging the release.

## Rollback

1. Disable optional provider flags first.
2. Keep the backend up so the web app can render fail-closed outage states.
3. Roll back database schema only with reviewed Alembic downgrade or forward-fix migration.
4. Re-run `python -m src.cli providers doctor` and `make verify` before restoring traffic.

## vΩ.2 Changes (2026-07-04)

- CI workflows (`ci.yml`, `secret-scan.yml`) now trigger on `master` branch — previously only fired on `main`/`develop`.
- `nginx.conf` created at repo root; `docker-compose.prod.yml` nginx mount now valid. `./ssl/` certs still required for TLS.
- All three Docker healthcheck paths aligned to `/api/v1/health/live`.
- `PREMIUM_VISUAL_HIERARCHY` flag enabled by default; premium homepage now shown to all users.
- Test deps (`pytest`, `pytest-asyncio`, `respx`) moved from `requirements.txt` to `requirements-dev.txt`; Render deployments no longer install test packages.
- Dev postgres aligned to `postgres:16-alpine` (matches prod compose).
- `datetime.utcnow()` deprecated calls replaced with `datetime.now(timezone.utc)` in `model_registry.py`.

## Known Limitations

- Live provider tests are opt-in with `PROVIDER_LIVE_TESTS=false` by default.
- Provider quotas are observed and exposed but require provider-specific headers for exact remaining/reset values.
- Legacy code remains for compatibility, but production entrypoints are canonicalized to `backend`, `apps/web`, and `apps/scraper`.
- Full production readiness remains blocked until `make verify`, Docker image
  builds, Alembic upgrade/check, frontend tests/build, and Playwright smoke tests
  are run successfully in an environment with those dependencies.
- Feature transformation still needs a dedicated zero-fabrication pass for legacy
  `FEATURE_DEFAULTS[...]` fallback usage in `backend/src/data/transformers.py`.
