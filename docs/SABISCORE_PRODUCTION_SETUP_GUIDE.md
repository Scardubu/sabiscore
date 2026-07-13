# SabiScore Production Setup Guide

Last updated: 2026-07-13

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

The provider registry and its shared `httpx.AsyncClient` are created once in the FastAPI lifespan (`app.state.provider_registry`, `app.state.http_client`) and injected into every request via `Depends(get_provider_registry)` â€” never instantiated per request. CLI tools and tests may still call `build_provider_registry()` directly without a client; providers fall back to an ad-hoc per-call client in that case.

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

`apps/web` must not call provider hosts directly and must not import TensorFlow.js for production inference/training. Next.js server routes proxy the backend using `SABISCORE_BACKEND_URL`. The browser-side TensorFlow.js modules (`lib/ml/`) and their unreachable demo components have been removed from the tree entirely â€” `/dev/train-tfjs` is a static disabled-state page with no client-side model code behind it.

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

Latest local Phase 1-2 evidence on 2026-07-05:
- `python -m src.cli providers doctor` and `providers status` passed in offline
  mode with the five-state public contract and no credential values printed.
- `..\.venv\Scripts\python.exe -m pytest tests/test_zero_fabrication_contract.py tests/unit/test_feature_transformer.py -q --no-cov`
  passed (`7 passed`). `FeatureTransformer` now fails closed by default in
  production inference and raises `DataUnavailableError` for missing required
  feature evidence; legacy defaults require explicit `allow_legacy_defaults=True`
  in training/backcompat callers.
- `..\.venv\Scripts\python.exe -m pytest tests/test_betting_intelligence_engine.py tests/test_core_engine.py -q --no-cov`
  passed (`82 passed`).
- `pnpm --filter @sabiscore/web typecheck` passed.
- `pnpm --filter @sabiscore/web lint` passed.
- `pnpm --filter @sabiscore/web test` passed outside the sandbox (`11 passed`)
  after the sandboxed run failed with esbuild `spawn EPERM`.
- `pnpm --filter @sabiscore/web build` passed outside the sandbox after the
  sandboxed run failed with Next worker `spawn EPERM`.
- `PYTHONPATH=. python scripts/verify_openapi.py` passed with 78 paths.
- `docker compose -f docker-compose.prod.yml config --quiet` passed. Docker
  image builds were retried outside the sandbox; Buildx lock access was resolved,
  but backend/web image builds are still blocked by Docker daemon DNS failures
  while fetching Debian/Alpine packages.
- `pnpm exec playwright test` ran outside the sandbox with `16 passed, 6 failed`;
  failures were backend-dependent tests because the local backend health endpoint
  returned `degraded` under host memory pressure. The release-relevant targeted
  `/intelligence` smoke passed: `pnpm exec playwright test tests/e2e/intelligence.spec.ts`
  (`4 passed`, chromium + mobile-chrome).
- `alembic upgrade head` and `alembic check` are still blocked until a valid
  PostgreSQL `DATABASE_URL` is available in the release environment.
- Branch cleanup is blocked: PR #4 from `codex/final-production-certification`
  to `master` is open, unmerged, and not mergeable. Bundle backups for all
  non-master remote branches were created under
  `artifacts/branch-backups/20260705-000338/`.

Do not merge a certification branch directly if it is stale against `master` or
contains unrelated broad churn. Port verified fixes onto current `master`, then
run the full release matrix before tagging the release.

## Rollback

1. Disable optional provider flags first.
2. Keep the backend up so the web app can render fail-closed outage states.
3. Roll back database schema only with reviewed Alembic downgrade or forward-fix migration.
4. Re-run `python -m src.cli providers doctor` and `make verify` before restoring traffic.

## vΩ.8 Changes (2026-07-13)

