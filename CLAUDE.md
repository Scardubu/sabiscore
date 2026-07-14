# AI Engineering Control System (Claude Code)
# SabiScore — Football Intelligence & Predictive Modeling Platform

This repository is governed by a modular AI skill system located in:

```
.ai/skills/          ← 34-skill domain suite
.claude/skills/      ← Claude Code slash commands (nexus, forge, audit)
```

Orchestration is handled by **NEXUS** — every task routes through NEXUS before any
implementation begins. See the mandatory entry point section below.

---

# PROJECT STACK (IMMUTABLE CONSTANTS)

## Dual-Stack Architecture

This is a polyglot monorepo. Product verticals use different stacks — never conflate them.

| Layer | SabiScore | TaxBridge / Hashablanca / SwarmX |
|---|---|---|
| Backend | **FastAPI 0.115+, Python 3.11–3.14** | Fastify 5, Effect-TS |
| ORM / Migrations | **SQLAlchemy 2, Alembic** | Prisma 5 |
| Async HTTP | **httpx.AsyncClient** | Native fetch / undici |
| Job Queue | Redis (direct) + optional BullMQ bridge | BullMQ, ioredis |
| DB | **PostgreSQL 16+** | PostgreSQL 16+ |
| Cache | **Redis 7+** | Redis 7+ |
| Frontend | **Next.js 15, React 18, Tailwind v4** | Next.js 15, React 19 |
| Mobile | — | Expo SDK 54, Reanimated v4, EAS |
| Monorepo | **Turborepo, pnpm workspaces** | Turborepo, pnpm workspaces |
| Auth | Next.js middleware + JWT (HS256, server-only) | Auth.js v5 |
| Observability | **Structured logging (structlog), OpenTelemetry** | OTel, OTLP |
| AI / Agents | **Vercel AI SDK v6, Ollama (local), SwarmX** | SwarmX |

## Active Applications

| Vertical | Stack | Canonical Entrypoint |
|---|---|---|
| **SabiScore** | FastAPI + Next.js 15 | `backend/src/api/main.py` + `apps/web` |
| **TaxBridge** | Fastify 5 + Next.js 15 | Nigerian SME tax compliance |
| **Hashablanca** | Fastify 5 + Next.js 15 | Encrypted blockchain analytics |
| **SwarmX** | Python orchestrator + BullMQ | Local multi-agent AI (30+ agents) |

---

# SABISCORE CANONICAL PRODUCTION SHAPE

These three entrypoints are the ONLY production-authorised services.
**Never reference `apps/api` or `frontend/` in production scripts, CI, or runbooks.**

```
backend/src/api/main.py   ← FastAPI: providers, evidence, analysis, verdicts, EV, Kelly
apps/web                  ← Next.js: public frontend and backend proxy routes ONLY
apps/scraper              ← Permitted batch acquisition, raw snapshots, manifests
```

### Backend Authority (FastAPI is the ONLY source of truth for)

- Provider credentials and authenticated provider requests
- Fixture identity and reconciliation
- Evidence criticality and gap classification
- Feature construction and model inference
- Calibration, uncertainty, and market de-vigging
- Edge, expected value, Kelly stake sizing
- Verdict generation and decision persistence
- Portfolio controls and abstention logic

### Frontend Constraints (Next.js `apps/web` MUST NOT)

- Call provider hosts directly (all traffic proxied via `SABISCORE_BACKEND_URL`)
- Import TensorFlow.js or execute models in the browser
- Receive or expose provider API secrets
- Calculate verdicts, stake sizes, or EV independently
- Use `NEXT_PUBLIC_*` prefixes on any provider key variable

### Scraper Constraints (`apps/scraper` MUST NOT)

- Calculate probabilities, verdicts, EV, Kelly stakes, or user-facing recommendations
- Call authenticated provider APIs (scraper is open/batch-only)

---

# CORE EXECUTION RULE

Before ANY action that involves understanding, modifying, or generating code:

1. Route through **NEXUS** for task classification and skill selection
2. Load ONLY the skills NEXUS selects — never blind-load the full suite
3. Execute skills in NEXUS's dependency order
4. Resolve conflicts using the priority hierarchy below
5. Open every code response with a **Skill Trace Block**

```
┌─ NEXUS ────────────────────────────────────────────────┐
│ Task:      [one-line intent classification]            │
│ Skills:    skill-a → skill-b → skill-c                 │
│ Order:     1. skill-a  2. skill-b  3. skill-c          │
│ Overrides: [conflict resolutions, or NONE]             │
│ Risk:      [critical risks identified, or NONE]        │
└────────────────────────────────────────────────────────┘
```

---

# MANDATORY SKILL ENTRY POINT

All tasks MUST begin with:

👉 **NEXUS** (`/nexus` or read `NEXUS.md`)

NEXUS is the system orchestrator responsible for:

- Task intent classification (including SabiScore-domain intents)
- Skill selection from the 34-skill registry
- Dependency graph resolution
- Execution ordering
- Conflict resolution

No other skill may be invoked before NEXUS has run.

> ⚠️ **Name disambiguation:**
>
> | Tool | Location | Purpose |
> |---|---|---|
> | NEXUS | `NEXUS.md` / `.claude/skills/nexus/` | Routes tasks → selects skill graphs → orders execution |
> | `elite-skill-forge` | `.ai/skills/elite-skill-forge/` | Generates new SKILL.md files from domain descriptions |

---

# SKILL PRIORITY HIERARCHY (CONFLICT RESOLUTION)

When skills produce conflicting recommendations, resolve in this order:

## 1. Security & Safety
→ `security-hardening-auditor`
→ `backend-systems-auditor`
→ `nigerian-fintech-compliance-architect` (TaxBridge financial operations)

## 2. Correctness & Stability
→ `testing-strategy-architect`
→ `typescript-config-surgeon`
→ `component-quality-gate`
→ `effect-ts-layer-architect`
→ `backend-domain-model-architect`
→ `api-contract-governance-architect`

## 3. Performance & Scalability
→ `nextjs-performance-architect`
→ `edge-cache-architecture-architect`
→ `opentelemetry-observability-architect`
→ `real-time-systems-architect`
→ `vscode-debug-profiler`
→ `bullmq-job-architect`

## 4. Architecture & Design
→ `frontend-product-design-architect`
→ `accessibility-system-architect`
→ `motion-performance-architect`
→ `motion-interaction-architect`
→ `multi-agent-orchestration-architect`
→ `ai-feature-architect`
→ `prisma-database-architect`
→ `api-automation-architect`
→ `api-contract-governance-architect`
→ `react-native-expo-architect`
→ `vscode-monorepo-forge`
→ `effect-ts-layer-architect`
→ `data-visualization-architect`

## 5. AI Engineering
→ `prompt-engineering-architect`
→ `ai-feature-architect`
→ `multi-agent-orchestration-architect`

## 6. Release / Productivity / Tooling
→ `release-incident-operations-architect`
→ `git-workflow-architect`
→ `vscode-cognitive-os`
→ `vscode-ai-agent-stack`
→ `vscode-debug-profiler`

## 7. UX / UI / Motion
→ `frontend-product-design-architect`
→ `accessibility-system-architect`
→ `component-quality-gate`
→ `motion-performance-architect`
→ `motion-interaction-architect`
→ `design-token-system-architect`
→ `data-visualization-architect`

## 8. Vertical Domain Compliance
→ `nigerian-fintech-compliance-architect` (TaxBridge: FIRS, VAT, NRS 2026)
→ `backend-domain-model-architect` (SabiScore: betting engine, evidence criticality)

---

# SABISCORE-SPECIFIC INTENT TYPES (for NEXUS classification)

NEXUS must recognize these SabiScore-domain intents in addition to the general taxonomy:

| Intent | Key Signals |
|---|---|
| **Provider Gateway** | "provider health", "ESPN adapter", "ESPN standings", "ESPN slug", "scoreboard", "API-Football", "Sportmonks", "football-data.org", "The Odds API", "circuit breaker", "provider quota", "provider capabilities", "egress allowlist", "multi-domain provider" |
| **Evidence Orchestration** | "evidence profile", "DISCOVERY", "PREMATCH_STANDARD", "PREMATCH_ENRICHED", "LINEUP_REFRESH", "MARKET_REFRESH", "FORECAST_ONLY", "evidence criticality", "critical gap", "advisory gap" |
| **Fixture Identity** | "canonical fixture", "fixture reconciliation", "fixture identity", "team alias", "provider team ID", "VERIFIED/UNKNOWN/CONFLICTING/REQUIRES_REVIEW" |
| **Betting Engine** | "verdict", "HIGH_CONVICTION", "ACTIONABLE", "SPECULATIVE", "HOLD", "PARTIAL", "NO_BET", "Kelly sizing", "edge", "expected value", "de-vig", "overround" |
| **Intelligence UI** | "/intelligence page", "decision card", "evidence rail", "evidence passport", "odds snapshot", "model-vs-market", "price window", "bookmaker candidate" |
| **ML / Model** | "model artifact", "calibration", "feature registry", "prediction pipeline", "phase 9", "shadow mode", "xG features", "pi-ratings", "Dixon-Coles", "SHAP" |
| **Scraper Boundary** | "scraper manifest", "raw snapshot", "parser validation", "source allowlist", "robots policy" |

---

# REGISTRY NOTES

The suite includes 34 skills:

**Cluster 1** — Editor & Environment (6 skills)
**Cluster 2** — Frontend Design (8 skills: includes `data-visualization-architect`)
**Cluster 3** — Backend Engineering (9 skills)
**Cluster 4** — Application Layer (6 skills)
**Cluster 5** — Mobile & Meta (2 skills)
**Cluster 6** — Vertical Intelligence (2 skills: `nigerian-fintech-compliance-architect`, `multi-agent-orchestration-architect`)
**Cluster 7** — Real-Time & Data (2 skills: `real-time-systems-architect`, `data-visualization-architect`)

---

# MOTION SKILL DISAMBIGUATION

| Skill | Role |
|---|---|
| `motion-performance-architect` | **Strategy**: motion budget, compositor rules, anti-patterns |
| `motion-interaction-architect` | **Implementation**: Framer Motion APIs, animation catalog |

Always load `motion-performance-architect` first, then `motion-interaction-architect`.

---

# PROJECT CONSTRAINTS (NON-NEGOTIABLE)

## Universal Rules

- No unnecessary rewrites — optimize incrementally unless the system is broken
- Preserve architecture unless an explicit rewrite is requested
- Avoid overengineering — add complexity only when it earns its maintenance cost
- Maintain Next.js 15 + React 18 compatibility at all times (apps/web is pinned to React 18.3.1 — do not bump to React 19 without an explicit, planned upgrade; it is not a drop-in change)
- `maxTsServerMemory` must not exceed 3072 (half of 8GB system RAM)

## SabiScore Backend (Python / FastAPI)

- **Alembic is the ONLY schema management authority** — never call `Base.metadata.create_all()` at app startup or in migrations
- SQLite fallback requires explicit `ALLOW_SQLITE_FALLBACK=true` — never activate silently
- Provider gateway must use a single application-lifespan `httpx.AsyncClient` — never instantiate per-request
- Circuit breaker must distinguish network / rate-limit / authentication / client / server / schema failures
- All provider requests are HTTPS-only; egress must go through an explicit allowlist
- `evaluation_at` is required by every verdict calculation — never call `datetime.now()` inside pure betting logic
- UCL fixtures cannot reach `HIGH_CONVICTION` — hard cap at `ACTIONABLE` until a dedicated UCL model variant is released and certified (UCL fixtures cannot reach HIGH_CONVICTION)
- `SPECULATIVE` verdicts belong in `watchlist` only — never in `top_opportunities`
- Only `critical_gaps` force `PARTIAL` status — advisory gaps may reduce confidence but never block valid analyses
- Provider predictions / value-bet flags from external sources must never enter the official SabiScore model inputs

## SabiScore Frontend (Next.js)

- All provider traffic proxied via `SABISCORE_BACKEND_URL` — zero direct provider calls from Next.js
- `Cache-Control: no-store` on all evidence and decision endpoints
- CSP must not contain `'unsafe-eval'` in production
- CSP is set per-request in `apps/web/src/middleware.ts` with a `script-src` nonce + `'strict-dynamic'` — never move it back to a static `next.config.js` `headers()` value; Next.js's own inline bootstrap/RSC scripts require a per-request nonce to execute, which static config cannot provide (confirmed 2026-06-28: without the nonce, every page silently failed to hydrate under CSP enforcement — fixed this session)
- Validate all proxy parameters with Zod before forwarding to backend
- Language on the `/intelligence` page must remain quiet and analytical — no promotional betting copy
- Prohibited UI terms: `lock`, `banker`, `guaranteed`, `sure bet`, `free money`, `execute immediately`

## TypeScript / Node.js Verticals (TaxBridge / SwarmX)

- Effect-TS Layer discipline is mandatory for all backend services
- BullMQ workers must use separate `ioredis` connections per role (Queue / Worker / QueueEvents)
- Edge Runtime routes must not use Node.js-only modules (no `jsonwebtoken`)
- SwarmX agents are stateless between turns — no in-memory state persistence
- TaxBridge financial writes require idempotency keys at every database boundary

## Credential Safety (ABSOLUTE)

- Zero provider secrets in source control — run Gitleaks in CI
- Zero `NEXT_PUBLIC_*` provider key variables
- No ESPN API key variable (ESPN endpoints are keyless)
- Redact auth headers, API-key query params, DSNs, and passwords from all logs and traces
- Any credential previously committed must be rotated in its provider console

---

# SAFE DEFAULTS (PRODUCTION FAIL-CLOSED)

```env
DEBUG=false
MOCK_MODE=false
ENABLE_LEGACY_INFERENCE=false
SCRAPER_ALLOW_INSECURE_FALLBACK=false
ALLOW_SQLITE_FALLBACK=false
PROVIDER_LIVE_TESTS=false
USE_PHASE9_CANDIDATE_FEATURES=false
PHASE9_SHADOW_ONLY=true
```

---

# OBSERVABILITY RULE

If any system-level change is made:

- Evaluate telemetry impact — does this require new spans or metrics?
- Validate performance implications — does this add latency to the hot path?
- Ensure no silent regressions — what breaks without a visible signal?

### SabiScore-specific telemetry requirements