- **⚠️ DEPLOY BLOCKER — Render service suspended.** `https://sabiscore-api.onrender.com` returns an HTML "This service has been suspended" page (503) on every endpoint. All Vercel proxy 503s are downstream of this. Resume the service in the Render dashboard, then verify `GET /health/ready` → 200. Independently, `SABISCORE_BACKEND_URL=https://sabiscore-api.onrender.com` must be set in the Vercel project dashboard (proxies default to `http://localhost:8000` without it).
- **CSP `frame-src` added** — `middleware.ts` CSP now includes `frame-src 'self' https://vercel.live` so the Vercel preview toolbar iframe loads. `frame-ancestors 'none'` unchanged.
- **Transition screen zero-fabrication cleanup** — the match loading screens no longer invent data: fabricated per-team form/GF/GA/table-position cards replaced with labeled evidence-sync skeletons; fake poll community percentages removed (user's own pick only); fabricated "AI Confidence 77%" line removed; promotional profit/ROI facts removed; footer claim corrected. `LOADING_FACTS`/`FUN_FACTS` deduped into `apps/web/src/components/loading/loading-facts.ts`.
- **Loading screen a11y** — `useReducedMotion` disables infinite pulse/shimmer/particle animations; progress bars expose `role="progressbar"` with live `aria-valuenow`.
- **Cold-start self-heal (React Query retry policy)** — `apps/web/src/lib/query-retry.ts` centralises retry behaviour for the free-tier backend: never retry permanent 4xx (except 408), but give cold-start / 5xx / network up to 3 spaced retries (2s/4s/8s capped 12s) so the dashboard recovers automatically once the Render backend finishes spinning up. Wired into the shared `QueryClient` default; per-component `retry:` overrides removed. This means a cold-start no longer leaves a permanent empty state — the UI self-heals within ~15-45s without a manual refresh.

## vΩ.9 Changes (2026-07-14)

- **Single app shell — duplicate `/match` chrome removed.** `app/match/layout.tsx` was deleted: it rendered a second `<Header/>` (the `PremiumHeader` hero) and a nested `<main>` inside the root `app/layout.tsx` shell, producing two competing `sticky top-0` headers that overlapped the match analysis. All routes now use the single root shell (fixed LEAGUES sidebar + "Live workspace" header). `components/header.tsx` was deleted as dead code (its only importer was the removed match layout).
- **Sidebar is the sole, complete nav.** The root sidebar gained a "Workspace" group (Intelligence, Matches, Performance, Monitoring, Docs) so `/performance` and `/monitoring` — previously reachable only through the broken header — are navigable again.
- **Match landing copy corrected** — "⅛ Kelly" → "Quarter Kelly" (matches the certified Quarter-Kelly 0.25 contract) and the fabricated "Updated every 15s" cadence → "Fetched fresh per request" (the match detail page is `force-dynamic`; there is no 15s polling loop).
- ⚠️ **Ops note:** after deleting a route `layout.tsx`, clear `apps/web/.next` before `tsc --noEmit` — Next's generated `.next/types/validator.ts` keeps a stale import to the removed layout and fails typecheck otherwise.

## vΩ.5 Changes (2026-07-06)

- **`datetime.utcnow()` purged — entire backend/src** (except `database.py` SQLAlchemy column callable defaults, which require a dedicated SQLAlchemy migration). All 30 remaining non-canonical files (`cli/`, `connectors/`, `data/loaders/`, `models/`, `scrapers/`, `services/`) updated to `datetime.now(timezone.utc)`. `grep -rn "datetime\.utcnow" backend/src --include="*.py" | grep -v database.py` → 0 matches. CI zero-fab scan now enforces this on canonical paths (`src/api`, `src/services`, `src/providers/espn`, `src/models/orchestrator.py`, `src/core/security.py`).
- **Ultra service Kelly cap reads `LeaguePolicy.kelly_cap`** — `services/ultra_prediction_service.py` `_detect_value_bets()` now calls `get_league_policy(league_key)` with fallback to `0.04` on `LeaguePolicyUnavailableError`. League model files (`premier_league.py`, `la_liga.py`, `ligue_1.py`, `serie_a.py`) use `_KELLY_CAP` module constant from `get_league_policy()`. `grep -rn "min(kelly_fraction, 0.04)" backend/src` → 0 matches.
- **`render.yaml` metadata corrected** — `MODEL_VERSION: v5_phase7` (was `3.0`), `FEATURES_COUNT: 86` (was `220`).
- **Pydantic v2 migration complete** — `ultra_predictions.py` `UltraMatchFeatures` migrated from `class Config:` to `model_config = ConfigDict(...)`. `grep -rn "class Config:" backend/src` → 0 matches. All production schemas on Pydantic v2 API.
- **Duplicate globals removed from `main.py`** — second `model_instance`/`model_load_in_progress` declaration block removed.

## vΩ.4 Changes (2026-07-05)

- **Quarter-Kelly full sweep** — all `kelly_fraction=0.125` (⅛-Kelly) defaults changed to `0.25` across `schemas/prediction.py`, `schemas/value_bet.py`, `models/edge_detector.py`, `services/ultra_prediction.py`, `services/ultra_prediction_service.py`. League model inline Kelly post-multipliers (`* 0.125`) replaced with policy-cap pattern in `premier_league.py`, `la_liga.py`, `ligue_1.py`, `serie_a.py`. `grep -rn "kelly_fraction.*0\.125" backend/src` → 0 matches.
- **Orchestrator stale accuracy strings removed** — `models/orchestrator.py` `_get_accuracy_target()` hardcoded 76.2%/74.8% etc. removed; method returns `""` with walk-forward note.
- **Integration test gate fixed** — `tests/test_prediction_pipeline.py` gated purely on `RUN_INTEGRATION_TESTS=1`. `tests/integration/test_end_to_end.py::test_feature_transformation` asserts fail-closed `DataUnavailableError` contract. Both files green: 18 passed, 9 skipped, 0 failed.
- **`CalibratedEnsemble cv="prefit"`** — `models/enhanced_training.py` prevents re-fitting a trained `StackingClassifier` via k-fold (data leakage). Regression guard in `test_zero_fabrication_contract.py`.
- **Pydantic v2 partial migration** — All 7 production schema classes in `backend/src/schemas/` migrated.
- **Ruff zero-issue** — All bare `except:` fixed, E402 annotated, E701/E741 resolved.
- **ws service Dockerfile** — `production` target added, port aligned to `WS_PORT=8001`, `# syntax` directive dropped. Duplicate `Dockerfile.ws` deleted. CORS `allow_credentials=False`.

## vΩ.3 Changes (2026-07-05)

- **SECURITY — Upstash Redis credential purged.** A live Upstash token (`known-amoeba-10186.upstash.io`) had been committed as an env default across 10 tracked files (`apps/ws/main.py`, `apps/api/ingestion/redis_client.py`, `start_backend.bat`, and 6 docs). All occurrences removed: code/scripts now default to inert `redis://localhost:6379/0`, docs to a `<UPSTASH_REDIS_TOKEN>` placeholder. **Action required: rotate this token in the Upstash console** — it stays in Git history until a reviewed history rewrite is scheduled.
- `apps/ws/Dockerfile` gained the `production` build target that `docker-compose.prod.yml` references (previously only `base` existed, so `docker compose build ws` would fail), aligned the exposed/served port to compose `WS_PORT=8001`, and dropped the `# syntax` directive (offline-build footgun). The stale duplicate `apps/ws/Dockerfile.ws` was deleted.
- `apps/ws/main.py` CORS corrected: `allow_credentials=False` with the open-origin default (browsers reject wildcard-origin + credentials); origins overridable via `WS_ALLOWED_ORIGINS`.
- Provider circuit breakers confirmed already wired for all five providers — the four non-ESPN adapters inherit breaker protection through `BaseProvider._get_json`; no per-adapter change was needed.
- `Makefile` zero-fabrication scan output: fixed double-encoded `✗` glyphs (mojibake) in three echo lines.
- Earlier vΩ.3 pass (commit `1006485`): CI Kelly-fraction scan is now fatal (no `|| true`); `UltraPredictionService` has a zero-fabrication guard; homepage "Live" dot is backed by a real `/api/health` fetch; `performance.py` returns `503 METRICS_UNAVAILABLE` instead of false-zero stats; both engines share the `epistemic ≤ 0.05` HIGH_CONVICTION threshold; `verified_provider_count=None` now maps to 0 → PARTIAL; Eredivisie aligned to SOFT; `docker-compose.prod.yml` secrets are fail-fast required vars.

## vÎ©.2 Changes (2026-07-04)

- CI workflows (`ci.yml`, `secret-scan.yml`) now trigger on `master` branch â€” previously only fired on `main`/`develop`.
- `nginx.conf` created at repo root; `docker-compose.prod.yml` nginx mount now valid. `./ssl/` certs still required for TLS.
- All three Docker healthcheck paths aligned to `/api/v1/health/live`.
- `PREMIUM_VISUAL_HIERARCHY` flag enabled by default; premium homepage now shown to all users.
- Test deps (`pytest`, `pytest-asyncio`, `respx`) moved from `requirements.txt` to `requirements-dev.txt`; Render deployments no longer install test packages.
- Dev postgres aligned to `postgres:16-alpine` (matches prod compose).
- `datetime.utcnow()` deprecated calls replaced with `datetime.now(timezone.utc)` in `model_registry.py`.
- `render.yaml` now deploys from `master` (was `main` â€” autoDeploy never fired) and no longer sets the dead `KELLY_FRACTION=0.125` env var (read by nothing; engines hardcode Quarter-Kelly 0.25).
- `backend/src/utils/currency.py` deleted â€” dead module (zero importers) carrying a stale â…›-Kelly constant that contradicted the certified Quarter-Kelly contract.
- Sportmonks `probe()` now calls `/leagues` (cheapest call valid on every plan). Live-verified: bare `/sidelined` 404s in the subscribed API shape, so the old probe could never verify a valid token. All five providers report `configured` via `providers status`.
- `docs/Public-ESPN-API-main/` (vendored read-only reference repo) is now gitignored.

## Known Limitations

- Live provider tests are opt-in with `PROVIDER_LIVE_TESTS=false` by default.
- Provider quotas are observed and exposed but require provider-specific headers for exact remaining/reset values.
- Legacy code remains for compatibility, but production entrypoints are canonicalized to `backend`, `apps/web`, and `apps/scraper`.
- Full production readiness remains blocked until `make verify`, Docker image
  builds, Alembic upgrade/check, frontend tests/build, and Playwright smoke tests
  are run successfully in an environment with those dependencies.
- Do not delete non-master branches until open PRs are merged or closed, branch
  backups are retained, and the full release gate is green.