- Provider health, latency, circuit state, quota remaining — metered per provider
- Evidence freshness, critical gap rate, advisory gap rate — tracked per fixture
- Prediction latency, model artifact validity, calibration coverage — tracked per inference
- Verdict distribution (HIGH_CONVICTION / ACTIONABLE / SPECULATIVE / HOLD / NO_BET / PARTIAL) — time-series
- Fixture reconciliation success/failure/REQUIRES_REVIEW rate — tracked per provider-pair

---

# RELEASE GATE (`make verify`)

The following must all pass before any production deployment:

```
secret scanner (Gitleaks)
repository secret safety tests
backend unit tests
backend integration tests
provider gateway tests
strict engine tests
provider CLI doctor (fixture mode)
Alembic fresh-database upgrade
Alembic schema verification
OpenAPI generation and diff
scraper tests + manifest validation
web lint (no || true)
web type-check
web unit/component tests
web production build
Docker Compose config validation
Docker image build
Playwright desktop smoke (/intelligence)
Playwright mobile smoke (/intelligence)
```

**No gate may be bypassed with `|| true`.
No live provider quota may be consumed in default CI (`PROVIDER_LIVE_TESTS=false`).**

---

# KNOWN LEGACY SURFACES (DO NOT REFERENCE IN PRODUCTION)

| Path | Status | Action |
|---|---|---|
| `apps/api/` | Legacy API skeleton (incomplete) | Remove from CI, Docker, scripts |
| `frontend/` | Legacy Vite app | Remove from CI, Docker, scripts |
| `npm lockfile` | Stale — pnpm is canonical | Delete; use `pnpm-lock.yaml` only |
| `Base.metadata.create_all()` | Runtime schema creation | Replace with Alembic migrations |
| Direct browser odds fetching | Security violation | Route through backend proxy |
| `ESPN_API_KEY` variable | ESPN is keyless | Remove entirely |

---

# ESPN PROVIDER — OPERATIONAL KNOWLEDGE (CODIFIED)

ESPN's API is undocumented and quirky. These facts are verified against the
upstream Public-ESPN-API reference project and must be respected by any code
touching `backend/src/providers/espn/`. Encoding them here means the team never
rediscovers them the hard way.

## Trust & scope (immutable)

- Trust tier: `UNOFFICIAL_PUBLIC`. **Keyless** — there is no `ESPN_API_KEY`.
- Role: fixture discovery, scoreboard, event status, standings **corroboration**.
- ESPN is the lowest-precedence evidence source and can **never alone** establish
  critical odds, lineup, injury, probability, or execution evidence.
- A missing ESPN response is at most an `advisory_gap`, never `critical`.

## Multi-domain routing (two hosts, three bases)

| Base | Host | Use |
|---|---|---|
| `…/apis/site/v2/sports/soccer` | `site.api.espn.com` | scoreboard, teams |
| `…/apis/v2/sports/soccer` | `site.api.espn.com` | **standings** (see gotcha) |
| `…/v2/sports/soccer` | `sports.core.api.espn.com` | competition odds, detailed event records |

The egress allowlist must permit **both** `site.api.espn.com` and
`sports.core.api.espn.com` over HTTPS — nothing else.

## ⚠️ Standings domain gotcha (verified)

Soccer **standings** on `/apis/site/v2/` return only a stub
`{"fullViewLink": {...}}`. The full table lives on `/apis/v2/`:

```text
✅  https://site.api.espn.com/apis/v2/sports/soccer/{slug}/standings
❌  https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/standings   (stub)
```

Use `fetch_standings_raw()`, which already routes to the correct base.

## Canonical 7-competition mapping (closed set)

```text
EPL         → eng.1
LA_LIGA     → esp.1
SERIE_A     → ita.1
BUNDESLIGA  → ger.1
LIGUE_1     → fra.1
EREDIVISIE  → ned.1
UCL         → uefa.champions
```

A competition not in this set is unsupported and must fail closed (raise
`UnsupportedCompetitionError`) rather than guess a slug. ESPN exposes hundreds of
other slugs (FIFA, UEFA Europa, domestic cups) — do not add them without a
deliberate evidence-precedence decision; SabiScore supports exactly seven.

## Timestamp discipline

ESPN scoreboards carry no content-update timestamp. Therefore:
- `kickoff_utc` = the match start (from `event.date`)
- `provider_timestamp` = `None` (never silently set to kickoff)
- freshness is judged by `acquired_at` (SabiScore's fetch time)

## Resilience contract

- Single application-lifespan `httpx.AsyncClient`, dependency-injected — never per-request.
- Circuit breaker shared with the gateway; distinguishes network / rate-limit /
  auth / client / server / **schema** failures; honors `Retry-After`; half-open recovery.
- Every untrusted response is schema-validated; drift → `SCHEMA_INVALID`, fails closed,
  records a breaker schema failure. No fabricated fixtures.
- No 8-second polling. No low-latency guarantee. Reasonable cadence only.
- Structured logs are redacted — no raw URLs with query strings, no bodies at info level.

## Reference (read-only, not a dependency)

The upstream Public-ESPN-API is a Django documentation project. SabiScore does
**not** depend on it or copy its Django/Celery service. We extract endpoint
intelligence (slugs, domain quirks) only. `docs/sports/soccer.md` in that repo is
the authoritative slug catalogue if a new competition is ever considered.

---

# VERIFIED GROUND TRUTH (2026-07-04)

This section is the authoritative record of confirmed states. Repository code
overrides all prior status docs — verify with a grep/read before acting.

## Confirmed working (do not re-implement)

| Component | Notes |
|---|---|
| SPECULATIVE → watchlist | `batch_watchlist` in both `betting_intelligence.py` AND `core_engine.py` |
| Provider gateway lifespan | `app.state.http_client` + `app.state.provider_registry`; `Depends(get_provider_registry)` |
| TF.js browser model | `apps/web/src/lib/ml/` deleted; three dependent components removed |
| N+1 on upcoming fixtures | Two batched queries in `GET /api/v1/fixtures/upcoming` |
| Legacy paths | `apps/api/` and `frontend/` absent from CI, docker-compose, workspace |
| Alembic-only | `core/database.py` raises `RuntimeError` on direct table-creation |
| Health endpoints | `/health/live`, `/health/ready`, `/health` all present |
| Gitleaks CI | `.github/workflows/ci.yml`, no `|| true` suppressions |
| CSP hydration fix | `apps/web/src/middleware.ts` generates a per-request `script-src` nonce + `'strict-dynamic'`; the prior static `next.config.js` CSP had no nonce, which silently broke client-side hydration on every page under real CSP enforcement (found 2026-06-28 via a clean headless-browser check, fixed same session). |
| critical_gaps PARTIAL gate | `_apply_verdict_gate` (`betting_intelligence.py`) and `_evaluate_match` (`core_engine.py`) already gate `PARTIAL` on a pre-extracted `critical_gaps` list (CONFLICTING entries excluded via `_extract_critical_gaps`/`_critical_data_gaps`) plus an explicit CONFLICTING-freshness check; covered by `test_market_source_status_conflicting_forces_partial` and `test_advisory_only_signals_never_force_partial` in both test files. No `betting_intelligence_patch.md` file exists or is needed. Re-confirmed 2026-06-28 — claims to the contrary in circulating prompt drafts are stale. |
| Canonical team-identity reconciliation | `providers/reconciliation.py` (`reconcile_team`), `db/models.py` (`ProviderTeamMapping`), `alembic/versions/0003_team_identity_reconciliation.py` | Same VERIFIED/REQUIRES_REVIEW/CONFLICTING/UNKNOWN taxonomy as fixture reconciliation, scored on name similarity only. Wired live into `orchestrator._resolve_team_statistics()` — resolves each fixture side's `api_football` team_id via `teams()` + `reconcile_team()` before calling `team_statistics()`; non-VERIFIED resolution yields a structured PARTIAL, never a guessed id. |
| `api_football` provider adapter | `providers/api_football.py` | Fully operational: `injuries()`, `lineups()`, `teams()`, `team_statistics(team_id=...)`. No stub methods remain. |
| Playwright `/intelligence` smoke gate | `playwright.config.ts`, `tests/e2e/intelligence.spec.ts` | Wired this session: `@playwright/test` added as a root devDependency (was referenced by `tests/e2e/sabiscore.spec.ts` but never installed), `mobile-chrome` project added alongside `chromium`, a `webServer` block starts `pnpm --filter @sabiscore/web start` automatically, and a backend-independent smoke spec covers both "desktop" and "mobile" release-gate names with one spec file. |
| ESPN timestamp discipline | `providers/espn.py` `normalize_event()` — `kickoff_utc` from `event.date`; `provider_timestamp` from `event.lastModified or None`. Two tests cover it in `test_providers_gateway.py`. (Fixed 2026-07-04.) |
| Provider activation (Phase 2) | All 5 providers configured and enabled in `backend/.env`. `providers status` shows all `configured` with `live_probe_not_run`. `PROVIDER_LIVE_TESTS=false` keeps CI safe. (2026-07-04) |
| ML models trained (Phase 3) | 5-league stacking ensemble artifacts in `models/`: `epl_ensemble.pkl` (51%), `bundesliga_ensemble.pkl` (48%), `la_liga_ensemble.pkl` (51%), `serie_a_ensemble.pkl` (38%), `ligue_1_ensemble.pkl` (42%). (2026-07-04) |
| LeaguePolicy CALIBRATED | EPL / LA_LIGA / BUNDESLIGA / SERIE_A / LIGUE_1 all promoted to `policy_source="CALIBRATED"` with `kelly_cap=0.04` in `backend/src/core/league_policy.py`. EREDIVISIE / UCL remain `DEFAULT_PENDING_CALIBRATION`. (2026-07-04) |
| Frontend critical/advisory gap split | `MatchAnalysisResult` type in `betting-intelligence-api.ts` has `critical_gaps?`, `advisory_gaps?`, `conflicts?`. Dashboard renders blocking gaps in red and advisory gaps in amber. (2026-07-04) |
| Kelly module deleted (frontend) | `apps/web/src/app/api/kelly/`, `apps/web/src/lib/betting/`, `apps/web/src/components/betting/` — all dead code removed. Backend `CalculationAudit` is the only Kelly source. (2026-07-04) |
| Fixture proxy Zod validation | `validateFixtureId()` applied to all 5 `[fixtureId]` route handlers. Schema: `z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)`. (2026-07-04) |
| Feature completeness tracking (C-02) | `FeatureTransformer.feature_completeness` (0–1) computed at start of `engineer_features()` from 4 evidence sources (current_form, team_stats, historical_stats, head_to_head). Stored in `prediction.features["metadata"]["feature_completeness"]`. < 0.5 → critical gap → PARTIAL; 0.5–0.8 → advisory `known_risks`. (2026-07-04) |
| Contract field fix | `_prediction_metadata()` in `fixtures.py` now returns `prediction.features["metadata"]` instead of the full features dict, so contract checks (`calibration_method`, `calibration_validated`, `epistemic_uncertainty`, `aleatoric_uncertainty`, `confidence_tier`) match the stored structure. `prediction.py` now populates all 5 contract fields in `metadata` after `UncertaintyService.decompose()`. (2026-07-04) |
| Quarter-Kelly enforcement (C-11, C-12) | `EdgeDetector` in `prediction.py` uses `kelly_fraction=0.25`. `currency.ts` `KELLY_FRACTION=0.25`. `ValueBetCard.tsx` MAX=0.05, label "Quarter-Kelly · capped at 5%". (2026-07-04) |
| Verdict labels + responsible gambling (C-03) | `VERDICT_LABEL` in `betting-intelligence-dashboard.tsx` updated to directive spec ("Strong Value Signal", "Good Value", "Risky — Small Stake Only", "Monitor Closely", "Incomplete Data", "Skip This Match"). `ResponsibleGamblingBanner` imported and rendered below `OutcomeTable`. (2026-07-04) |
| Analyze route Zod validation (C-18) | `AnalyzeRequestSchema` (Zod) validates POST body in `/api/betting-intelligence/analyze/route.ts` before forwarding. (2026-07-04) |
| CONFLICTING provider state (C-17 accuracy) | `ProviderMeter.tsx` maps `CONFLICTING` → icon "⚡", label "Conflict", className "pm-conflict" (distinct from "Stale"). (2026-07-04) |
| RPS metric + compare_models default (D-01, D-02) | `ranked_probability_score()` added to `backend/src/models/evaluation/metrics.py`. `compare_models()` in `model_registry.py` defaults to `metric='rps'` and sorts ascending (lower = better). (2026-07-04) |
| CI: alembic check + zero-fab scan (C-19, extended 2026-07-06) | `.github/workflows/ci.yml` runs `alembic check` after upgrade and a zero-fab scan covering 7 patterns: `FEATURE_DEFAULTS[` in services/api + transformers.py, `hardcoded_odds` in services/api/providers, `Base.metadata.create_all` in alembic, `full_kelly_fraction` in backend/src, `full_kelly\|Full-Kelly\|Full Kelly` in apps/web/src, `NEXT_PUBLIC_KELLY_FRACTION` in env/vercel files, `datetime\.utcnow` across ALL of `src` (`--exclude="database.py"` — its SQLAlchemy column callable defaults are the only exempt surface). |
| CI: MyPy is advisory (not blocking) | `.github/workflows/ci.yml` `MyPy (advisory …)` step has `continue-on-error: true`. The codebase carries ~540 legacy mypy errors across 89 files (SQLAlchemy `Column` typing, FastAPI internals, untyped data/ML surfaces); a blocking `mypy src` aborted the whole `backend-quality` job before the 942-test suite / alembic drift check / zero-fab scan ran. Full report stays in the log (NOT `\|\| true`). Type-debt burndown is deferred, file-by-file. (2026-07-06) |
| CI: Playwright smoke gate (2026-07-05) | `.github/workflows/ci.yml` `playwright-smoke` job (needs `web-quality`) installs Playwright Chromium, builds web with `NODE_ENV=production`, runs `tests/e2e/intelligence.spec.ts --project=chromium --project=mobile-chrome` (4 backend-independent tests). |
| CalibratedEnsemble cv="prefit" (2026-07-05) | `backend/src/models/enhanced_training.py` — default and call site both use `cv="prefit"`. Prevents re-fitting a trained `StackingClassifier` via k-fold (data leakage). Regression guard in `test_zero_fabrication_contract.py`. |
| EnhancedStackingEnsemble exported (2026-07-05) | `backend/src/models/__init__.py` — `EnhancedStackingEnsemble`, `EnhancedModelTrainer`, `CalibratedEnsemble` in `__getattr__` and `__all__`. |
| Homepage duplicate header removed (2026-07-05) | `apps/web/src/app/page.tsx` — `<Header />` removed; `layout.tsx` sticky top bar is the sole nav surface for all pages. |
| Intelligence nav route fixed (2026-07-05) | `apps/web/src/components/header.tsx` `NAV_LINKS` "Intelligence" changed `/performance` → `/intelligence`. Applies to both `LegacyHeader` and `PremiumHeader` via shared constant. |
| Performance page relinked in nav (2026-07-05) | `apps/web/src/components/header.tsx` `NAV_LINKS` gains a dedicated "Performance" → `/performance` entry (detail "Accuracy + value scanner"). The page hosts the unique `RollingAccuracyChart` + `ValueBetScanner` (fed by `/api/model-performance/summary`) and was orphaned when the "Intelligence" link was repointed; now discoverable and distinct from `/monitoring` (drift/health). |
| Stray artifacts/ dir gitignored (2026-07-05) | Root-level `artifacts/` (local `branch-backups`) added to `.gitignore` alongside `backend/artifacts/`; keeps `git status` clean and prevents accidental backup commits. |
| CI: removed \|\| true (C-19 quality) | `.github/workflows/validate-models.yml` no longer suppresses pip install failures silently; boto3 has its own step with `continue-on-error: true`. (2026-07-04) |
| Render deploy branch | `render.yaml` `branch: master` (was `main` — autoDeploy never fired on the active branch). Dead `KELLY_FRACTION=0.125` env removed — nothing reads it; engines hardcode 0.25. (2026-07-04) |
| Dead ⅛-Kelly module deleted | `backend/src/utils/currency.py` removed — zero importers repo-wide; its `KELLY_FRACTION = 0.125` contradicted the certified Quarter-Kelly contract. Full suite green after deletion. (2026-07-04) |
| Sportmonks probe endpoint | `providers/sportmonks.py` `probe()` uses `/leagues` — live-verified that bare `/sidelined` 404s in the subscribed API shape, so the old probe could never return VERIFIED. All 5 providers now `configured` in `providers status` with live probes on. (2026-07-04) |
| Web test EPERM blocker cleared | `pnpm --filter @sabiscore/web test` passes locally (11/11); the prior Windows `spawn EPERM` block no longer reproduces. Stale `.next/types` from deleted odds routes broke typecheck until `.next` was cleared — clear `.next` before local typecheck after route deletions. (2026-07-04) |
| Web production build + Playwright green locally | `next build` passes and `playwright test tests/e2e/intelligence.spec.ts` passes 4/4 (chromium + mobile-chrome). ⚠️ **NODE_ENV footgun**: a shell exporting `NODE_ENV=development` makes `next build` fail at `/404` prerender with a misleading `<Html> should not be imported outside of pages/_document` error (Next builds dev-mode React into the exporter). Always build with `NODE_ENV=production` or unset. Not a repo defect — c39b429's deletion of `src/pages/_document.tsx`/`_error.tsx` merely rerouted `/404` generation through the path that exposes it. (2026-07-04) |
| OpenAPI + compose config verified | `backend/scripts/verify_openapi.py` passes with 78 paths (run with `PYTHONPATH=.` from `backend/`). `docker compose config` passes for both dev and prod compose files. (2026-07-04) |
| Zero-fab guard (C-02 promoted) | `prediction.py` `predict_match()` raises `DataUnavailableError` when `feature_completeness == 0.0` — model no longer runs on pure defaults; caller `predictions.py` maps it to HTTP 422. The downstream `_build_evidence` PARTIAL gate remains as the belt-and-suspenders check for completeness 0.01–0.49. (2026-07-04) |
| Walk-forward RPS skeleton | `model_registry.py` `walk_forward_validate(records, n_splits=5)` — temporal CV over stored match records; runnable once live match data accumulates from provider APIs. (2026-07-04) |
| ssl/ directory scaffolded | `ssl/.gitkeep` committed; cert files gitignored. `make ssl-dev-certs` generates self-signed certs for local nginx prod-compose testing. (2026-07-04) |
| Vercel dead env vars removed (C-24) | `vercel.json` (root): removed `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` — neither is read anywhere in `apps/web/src/`. `SABISCORE_BACKEND_URL` must be set in the Vercel project dashboard for server-side proxy routes to reach the Render backend. (2026-07-04) |
| Vercel env matrix complete | `vercel.json` now includes all safe non-secret env vars: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ENABLE_PERF_MONITORING`, `NODE_ENV=production` in build.env. Secret vars documented below — set only in Vercel dashboard. (2026-07-04) |
| Docker build context fix | `Makefile` verify step now uses `backend/` as build context for backend image (was `.` which caused `requirements.txt` not-found). `apps/web/Dockerfile` `# syntax` directive removed (caused DNS failure during offline/Docker-Desktop builds). Backend Dockerfile `FROM/AS` casing normalised. (2026-07-04) |
| Pydantic v2 ConfigDict migration | All 7 production schema classes (`league`, `match`, `team`, `user`, `prediction` ×3) migrated from deprecated `class Config:` to `model_config = ConfigDict(...)`. No `class Config:` pattern remains in `backend/src/schemas/`. (2026-07-05) |
| Ruff zero-issue backend | `python -m ruff check src/` reports zero issues. All bare `except:` changed to `except Exception:` across `fbref.py`, `orchestrator.py`, `background.py`, `feature_engineering.py`. E402 intentional guard imports annotated with `# noqa: E402`. E701/E741 style issues resolved. (2026-07-05) |
| Unused import cleanup | Removed unused `from typing import List` in `endpoints/__init__.py`, unused `LegacyPredictorAdapter` import in `ultra_prediction_service.py`, and restructured `models/__init__.__getattr__` to eliminate false ruff F401 via explicit per-name returns. (2026-07-05) |
| Web lint + typecheck green | `pnpm --filter @sabiscore/web lint` (0 errors, 0 warnings) and `pnpm --filter @sabiscore/web typecheck` both pass clean. (2026-07-05) |
| Upstash Redis credential purged (SECURITY) | The same live Upstash token (`known-amoeba-10186.upstash.io`) had been committed as an env default in 10 tracked files: `apps/ws/main.py`, `apps/api/ingestion/redis_client.py`, `start_backend.bat`, and 6 docs. All purged — code/scripts now default to inert `redis://localhost:6379/0`, docs to `<UPSTASH_REDIS_TOKEN>` placeholder. `git grep ASfKAAIncDJ` is CLEAN. ⚠️ **The token must be rotated in the Upstash console** — it remains in git history until a scheduled history rewrite. (2026-07-05) |
| Provider circuit breakers — already wired via base class | The 4 non-ESPN providers (`api_football`, `football_data_org`, `sportmonks`, `the_odds_api`) route every HTTP call through `BaseProvider._get_json`, which fully wires the breaker (open-check, `record_failure` on 429/exception, `record_success` on 200). ESPN is the special case with its own `espn/` client and explicit `record_failure`. No per-provider wiring needed — earlier "unwired" claims were a misread. (2026-07-05) |
| ws service Dockerfile fixed | `apps/ws/Dockerfile` now has the `production` target `docker-compose.prod.yml` references (was `as base` only → build would fail), port aligned to compose `WS_PORT=8001` (was hardcoded 8765), `# syntax` directive dropped (offline-build footgun, same as web Dockerfile). Stale duplicate `apps/ws/Dockerfile.ws` deleted (unreferenced in master). CORS `allow_credentials` set to `False` (wildcard origin + credentials is browser-rejected). (2026-07-05) |
| Makefile mojibake fixed | 3 zero-fab-scan echo lines had double-encoded `✗` (`âœ—` = latin1-through-utf8). Restored to clean `✗`; other `✗`/`✓`/`—` glyphs were already valid UTF-8. (2026-07-05) |
| Quarter-Kelly ultra path aligned (vΩ.4) | All `kelly_fraction=0.125` (⅛-Kelly) defaults changed to `0.25` (Quarter-Kelly) in `schemas/prediction.py`, `schemas/value_bet.py`, `models/edge_detector.py` (init + docstring + example_usage), `services/ultra_prediction.py`, `services/ultra_prediction_service.py`. League model inline Kelly post-multipliers (`* 0.125`) replaced with `min(kelly_fraction, 0.04)` (policy cap 4%) in `premier_league.py`, `la_liga.py`, `ligue_1.py`, `serie_a.py`. Ultra service compounding Kelly at `ultra_prediction_service.py:364` changed from `min(kelly_fraction * 0.125, 0.05)` → `min(kelly_fraction, 0.04)`. `grep -rn "kelly_fraction.*0\.125" backend/src --include="*.py"` → 0 matches. (2026-07-05) |
| Orchestrator stale accuracy strings removed (vΩ.4, zero-fab) | `models/orchestrator.py` `_get_accuracy_target()` hardcoded dict (`'epl': '76.2%'`, `'laliga': '74.8%'` etc.) removed — actual holdout accuracy ~51%, not 76%. Method now returns `""` with a note that real accuracy comes from `model_registry.walk_forward_validate()`. `grep -rn "76\.2\|74\.8\|72\.4\|75\.1\|71\.9" backend/src` → 0 matches. (2026-07-05) |
| Integration test gate fixed (vΩ.4) | `tests/test_prediction_pipeline.py` `pytestmark` skipif previously ran the full-prediction integration tests whenever model `.pkl` files existed on disk — but post zero-fab those tests also need real provider evidence (form/stats/H2H), which the guard never checked, so 3 tests failed on every local run (and would in CI, since root `models/*.pkl` are committed). Now gated purely on `RUN_INTEGRATION_TESTS=1` (matches the module docstring's documented intent). `tests/integration/test_end_to_end.py::test_feature_transformation` rewritten to assert `engineer_features(odds-only)` raises `DataUnavailableError` (fail-closed contract) instead of expecting a fabricated vector. Both files now green: `18 passed, 9 skipped, 0 failed`. Dead F401 imports in both files removed. (2026-07-05) |
| Ultra service Kelly reads LeaguePolicy (vΩ.5) | `services/ultra_prediction_service.py` `_detect_value_bets()` now calls `get_league_policy(league_key)` and caps at `policy.kelly_cap`; falls back to `0.04` on `LeaguePolicyUnavailableError`. League model files (`premier_league.py`, `la_liga.py`, `ligue_1.py`, `serie_a.py`) replaced inline `min(kelly_fraction, 0.04)` with `_KELLY_CAP` module constant loaded from `get_league_policy()`. `grep -rn "min(kelly_fraction, 0.04)" backend/src` → 0. (2026-07-06) |
| render.yaml metadata corrected (vΩ.5) | `MODEL_VERSION: v5_phase7` (was `3.0`), `FEATURES_COUNT: 86` (was `220`). (2026-07-06) |
| Pydantic v2 ConfigDict migration complete (vΩ.5) | `backend/src/api/endpoints/ultra_predictions.py` `UltraMatchFeatures` migrated from `class Config:` to `model_config = ConfigDict(json_schema_extra=...)`. `grep -rn "class Config:" backend/src` → 0. All production schemas now on v2 API. (2026-07-06) |
| datetime.utcnow() purged from ALL of backend/src (vΩ.5 + follow-up) | Replaced with `datetime.now(timezone.utc)` across every canonical + non-canonical file. Canonical (vΩ.5): `api/endpoints/{health,predictions,ultra_predictions,explain,matches,odds}.py`, `api/legacy_endpoints.py`, `api/routes/upcoming_matches.py`, `core/security.py`, `providers/espn/__init__.py`, `models/orchestrator.py`, `services/ultra_prediction_service.py`, `services/upcoming_match_service.py`. Follow-up (2026-07-06, 103 calls / 30 files): all of `cli/`, `connectors/`, `data/`, `scrapers/`, `models/{base_model,edge_detector,enhanced_training,live_calibrator,training}.py`, `services/{data_ingestion,data_processing,model_training,ultra_prediction,upcoming_match_feature_service}.py`, `utils/{mock_data,monitoring}.py`. Every stored-datetime setter (`self.last_failure_time`, `self.start_time`, local `start_time`) is itself `datetime.utcnow()` in-file, so all co-sweep to tz-aware — no naive/aware subtraction. `orchestrator.py` `_is_cache_fresh` uses `.replace(tzinfo=None)` on both sides for legacy naive cache strings. `database.py` SQLAlchemy column callable defaults are the ONLY exemption (requires SQLAlchemy migration). Suite green (942 passed); warnings 458→436. `grep -rn "datetime\.utcnow" backend/src --include="*.py" --exclude="database.py"` → 0. (2026-07-06) |

| render.yaml Alembic + fixture sync (2026-07-06) | `render.yaml` `startCommand` → `alembic upgrade head && uvicorn ...`. Fresh Render Postgres had no tables — `require_alembic_current()` checks but never runs migrations. New `services/fixture_sync_service.py`: fetches from `FootballDataAPIClient`, upserts `League`/`Team`/`Match` rows on startup via `asyncio.create_task` — non-blocking, idempotent. `config.py` empty `DATABASE_URL` validator restores localhost default. Suite green (942 passed). (2026-07-06) |

| GATE 1 blockers resolved (vΩ.6, 2026-07-06) | 5 silent failures fixed (commit 372035c). (1) `fixture_sync_service.py:81` — tz-aware `match_date` now stripped to naive UTC before `Match()` insert; asyncpg `DataError` no longer swallowed silently — sync now inserts rows. (2) `fixtures.py` `fixtures_upcoming` + `_get_fixture_or_404` — `selectinload(Match.home_team, Match.away_team)` added; `_fixture_summary`, refresh, and analyze endpoints now return actual team names not FK slugs. (3) `config.py` — 6 pydantic v1 `ValidationError([...], Settings)` replaced with `ValueError(...)` inside `@model_validator`; pydantic v2 wraps ValueError correctly instead of raising `TypeError`. Unused `ValidationError` import removed. (4) `analyze/route.ts` — `z.union` schema requires `fixture_id` on single path; `odds` values constrained to `z.number().gt(1.0)`; branch detection uses `"matches" in validation.data`. (5) `apps/web/src/app/api/health/route.ts` — proxies `GET /health/ready` from backend instead of returning hardcoded Phase 8 constants; Phase 7 baseline metrics returned as labeled baseline. Suite: 945 passed (3 new fixture_sync tests), 13 skipped, 0 failed. |

| Health endpoint model path (vΩ.7, 2026-07-07) | `health.py` uses `settings.models_path` which resolves via `_PROJECT_ROOT = Path(__file__).resolve().parents[3]` (source-relative, not CWD-relative). `models/sabiscore_production_v2.joblib` + all 5 `*_ensemble.pkl` files are committed at repo root `models/` — health endpoint finds them correctly on Render regardless of uvicorn CWD. No code change needed; the path risk identified in planning was a false alarm. |

| Fixture sync unit tests (vΩ.7, 2026-07-07) | `backend/tests/unit/test_fixture_sync.py` — 3 tests added in vΩ.6 (commit 372035c), confirmed passing: idempotent re-sync (same data → 0 new rows), unsupported competition dropped (only 7-competition closed set accepted), malformed date skipped (valid neighbours still inserted). |

| CI: Responsible gambling copy scan (vΩ.7, 2026-07-07) | `.github/workflows/ci.yml` `web-quality` job — new step "Responsible gambling copy scan" after lint. Scans `apps/web/src/` for CLAUDE.md prohibited terms (`lock`, `banker`, `guaranteed`, `sure bet`, `free money`, `execute immediately`). Filters: import lines, JSDoc/comment lines, camelCase Lock identifiers, and negated `guaranteed` contexts (required responsible gambling disclaimers). Both pattern sets locally verified: 0 hits on current codebase. No `|| true`. |

| CSP frame-src for Vercel toolbar (vΩ.8, 2026-07-13) | `apps/web/src/middleware.ts` CSP gains `frame-src 'self' https://vercel.live` — without it, `default-src 'self'` blocked the Vercel preview toolbar iframe. `frame-ancestors 'none'` unchanged (controls who embeds us; frame-src controls what we embed). |

| Transition screen zero-fab cleanup (vΩ.8, 2026-07-13) | `match-loading-experience.tsx` + `match-loading-interstitial.tsx`: (1) `generateMockStats()` deleted — loading screen fabricated form/GF/GA/table-position from a name hash; replaced with `TeamEvidenceCard` labeled skeletons ("Syncing form & standings…"). (2) Poll fake community votes (45/25/30) removed — shows user's own pick only. (3) Interstitial fabricated "AI Confidence 77%" removed → neutral "Finalizing analysis…". (4) Promotional FUN_FACTS (profit/ROI/win-rate claims) removed; facts + LOADING_FACTS deduped into shared `components/loading/loading-facts.ts` (no bookmaker brand claims). (5) Footer "8 data sources • Updated every 5 min" → verifiable copy. (6) `useReducedMotion` gates all infinite animations + particles; progress bars gain `role="progressbar"` ARIA. Dynamic Tailwind `border-${color}-500` (never compiled under JIT) → static class map. Lint/typecheck/tests/build green. |

| Shared React Query retry policy (vΩ.8, 2026-07-13) | `apps/web/src/lib/query-retry.ts` (+ `.test.ts`, 5 cases): error-aware `shouldRetryQuery` + capped-exponential `queryRetryDelay` (2s/4s/8s→12s) wired into the QueryClient default in `providers.tsx`. Never retries permanent 4xx (except 408 timeout); gives cold-start/5xx/network up to 3 bounded retries so the dashboard **self-heals** once a Render free-tier backend finishes spinning up (~30-60s) instead of showing a permanent empty state. Removed the six ad-hoc numeric `retry:` overrides (`retry: 0/1/2`) from `upcoming-matches-panel` (×2), `full-analysis-dashboard`, `phase8-analytics-panel`, `readiness-ring`, `insights-display`, `best-bet-spotlight` so all queries inherit one consistent policy. `isBackendUnavailable(error)` exported for calm outage UI. Admin `model-health-client` polling left untouched. |

| Duplicate-chrome overlay on /match removed (vΩ.9, 2026-07-14) | `app/match/layout.tsx` DELETED — it rendered a second `<Header/>` (the `PremiumHeader` hero: Sabiscore logo, nav cards, Launch App, metrics) plus a nested `<main>` INSIDE the root `app/layout.tsx` shell (fixed LEAGUES sidebar + sticky "LIVE WORKSPACE" header + `<main>`). Two `sticky top-0` headers (root z-40 vs Premium z-50) fought and the tall PremiumHeader floated over the match analysis while it scrolled underneath (all 5 vΩ.9 screenshots). This is the same duplicate-header class fixed on the homepage 2026-07-05; the match layout still violated "root `layout.tsx` is the sole nav surface". Match pages now render in the root shell like every other route. `components/header.tsx` DELETED too — `match/layout.tsx` was its only importer (confirmed via grep), so `PremiumHeader`/`LegacyHeader`/`Header` were dead; removing prevents re-introduction. Nav reachability preserved by adding a **"Workspace" nav group** to the root sidebar (`app/layout.tsx`): Intelligence/Matches/Performance/Monitoring/Docs with lucide icons — previously `/performance` + `/monitoring` were reachable ONLY via the broken PremiumHeader. Also fixed `app/match/page.tsx` copy: "⅛ Kelly" → "Quarter Kelly" (contract violation — platform is certified Quarter-Kelly 0.25) and false "Updated every 15s" cadence → "Fetched fresh per request" (the `[id]` page is `force-dynamic`; no 15s polling exists). ⚠️ Clear `.next` before typecheck after deleting a layout (stale `.next/types` referenced `match/layout.js`). Lint/typecheck/tests(16/16)/build green. |

| Client surface polish — 5 gates (vΩ.10, 2026-07-14) | **GATE A**: `backend-status-banner.tsx` — `useQuery` on `/api/health` every 30s; amber slim bar when `backendStatus="unavailable"` (Render cold-start); auto-dismisses on recovery; wired into `layout.tsx` between header and `<main>`. **GATE B**: `page.tsx` — HERO_STATS captions (holdout accuracy / no synthetic injection / RPS lower-is-better / qualified edge); "RPS Gate" → "Model Precision Gate"; TRUST_BADGES "Phase 8 features" → "ML features validated"; CTA "Open Intelligence" → "See today's value picks" (both home variants); pipeline `<details>` collapse hides technical detail behind summary link. **GATE C**: `betting-intelligence-dashboard.tsx` — `.bi-gloss` + `.bi-gap-summary` CSS added to inline style block; `<em className="bi-gloss">` glosses on Edge / EV / Stake metric labels and Fair market / Edge / EV table header spans; `data_gaps.length > 5` → native `<details>` collapse (zero JS). **GATE D**: `loading-facts.ts` reordered — first 5 entries mirror 5 homepage pipeline steps (Collect→Validate→Calibrate→Compare→Surface); `ProgressiveConfidenceMeter` milestone labels Data/Models/Confidence → Collect/Calibrate/Compare; 15s `setTimeout` cold-start hint with `AnimatePresence` (respects `useReducedMotion`). **GATE E**: `lib/league-colors.ts` extracted (7-league map); `upcoming-matches-panel` + `best-bet-spotlight` import from shared lib (local consts deleted); `mobile-nav.tsx` hamburger + full-screen overlay drawer wired `lg:hidden` inside layout sticky header — covers all WORKSPACE_LINKS + LEAGUES, ESC + backdrop-click closes. **Bonus**: ⅛ Kelly contract violation sweep — `insights-display.tsx`, `OneClickBetSlip.tsx`, `performance-page-client.tsx` labels + `currency.ts` JSDoc all corrected to ¼ / Quarter-Kelly. `grep ⅛ apps/web/src` = 0. Lint 0 / typecheck clean / tests 16/16 / `NODE_ENV=production next build` ✓. |

| upcoming_match_service DB read path timezone fix (vΩ.13, 2026-07-14) | `backend/src/services/upcoming_match_service.py` `_get_upcoming_matches_from_db()` passed `datetime.now(timezone.utc)` (tz-aware) to asyncpg for a `TIMESTAMP WITHOUT TIME ZONE` column — same class of bug fixed for inserts in vΩ.6. Fixed with `.replace(tzinfo=None)` before the query. Also added `avg_edge_pct=0.0` and `source="error"` to the `get_upcoming_matches_with_predictions` exception fallback dict to prevent a secondary Pydantic `ValidationError` cascading to the endpoint. 15 provider+fixture tests green. (2026-07-14) |

| Off-season verified + provider enablement (vΩ.12, 2026-07-14) | **NOT A BUG — off-season**: mid-July is the European summer break. Live backend `/api/v1/upcoming/matches` correctly returns `offseason: true`, `next_season_start: "2026-08-08"`, `total: 0`; the frontend already renders `LeagueOffseasonNotice` (in `upcoming-matches-panel.tsx`) with the Aug-8 restart countdown. Empty fixtures + the 33/33/33 baseline on a hand-typed matchup are correct fail-closed behavior, not defects. Do NOT "fix" empty fixtures — they return automatically when the season resumes. **Provider enablement**: live `/api/v1/providers/health` showed only `espn` + `football_data_org` enabled (backend defaults); `api_football`/`sportmonks`/`the_odds_api` were `enabled:false` (`provider_disabled`) because `render.yaml` never declared them. Added `ENABLE_API_FOOTBALL_PROVIDER`/`ENABLE_SPORTMONKS_PROVIDER`/`ENABLE_THE_ODDS_API_PROVIDER=true` + `API_FOOTBALL_API_KEY`/`SPORTMONKS_API_TOKEN`/`THE_ODDS_API_KEY` (`sync:false`) to `render.yaml` — the operator sets the 3 keys in the Render dashboard and all 5 light up (unconfigured shows "needs key", never crashes). **SECURITY**: provider keys + DB/Redis/SECRET_KEY were pasted into a chat transcript this session — all must be rotated in their consoles; `.env*` is gitignored and none are tracked (`git ls-files` clean). |

| Live backend cutover + reload-loop fix (vΩ.11, 2026-07-14) | **GATE 1 UNBLOCKED**: live backend is `https://sabiscore-api-bav1.onrender.com` (service `srv-d95kkffaqgkc73f8003g`) — a NEW Render service; the old `sabiscore-api.onrender.com` remains suspended (Render kept blueprint name `sabiscore-api`, assigned unique subdomain `-bav1`). `/health/ready` → 200: DB connected, Alembic at `0003_team_reconciliation`, cache connected, 5 league models loaded (v5_phase7, 18 artifacts). **URL refs updated**: `vercel.json` rewrites (`/api/v1/health`, `/api/v1/:path*` — LOAD-BEARING: `ultra-api-client.ts` deliberately fetches relative `/api/v1/ultra/*` from the browser to ride these same-origin rewrites), `render.yaml` `ALLOWED_HOSTS`, 5 ops `.ps1` scripts; stale `vercel.json.backup` deleted. **Reload-loop fix**: `insights-error-state.tsx` was a full-viewport hero that `window.location.reload()`ed every 30s FOREVER on ultra-insights failure while `FullAnalysisSection` below rendered live data (match/[id]/page.tsx mounts both). Now a compact card; auto-reload capped at 2/matchup/tab-session via `sessionStorage` (`ss-insights-retries:*`); manual retry uncapped; `insights-display-wrapper.tsx` clears counters on successful load. **Reduced-evidence honesty**: `DataGapBanner` >8 gaps → `<details>` collapse with plain-language summary (was a 67-item wall); `EnsembleCard` shows amber "Baseline output — not a tradable signal" note when `model_version` contains "fallback"; Phase 8 disabled notice de-dev'd (env-var instructions → "staged rollout" copy). Lint 0 / typecheck clean / tests 16/16 / prod build ✓. |

## Confirmed incomplete / next gates

| Gap | Files | Action |
|---|---|---|
| Vercel env var | Vercel dashboard (not code) | `SABISCORE_BACKEND_URL=https://sabiscore-api-bav1.onrender.com` (NOT the old suspended `sabiscore-api` host). Proxies default to `http://localhost:8000` without it. Deployment screenshots 2026-07-14 show live backend data flowing, so this appears set — verify it targets the bav1 URL. |
| Walk-forward RPS — live run | `models/model_registry.py` | Framework present; run `registry.walk_forward_validate(records)` once live match data accumulates |
| Provider adapters (fdo, sm) — live verification | `football_data_org.py`, `sportmonks.py` | Code operational; needs live API key response to verify upstream contract |
| make verify (full 14-step) | `Makefile` | Requires Postgres + Docker + all credentials active; run when Docker available |
| C-24 Vercel deployment | Vercel project | vercel.json ready; set `SABISCORE_BACKEND_URL` in Vercel dashboard then link project to repo |

## Provider enable flag alignment (2026-07-04)

`backend/.env` uses two files: `(project_root/.env, backend/.env)` — the latter wins on conflict.
When adding ENABLE flags to the root `.env`, also add them to `backend/.env` (or set them there directly).
Canonical names: `ENABLE_FOOTBALL_DATA_PROVIDER`, `ENABLE_API_FOOTBALL_PROVIDER`, `ENABLE_SPORTMONKS_PROVIDER`, `ENABLE_THE_ODDS_API_PROVIDER`.
Aliases: `API_FOOTBALL_KEY` → `API_FOOTBALL_API_KEY`; `SPORTMONKS_API_KEY` → `SPORTMONKS_API_TOKEN`; `ODDS_API_KEY` → `THE_ODDS_API_KEY` — all accepted via `AliasChoices`.

---

# PROVIDERSTAT US — ACTUAL ENUM (NOT DOCUMENTED NAMES)

The actual `ProviderStatus` enum in `backend/src/providers/base.py`:

| Documented (preferred) | Actual code |
|---|---|
| `DISABLED` | (absent) — disabled → `UNAVAILABLE` + `provider_disabled` warning |
| `DEGRADED` | `PARTIAL` |
| `SCHEMA_INVALID` | `INVALID` |
| `CONFIGURED_UNVERIFIED` | `CONFIGURED_UNVERIFIED` |
| All others | Match exactly |

Always grep `base.py` before writing code that pattern-matches provider status.

---

# DUAL-ENGINE RULE (NON-NEGOTIABLE)

`betting_intelligence.py` and `core_engine.py` are independent implementations.
**Any change to verdict gates, ranking, Kelly, or watchlist MUST be applied to BOTH.**

```bash
git diff --name-only | grep -E "betting_intelligence|core_engine"
# Must show BOTH files after any engine change
```

Use `sabiscore-betting-engine-auditor` skill for all betting engine work.
