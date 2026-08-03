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
| Backend | **Python 3.11 production (FastAPI 0.104.1); Python 3.14 local compatibility (FastAPI 0.115.x)** | Fastify 5, Effect-TS |
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
| Walk-forward RPS skeleton | `model_registry.py` `walk_forward_validate(records, n_splits=5)` — temporal CV over stored match records. (2026-07-04) ⚠️ **Corrected (vΩ.29, 2026-07-28):** the original "runnable once data accumulates" framing was wrong — it passed a one-hot list to `ranked_probability_score(y_true_outcome: int, probs)`, which expects a plain int; the resulting `TypeError` was silently swallowed by a bare `except Exception: pass`, so the function *always* returned `{"skipped": True, "reason": "no_valid_folds"}` regardless of data volume. The scorer now converts the outcome to an integer, validates the 0/1/2 outcome domain and finite probability simplex, and skips only malformed records rather than swallowing unexpected scoring defects. `backend/tests/test_model_registry_walk_forward.py` is isolated from production PostgreSQL/Redis and has 6 synthetic regression tests covering metric extrema, the minimum-data gate, valid folds, mixed invalid records, and all-invalid behavior. Focused result: `6 passed`. Still genuinely blocked on real match data (season resumes 2026-08-08) and on a records-sourcing helper: no code joins `MatchPredictionLog` (what's actually written per prediction, `canonical_fixture_id` hardcoded `None`) to actual final scores (`Match.home_score`/`away_score`) — `Prediction`, the table with the clean FK, is dead code, nothing instantiates it. Deliberately deferred, not built this session — the same gap `GET /model-performance` already stubs honestly as `503 bet_history_aggregation_not_yet_integrated`. |
| Provider live-verify: football_data_org + sportmonks now VERIFIED (vΩ.29, 2026-07-28) | Ran `PYTHONPATH=. python -m src.cli providers doctor --provider <id> --validate-live` locally against the credentials already in `backend/.env` — local-only, independent of the Render blueprint-sync blocker above. Both returned public status `"configured"`; since each provider's `probe()` only ever returns `VERIFIED` or `UNAVAILABLE`, and the public 5-state CLI (`_provider_cli_status` in `cli/providers.py`) only remaps `UNAVAILABLE`/`CIRCUIT_OPEN`/`PARTIAL`/`CONFLICTING` away from `"configured"`, this can only mean the live probe returned `VERIFIED`. Both upstream contracts are now genuinely exercised against a real key, not just code-complete. `api_football`/`the_odds_api` were not probed this session (not flagged as a gap in the incomplete-gates table, out of scope). |
| vΩ.29 certification recovery checkpoint (2026-07-28) | Live Render readiness recovered after warm-up: database, Alembic head `0003_team_reconciliation`, cache, and all five required Phase 7 league artifacts report ready. Canonical provider status is `/api/v1/providers/health` (`/providers/status` is obsolete and returns 404). Both Vercel aliases return `sha:"f33b5ab"` and healthy backend checks. Provider health remains 2 enabled / 5 configured: `espn` and `football_data_org` are `CONFIGURED_UNVERIFIED`; `api_football`, `sportmonks`, and `the_odds_api` remain disabled pending Render Blueprint approval. `sabiscore.com` is attached to the Vercel `web` project, but verification is pending the registrar A record `76.76.21.21`; do not claim the domain live yet. Docker Desktop 29.6.2 and Kubernetes `readyz` recovered on 4 CPUs / about 4 GB RAM, below the supplied 6–8 GB stability recommendation. Compose config and a real local PostgreSQL Alembic upgrade/check pass; both production Docker image builds timed out after 15 minutes and produced no current verify image. Local gates: Ruff 0; RPS 6/6; backend 972 passed / 13 skipped; web lint/typecheck clean, Vitest 70/70, production build passed; copy scan 0; Gitleaks clean; Playwright 4/4; scraper 6/6. GitHub Actions jobs still fail before step 1 with no runner log. Upstash rotation and the Render non-sleeping-plan upgrade remain operator-unconfirmed. Certification remains `NOT SAFE FOR PRODUCTION` while those release blocks exist. |
| vΩ.30 core-readiness and provider-activation clarity (2026-07-28) | `health-status.ts` now differentiates **core-system** readiness from provider activation. `ReadinessRing` uses Core ready/Core partial/Core unavailable because it measures only database, migrations, cache, and models. `PlatformHealthPills` reports configured-provider activation as `N of M enabled` and is green only when every configured provider is enabled; partial activation stays amber. This is presentation only: it does not run live probes, change provider settings, or alter official model/stake/verdict logic. The backend production Docker path now copies `src/` directly instead of copying the development stage, avoiding the previous minimal-requirements installation before the full production install. Focused health-status regression tests (14), web typecheck, and Docker Buildx static checks pass. Full image-build evidence remains required. |
| vΩ.30 CachedLogo test-warning removal (2026-07-29) | `components/ui/cached-logo.tsx` no longer forwards `fetchPriority` to a raw `<img>`, which React 18 warns about in the full-analysis loading test. Native `loading="eager"` remains the above-fold priority mechanism. `cached-logo.test.tsx` asserts eager image loading, no forwarded fetch-priority attribute, and `onLoad` delivery. Full web lint, typecheck, 72 Vitest tests, and the production build pass without the prior React warning. |
| ⭐ Loading interstitial must add NO padding of its own (vΩ.31, 2026-07-30) | **Fourth regression of the container-parity class** (vΩ.14 max-h trap, vΩ.20 narrow strip, vΩ.25 width mismatch). `match-loading-experience.tsx` wrapped its `max-w-6xl` container in `p-4`, but the root `<main>` (`app/layout.tsx:203`) already applies `px-4 py-5 sm:px-6 lg:px-8` and `app/match/[id]/page.tsx` adds none — so loading content was inset 16px per side and snapped wider the instant results landed. `p-4` removed from **both** the live container and `MatchLoadingExperienceSkeleton`; the `match-selector.tsx` overlay wrapper gained `py-4` because it is the one usage site with **no `<main>` ancestor** supplying padding. ⚠️ **Container parity is now FOUR things, not three:** live container, SSR skeleton, overlay wrapper, and the root `<main>`'s own padding — check what the parent already supplies before adding any to this component. Pinned by two `not.toMatch(/\bp-4\b/)` assertions in `match-loading-experience.test.tsx`. |
| Match-selector footer no longer claims unverifiable "Live Data" (vΩ.31, 2026-07-30) | The footer under *Generate Insights* hardcoded a pulsing green "Live Data" dot + static "5 Providers Configured" — contradicting `PlatformHealthPills` in the same page header, which correctly read "2 of 5 enabled". Same defect class as the vΩ.23 providers-pill fix, which corrected one copy of the claim and missed this second one. Now reuses `derivePlatformHealth` + `fetchPlatformHealth` on the shared `PLATFORM_HEALTH_QUERY_KEY` (React Query dedupes against the header's fetch — no extra request), rendering real `{enabled} of {configured} providers enabled`, amber unless all configured providers are enabled. ⚠️ **When correcting a fabricated claim, grep for other copies of the same string** — this one survived two prior zero-fab passes. |
| EnsembleCard contradicted its own non-display claim (vΩ.31, 2026-07-30) | With `probabilities_available: false` the card rendered "Diagnostic baseline values are not displayed" and then, gated on the **identical** `!available` condition, described the suppressed value's shape: "probabilities default toward even". The second caveat is deleted. This was the standard reduced-evidence path (visible in every off-season screenshot), not a rare branch. `EnsembleCard` gained `export` for testability, matching the vΩ.28 precedent for `RLCard`/`OddsEdgeCard`; regression test in `full-analysis-dashboard.test.tsx`. |
| Team dropdowns cross-filter (vΩ.31, 2026-07-30) | Both `TeamAutocomplete` instances in `match-selector.tsx` received the identical unfiltered `leagueTeams`, so a team already chosen as Home stayed selectable as Away; `handleSubmit` rejected it only after submit via a toast. New exported `excludeSelectedTeam(teams, selected)` filters each side using the **same** trim/lowercase normalization the submit guard uses. Pinned by `match-selector.test.tsx` (new file — the component had no test before). |
| ⭐⭐ Whole prediction pipeline was dead in production — TWO stacked bugs behind one opaque gap (vΩ.32, 2026-08-03) | **Live probe of `GET /api/v1/upcoming/matches` returned `predictions: null` + `data_gaps: ["prediction_failed"]` for 50/50 fixtures across all 5 leagues**, while `/health/ready` reported all four checks green and 18 model artifacts loaded. The season had restarted (real fixtures from 2026-08-07), so this was no longer the off-season no-op that vΩ.12 documented. Both bugs sat inside `get_upcoming_matches_with_predictions`'s broad `except Exception`, which flattened every distinct failure into the same three words. **Bug 1 —** `features_result.get("features") or .get("features_68") or .get("features_58")`: `project_match_features()` returns `features_68`/`features_58` but *no* `features` key, so the chain evaluated `bool()` on a 68-element ndarray → `ValueError: truth value of an array ... is ambiguous`, on every fixture. Now `_select_feature_vector()`, an explicit `is not None` scan. **Bug 2 (only visible after Bug 1 was fixed) —** `odds_service.fetch_live_odds` called `provider.odds(sport=...)` but `TheOddsAPIProvider.odds` had been renamed to keyword-only `competition=` → `TypeError` on every call, *after* a valid prediction had been computed, discarding it. ⚠️ **A broad `except` around a multi-step loop hides an unbounded number of stacked defects — fixing the first only reveals the second.** Reproduce locally with a stub session rather than guessing from prod: `uptime_seconds` on `/health` cannot distinguish a redeploy from a free-tier cold-start wake, and old/new code emitted byte-identical output on the except path. |
| Odds league vocabulary was duplicated and defaulted to EPL (vΩ.32, 2026-08-03) | `odds_service._league_to_sport_key()` carried a second, stale copy of the competition→Odds-API-sport map whose fallback was `return league_map.get(normalized, "soccer_epl")` — **any unrecognised league silently fetched English Premier League odds**, i.e. a Dutch fixture could be priced against an English market. Deleted; `TheOddsAPIProvider._SABISCORE_COMP_TO_ODDS_SPORT` is the single source of truth and rejects an unknown code before any HTTP call. The service now passes `canonical_league_id(league)` through verbatim. ⚠️ Note `canonical_league_id` does **not** raise on an unknown-but-non-empty league — it upper-cases as a fallback and only raises on empty input; don't rely on it to reject unsupported competitions. Pinned by `backend/tests/test_odds_service_contract.py` (stubbed provider — asserts the kwarg contract and that the league is never rewritten). |
| Public predictions gated on synthetic inputs (vΩ.32, 2026-08-03) | Fixing the two pipeline bugs above would otherwise have *started* publishing predictions built from all-defaults feature vectors. `get_upcoming_matches_with_predictions` now computes `publishable = not is_fallback and not is_synthetic`; non-publishable matches return `predictions: null` plus an explicit `model_prediction_fallback` / `required_model_inputs_unavailable` gap instead of the opaque `prediction_failed`, and never reach `calculate_value_bets()`. Mirrors the `REQUIRED_MODEL_INPUTS_UNAVAILABLE` critical gap in `full_analysis.py`. Prediction cache key bumped to `upcoming:predictions:v2:` so the change takes effect on deploy, not after TTL. |
| ⚠️ Redis is NOT connected in production despite readiness saying "Connected" (vΩ.32, 2026-08-03) | `/health` component metrics read `tier1_redis_enabled: false`, `tier2_upstash_active: false`, `tier2_upstash_configured: false`, `backend_enabled: false`, `tier3_memory_entries: 11` — i.e. the cache is **in-process memory only**, which does not survive a restart and is not shared across workers. Meanwhile `/health/ready` reports `cache: {"status":"ready","message":"Connected"}`. Treat the readiness line as *not* evidence of Redis connectivity; check the `/health` metrics block. The Upstash credential flagged for rotation since vΩ.5 remains operator-unconfirmed, and `REDIS_URL` is a `sync: false` Render secret, so this is consistent with the variable never having been populated. |
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

| Shared React Query retry policy (vΩ.8, revised vΩ.18) | `apps/web/src/lib/query-retry.ts` (+ `.test.ts`, 5 cases) remains the default for general queries. Match analysis is intentionally stricter: 25-second upstream proxy timeout, 28-second total client budget, one automatic retry only for retryable infrastructure failures, then manual retry. HTTP 500 is `backend_internal_error`, not cold start. `isBackendUnavailable(error)` remains available for general outage UI. Admin `model-health-client` polling is unchanged. |

| Duplicate-chrome overlay on /match removed (vΩ.9, 2026-07-14) | `app/match/layout.tsx` DELETED — it rendered a second `<Header/>` (the `PremiumHeader` hero: Sabiscore logo, nav cards, Launch App, metrics) plus a nested `<main>` INSIDE the root `app/layout.tsx` shell (fixed LEAGUES sidebar + sticky "LIVE WORKSPACE" header + `<main>`). Two `sticky top-0` headers (root z-40 vs Premium z-50) fought and the tall PremiumHeader floated over the match analysis while it scrolled underneath (all 5 vΩ.9 screenshots). This is the same duplicate-header class fixed on the homepage 2026-07-05; the match layout still violated "root `layout.tsx` is the sole nav surface". Match pages now render in the root shell like every other route. `components/header.tsx` DELETED too — `match/layout.tsx` was its only importer (confirmed via grep), so `PremiumHeader`/`LegacyHeader`/`Header` were dead; removing prevents re-introduction. Nav reachability preserved by adding a **"Workspace" nav group** to the root sidebar (`app/layout.tsx`): Intelligence/Matches/Performance/Monitoring/Docs with lucide icons — previously `/performance` + `/monitoring` were reachable ONLY via the broken PremiumHeader. Also fixed `app/match/page.tsx` copy: "⅛ Kelly" → "Quarter Kelly" (contract violation — platform is certified Quarter-Kelly 0.25) and false "Updated every 15s" cadence → "Fetched fresh per request" (the `[id]` page is `force-dynamic`; no 15s polling exists). ⚠️ Clear `.next` before typecheck after deleting a layout (stale `.next/types` referenced `match/layout.js`). Lint/typecheck/tests(16/16)/build green. |

| Client surface polish — 5 gates (vΩ.10, 2026-07-14) | **GATE A**: `backend-status-banner.tsx` — `useQuery` on `/api/health` every 30s; amber slim bar when `backendStatus="unavailable"` (Render cold-start); auto-dismisses on recovery; wired into `layout.tsx` between header and `<main>`. **GATE B**: `page.tsx` — HERO_STATS captions (holdout accuracy / no synthetic injection / RPS lower-is-better / qualified edge); "RPS Gate" → "Model Precision Gate"; TRUST_BADGES "Phase 8 features" → "ML features validated"; CTA "Open Intelligence" → "See today's value picks" (both home variants); pipeline `<details>` collapse hides technical detail behind summary link. **GATE C**: `betting-intelligence-dashboard.tsx` — `.bi-gloss` + `.bi-gap-summary` CSS added to inline style block; `<em className="bi-gloss">` glosses on Edge / EV / Stake metric labels and Fair market / Edge / EV table header spans; `data_gaps.length > 5` → native `<details>` collapse (zero JS). **GATE D**: `loading-facts.ts` reordered — first 5 entries mirror 5 homepage pipeline steps (Collect→Validate→Calibrate→Compare→Surface); `ProgressiveConfidenceMeter` milestone labels Data/Models/Confidence → Collect/Calibrate/Compare; 15s `setTimeout` cold-start hint with `AnimatePresence` (respects `useReducedMotion`). **GATE E**: `lib/league-colors.ts` extracted (7-league map); `upcoming-matches-panel` + `best-bet-spotlight` import from shared lib (local consts deleted); `mobile-nav.tsx` hamburger + full-screen overlay drawer wired `lg:hidden` inside layout sticky header — covers all WORKSPACE_LINKS + LEAGUES, ESC + backdrop-click closes. **Bonus**: ⅛ Kelly contract violation sweep — `insights-display.tsx`, `OneClickBetSlip.tsx`, `performance-page-client.tsx` labels + `currency.ts` JSDoc all corrected to ¼ / Quarter-Kelly. `grep ⅛ apps/web/src` = 0. Lint 0 / typecheck clean / tests 16/16 / `NODE_ENV=production next build` ✓. |

| asyncpg naive/aware datetime sweep — live web paths (vΩ.13, 2026-07-14) | `Match.match_date` is a naive `TIMESTAMP WITHOUT TIME ZONE` column; asyncpg raises `DataError: can't subtract offset-naive and offset-aware datetimes` at **bind time** (regardless of table contents) when a tz-aware `datetime.now(timezone.utc)` bound is passed. The observed prod log flood on `/api/v1/upcoming/matches` + `/api/v1/value-bet-scan` came from **(1)** `services/upcoming_match_service.py` `_get_upcoming_matches_from_db()` — fixed with `.replace(tzinfo=None)`; its `get_upcoming_matches_with_predictions` exception fallback dict also gained `avg_edge_pct=0.0`/`source="error"` (was cascading a secondary Pydantic `ValidationError`). Grepped every `Match.match_date [<>]=` caller for siblings and fixed the two other **live, async, web-service-reachable** ones with the same convention: **(2)** `api/endpoints/matches.py:123` (`/api/v1/matches/upcoming`, mounted router) — strip `now`; **(3)** `services/upcoming_match_feature_service.py` `project_match_features()` — strip the incoming `match_date` param at entry (covers both internal form/goals sequence queries; fires when season resumes and API ISO strings carry `+00:00`). `fixtures.py:428` was already stripped in vΩ.6. **Deferred (not in the deployed web `startCommand` blast radius):** `services/data_ingestion.py` (5 async sites) runs only via `cli/start_ingestion.py`, a separate worker; `tasks/background.py` Celery tasks use sync `SessionLocal()`/psycopg2 (different encoder, not the observed asyncpg error). Both are the same class and should adopt the strip when that worker is next deployed. Ruff clean; 15 provider+fixture tests green; all three edited files `py_compile` OK. (2026-07-14) |

| make verify gate 1 unblocked (vΩ.13, 2026-07-14) | `make verify` step 1 runs `gitleaks detect --no-git` (filesystem mode, scans gitignored files too). It flagged a JWT in the local untracked `.env.local` — the `.gitleaks.toml` allowlist covered `(^|/)\.env$` + `backend/\.env$` but not the `.env.local` convention. Allowlist gains `(^|/)\.env(\.[a-z]+)?\.local$` (covers `.env.local`, `.env.development.local`, `.env.production.local`; tracked `.env*.example` templates never end in `.local` and stay scannable; CI git-mode history scan unaffected). Gate 1 → exit 0, "no leaks found"; gate 2 `verify-core` → all 6 deterministic steps pass (backend safety/provider/engine/scraper regressions, OpenAPI 78 paths, provider CLI offline, scraper parsers + manifest, py-compile + zero-fab). Remaining gates 3–14 need Postgres + Docker + wall time. The screenshots that accompanied this session (33/33/33, PARTIAL, abstain, degraded sources) are correct off-season fail-closed states per vΩ.12 — no UI change made. (2026-07-14) |

| Off-season verified + provider enablement (vΩ.12, 2026-07-14) | **NOT A BUG — off-season**: mid-July is the European summer break. Live backend `/api/v1/upcoming/matches` correctly returns `offseason: true`, `next_season_start: "2026-08-08"`, `total: 0`; the frontend already renders `LeagueOffseasonNotice` (in `upcoming-matches-panel.tsx`) with the Aug-8 restart countdown. Empty fixtures + the 33/33/33 baseline on a hand-typed matchup are correct fail-closed behavior, not defects. Do NOT "fix" empty fixtures — they return automatically when the season resumes. **Provider enablement**: live `/api/v1/providers/health` showed only `espn` + `football_data_org` enabled (backend defaults); `api_football`/`sportmonks`/`the_odds_api` were `enabled:false` (`provider_disabled`) because `render.yaml` never declared them. Added `ENABLE_API_FOOTBALL_PROVIDER`/`ENABLE_SPORTMONKS_PROVIDER`/`ENABLE_THE_ODDS_API_PROVIDER=true` + `API_FOOTBALL_API_KEY`/`SPORTMONKS_API_TOKEN`/`THE_ODDS_API_KEY` (`sync:false`) to `render.yaml` — the operator sets the 3 keys in the Render dashboard and all 5 light up (unconfigured shows "needs key", never crashes). **SECURITY**: provider keys + DB/Redis/SECRET_KEY were pasted into a chat transcript this session — all must be rotated in their consoles; `.env*` is gitignored and none are tracked (`git ls-files` clean). |

| Live backend cutover + reload-loop fix (vΩ.11, revised vΩ.18) | **GATE 1 UNBLOCKED**: live backend is `https://sabiscore-api-bav1.onrender.com` (service `srv-d95kkffaqgkc73f8003g`) — a NEW Render service; the old `sabiscore-api.onrender.com` remains suspended (Render kept blueprint name `sabiscore-api`, assigned unique subdomain `-bav1`). `/health/ready` → 200: DB connected, Alembic at `0003_team_reconciliation`, cache connected, 5 league models loaded (v5_phase7, 18 artifacts). **URL refs updated**: `vercel.json` rewrites (`/api/v1/health`, `/api/v1/:path*` — LOAD-BEARING: `ultra-api-client.ts` deliberately fetches relative `/api/v1/ultra/*` from the browser to ride these same-origin rewrites), `render.yaml` `ALLOWED_HOSTS`, 5 ops `.ps1` scripts; stale `vercel.json.backup` deleted. **Reload-loop fix**: `insights-error-state.tsx` is a compact card; the API client owns one bounded infrastructure retry inside the 28-second total budget, after which recovery is manual. No page reload loop or `sessionStorage` retry counter remains. **Reduced-evidence honesty**: `DataGapBanner` >8 gaps → `<details>` collapse with plain-language summary; baseline output is unavailable for betting, all public stake fields are zero, and Phase 8 disabled notice remains compact. vΩ.18 verification supersedes the older gate counts. |

| make verify Windows venv resolution (vΩ.14, 2026-07-14) | `Makefile` `verify-core`/`verify` invoked bare `python`/`alembic`, which in `make`'s bash subshell resolve to the system `C:\Python314` (no scientific deps) or fail `command not found` — never the repo venv. `PYTHON_BIN` (line 31) auto-detects `.venv/bin/python` (Unix) then `.venv/Scripts/python.exe` (Windows), prefixed with `$(CURDIR)` so `cd backend &&` in recipes doesn't break the relative path. All five `python` sites + both `alembic` sites in gates 2/3/4/14 now use `$(PYTHON_BIN)` / `$(PYTHON_BIN) -m alembic`. Gates 1→3 pass locally (secret scan, 6/6 deterministic core, 945 backend tests); gate 4 now *resolves* alembic (was "command not found") and reaches the DB config — remaining gate-4 failure is the documented "needs a valid `DATABASE_URL`" env limitation, not a tooling defect. |

| Transition/loading screen spill-over fixed (vΩ.14, 2026-07-14) | `MatchLoadingExperience` (the active `/match/[id]/loading.tsx` transition screen; `PREDICTION_INTERSTITIAL_V2` defaults true) self-imposed a `max-h-[calc(100vh-4rem)] overflow-y-auto` internal scroll trap keyed to a hardcoded 4rem header offset. But the root shell (`app/layout.tsx`) stacks a sticky ~65px header + `BackendStatusBanner` + `<main>` `py-5`, so the card started ~85px+ down yet was sized to nearly full viewport height → its footer/poll/swipe cards were cut off below the fold ("spilling over"). Root `<main>` already scrolls with the window, so the trap was both wrong and redundant — removed it (root + SSR skeleton) so the screen flows naturally like every other page. The `match-selector.tsx` fixed-overlay path still bounds it via its own outer `max-h-[calc(100vh-2rem)] overflow-y-auto`, so removal is safe there. Also removed the erroneous `useScrollLock(isLoading)` from the dormant `MatchLoadingInterstitial` fallback — it locked **body** scroll for an inline route-loading component (not a modal; its only consumer is `loading.tsx`), which would trap overflow if that flag branch were ever active. Lint 0 / typecheck clean / `NODE_ENV=production` build ✓. |

| make verify gates 4–14 run locally (vΩ.15, 2026-07-15) | Gate 4 pattern: point `DATABASE_URL` at a fresh local Postgres (`postgresql://…@localhost:5432/sabiscore_verify`) — a real env var overrides `backend/.env` in pydantic-settings, and `database.py` normalizes bare `postgresql://` to `+psycopg`. Fresh-DB upgrade through all 3 migrations + `alembic check` no drift on Postgres 18. Gate 14 needs the same override (imports `database.py` at module load). Gates 5–10, 13, 14 all pass. `backend/Dockerfile` gains `PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5` (both stages) after gate 11 died at ~26 min to a PyPI read-timeout on the default 15s — ⚠️ never judge a docker build via `\| tail`, the pipe masks the exit code. |

| Playwright stale-spec fix + offseason fallback contract (vΩ.15, 2026-07-15) | Gate 13 bare `pnpm exec playwright test` runs ALL of `tests/e2e/`, including `sabiscore.spec.ts` whose first two tests asserted the pre-vΩ.8 homepage ("Select a Match to Analyze", "Connection Error"/"Retry") — copy that no longer exists anywhere in `apps/web/src`; they could never pass. Rewritten backend-independent: hero CTA ("See today's value picks") visible on `/`, and `BackendStatusBanner` warming alert appears when `**/api/health` is mocked to `backendStatus:"unavailable"`. Also fixed a real contract gap the spec caught: `apps/web/src/app/api/offseason/[league]/route.ts` fallback paths returned `season_status:'UNKNOWN'` without `data_availability`/`prediction_advisory` — shared `unknownFallback()` now returns the full shape with all availability truthfully `false`. Playwright 22/22 (chromium + mobile-chrome). |

| Explainer zero-fab fix + SHAP/catboost dependency matrix (vΩ.15, 2026-07-15) | `models/explainer.py` `_mock_explanation()` fabricated hardcoded SHAP importances (`home_attack_strength: 0.15`…) reachable from the LIVE path: `services/prediction.py _generate_explanations` → `ensemble.explain_predictions` → mock when SHAP missing OR TreeExplainer init fails — and the truthy mock shadowed the honest deterministic-ranking fallback below it. Now returns `{}` (fail-closed); callers all fall through correctly. Regression guard `test_explainer_fallback_is_empty_not_fabricated` in `test_zero_fabrication_contract.py`. Suite 946 passed. **Dependency matrix fact**: `requirements.txt` pins `catboost==1.2.2`/`shap==0.44.1` with `python_version < "3.14"` markers — the local venv is Python 3.14.6 (no wheels exist), so "SHAP not available"/"No module named catboost" warnings are the DESIGNED local degradation, not a defect. Production gets both: Docker `python:3.11-slim` + Render `PYTHON_VERSION: 3.11.9`. Do not "fix" by pip-installing on 3.14. |

| PWA manifest zero-fab + SEO surfaces (vΩ.16, 2026-07-16) | `apps/web/public/manifest.json` fabricated "Sub-150ms football predictions with +18% ROI" (promotional ROI claim — escaped the CI copy scan, which covers `apps/web/src/` only) and referenced non-existent `/logo-192.png`/`/logo-512.png` (PWA install would 404); description now matches the layout metadata, icons limited to the real `favicon.ico` + `icon.svg`, theme/background aligned to `#07110f`. Manifest wired into `layout.tsx` `metadata.manifest` (was unreferenced) plus `openGraph`/`twitter` blocks with the same quiet-analytical copy. New `app/robots.ts` (disallow `/admin/`, `/api/`, `/monitoring/`; sitemap pointer) and `app/sitemap.ts` (5 public routes) — both emit as static routes in the build. Dead `/dev/train-tfjs` tombstone route deleted (unreferenced; production behavior unchanged — it already `notFound()`ed). Lint 0 / typecheck clean / tests 16/16 / `NODE_ENV=production` build ✓. |

| Full-analysis contract hardened (vΩ.18, 2026-07-24) | **Prediction semantics**: `prediction_status` tristate (AVAILABLE / REDUCED_EVIDENCE_BASELINE / UNAVAILABLE); `prediction_source` (CERTIFIED_MODEL / DIAGNOSTIC_BASELINE / NONE); `is_reduced_evidence_baseline`; `stake_permitted` backend-owned boolean. **Evidence split**: `evidence_quality` carries `critical_gaps` (force PARTIAL/zero-stake), `advisory_gaps` (reduce confidence only, never block), `conflicts` (force PARTIAL). Advisory gaps NEVER force PARTIAL — only critical gaps and conflicts do. **Endpoint** (`full_analysis.py`): `_default_live_vector()` marks `is_synthetic: True`; unknown league → `effective_kelly_cap=0.0` + `LEAGUE_POLICY_UNAVAILABLE` gap (no global cap fallback). **Synthesizer**: `normalize_evidence_quality()` auto-classifies gaps; UCL HIGH_CONVICTION → ACTIONABLE cap; `stake_permitted` zeroed when status != AVAILABLE OR critical_gaps OR conflicts OR verdict not in {ACTIONABLE, HIGH_CONVICTION} OR RL abstain OR cap=0. **Frontend Zod contract** (`full-analysis-contract.ts`): `classifyAnalysisError` maps HTTP 500 → `backend_internal_error` unconditionally (never cold_start); HTML body 5xx → cold_start (route handler only). `mapFullAnalysisPresentation` is the sole display-logic source; `displayedProbabilities` / `topOutcome` / `topOutcomeProbability` are null when unavailable. **Dashboard**: `VictorySparkle` only fires for `stakePermitted && verdict === "HIGH_CONVICTION"`. Probability orbs show "—" when unavailable. Label is "Top outcome probability" not "Model confidence". **InsightsErrorState**: `MAX_AUTO_RELOADS=0` — no infinite reload loop; `backend_internal_error` never auto-retries. **Route handler** (`/api/full-analysis/[matchId]/route.ts`): 25 s timeout, `maxDuration=30`; cold_start only emitted for HTML response on 5xx. **Schema**: `backend/src/schemas/full_analysis.py` — `FullMatchAnalysisResponseSchema` with `validate_availability_and_staking` model-validator enforcing all invariants. **Tests**: `test_full_analysis_contract.py` (127 tests), `full-analysis-contract.test.ts`, `api-full-analysis.test.ts`. All gates: lint 0 / typecheck 0 / Vitest 46/46 / `NODE_ENV=production` build ✓ / ruff 0 / pytest 962/962. (2026-07-24) |

| Production readiness and public model truth (vΩ.17, 2026-07-20) | `/api/health` now treats backend `ok`/`ready`/`healthy` as healthy and emits no contradictory issue. The global `ReadinessRing` aggregates the four authoritative backend checks (database, migrations, cache, models), not the unpopulated source-registry timestamps; source freshness stays in match/evidence contexts. Homepage, Docs, match selector, monitoring, and performance UI now withhold unsupported live accuracy/edge/walk-forward claims, label Phase 7 numbers as artifact benchmarks, show live metrics as `Pending` until labelled outcomes exist, and keep Phase 8 candidate/shadow-only. Active web source has zero prohibited certainty tokens and zero one-eighth-Kelly tokens, enforced by Vitest. Rollback keeps `PROVIDER_FAIL_CLOSED=true` and isolates providers individually. Verification: lint/typecheck green, Vitest 30/30, Next.js 15.5.19 production build green, Playwright desktop/mobile 4/4, focused backend provider/source tests 75/75. Live 2026-07-20: Render `status:ok`, all four readiness checks ready; provider health remains offline-safe; off-season is `total:0`, `offseason:true`, next start `2026-08-08`. Full `make verify` remains blocked until the chat-disclosed PostgreSQL password is rotated; current Windows `make verify-core` also requires `jq`/POSIX recipe support. |

| Vercel keepalive cron (vΩ.19, downgraded vΩ.20) | `vercel.json` crons: `/api/cron/ping-backend` at `0 9 * * *` (daily). ⚠️ The original `*/10 * * * *` **blocked all production deploys** — Vercel Hobby rejects sub-daily crons at deploy time. The sub-15-min warm-up is meant to run from the pre-existing `.github/workflows/keep_alive.yml` (every 14 min → `scripts/keep_alive.py` → `BACKEND_URL/health/ready`), NOT a new workflow — see the billing-lock blocker below. `BACKEND_URL` in Vercel dashboard still needed for the daily Vercel cron route (distinct from `SABISCORE_BACKEND_URL` used by proxies). |

| ⚠️ GitHub Actions billing lock — CI + keepalive DARK (vΩ.20, 2026-07-24) | Every Actions run (`CI - Canonical Platform`, `Secret Scan`, `Block large files`, `Keep-alive ping`) fails to start: annotation *"The job was not started because your account is locked due to a billing issue"* — runner never boots (`runner_name:""`, 0 steps, ~6 s fail). This means **no CI gate has actually executed on recent pushes**, and the `keep_alive.yml` warm-up does not run. Verify green CI only after the billing lock clears; until then, `make verify` locally is the sole gate. Fallback keepalive: external free pinger (cron-job.org / UptimeRobot) → `https://sabiscore-api-bav1.onrender.com/health/ready`. |

| Production cutover verified + legacy Vercel projects deleted (vΩ.20, 2026-07-24) | Deploy `web-7zrnnpsbk` → alias `https://web-lac-theta-42.vercel.app` is LIVE; `/api/health` returns `"sha":"fd4949e"` (deploy-parity stamp confirmed working in production), `backendStatus: ok`, all 4 readiness checks ready. Legacy Vercel projects `sabiscore` (the pre-vΩ.8 `sabiscore-d37gxx4gs` UI) and `sabiscore-web` permanently deleted via `vercel project rm` — `web` is the only project. Stale-deployment class of bug closed. Note: live provider health shows `api_football`/`sportmonks`/`the_odds_api` still `enabled:false` — Render blueprint sync of the vΩ.12 ENABLE flags awaits operator approval in the Render dashboard. |

| CORS regex wired + production origins (vΩ.20, 2026-07-24) | `middleware.py` `setup_middleware` now passes `allow_origin_regex=settings.cors_origin_regex or None` to `CORSMiddleware` — the `CORS_ORIGIN_REGEX` env var was wired to Settings but never used, so Vercel preview URLs silently failed CORS. `render.yaml` `CORS_ORIGINS` gains `https://sabiscore.com` + `https://web-lac-theta-42.vercel.app` (both were absent). Currently non-blocking (browser-side `ultra-api-client.ts` consumer is unmounted) but required before any client-side direct-to-backend fetch is activated. |

| Insights error card: manual-retry only (vΩ.20, 2026-07-24) | `insights-error-state.tsx` — countdown/sessionStorage auto-reload machinery deleted. `MAX_AUTO_RELOADS=0` (vΩ.18) made it permanently dead, yet it flashed "Auto-retrying in 30s" one frame then pinned "Auto-retry paused" — contradictory copy for a retry that never existed. Card is now static: label/heading/body + manual "Retry now" + "Pick another matchup". `retryStorageKey`/`readAttempts`/`bumpAttempts`/`isRetryableInfrastructureError` import all removed (no other consumers, verified via grep). |

| Loading screen width + dead completion effect (vΩ.20, 2026-07-24) | `match-loading-experience.tsx` — container `max-w-lg` → `w-full max-w-lg sm:max-w-xl lg:max-w-2xl` (main + SSR skeleton) so the interstitial doesn't render as a 512px strip that snaps to the `max-w-6xl` results page. `onExperienceComplete` prop + `completionRef` + the `progress >= 95` completion effect deleted: unreachable after the vΩ.19 90%-cap retune, and no consumer (loading.tsx, match-selector.tsx) ever passed the callback. `match-selector.tsx` footer "Updated Every 5min" → "Fetched fresh per request" (vΩ.9 copy contract). |

| Deploy-parity stamp (vΩ.19, 2026-07-24) | `apps/web/src/app/api/health/route.ts` gains `sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? "local"` in the JSON response. `apps/web/src/app/layout.tsx` gains a muted `<footer>` rendering `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0,7)` — only visible on Vercel deployments (env var absent locally). Stale deployment snapshots are now detectable in one `/api/health` probe. |

| Caveat humanization (vΩ.19, 2026-07-24) | `backend/src/api/endpoints/full_analysis.py` — `important_gaps[:3]` are now transformed via `.replace("_", " ").title()` before joining into the caveat string; when more than 3 gaps exist, `" and N more"` is appended. Caveats now read "66 live data gap(s): Away Attack Vs Home Defense, Away Draws Last5 Away, Away Form Last5 Away and 63 more" instead of raw snake_case. `toLabel()` in the frontend `DataGapBanner` path is unaffected. Backend suite 962/962 green. |

| Progress meter retune (vΩ.19, 2026-07-24) | `apps/web/src/components/loading/match-loading-experience.tsx` — replaced fixed-increment ticker (200 ms interval, hit 95% in ~6.4 s) with a time-budget-aware cubic ease-out: `Math.floor(90 * (1 - Math.pow(1 - t, 3)))` over `t = elapsed / 28_000`. At 7 s → ~52%; at 14 s → ~79%; at 28 s → 90%. Progress bar is now an honest visual of the 28 s client budget. `useReducedMotion` gating, 15 s cold-start hint, and `TeamEvidenceCard` skeletons untouched. |
| ⭐ Full-analysis contract null-parse fix (vΩ.21, 2026-07-24) | **Root cause of "The backend returned an invalid full-analysis contract" on `/match/[id]`.** `apps/web/src/lib/full-analysis-contract.ts` typed `phase9_shadow_only: z.boolean().optional()` — `.optional()` accepts `undefined` but rejects `null`. The backend Pydantic schema (`backend/src/schemas/full_analysis.py:172`) declares `phase9_shadow_only: Optional[bool] = None` and returns **`null`** whenever phase9 is inactive (the production default per safe-defaults). So a well-formed off-season baseline (`REDUCED_EVIDENCE_BASELINE`, `stake_permitted:false`, valid gaps) failed the whole Zod parse → the generic contract-error card. Fixed to `z.boolean().nullable().optional()`, mirroring the sibling `phase9_candidate_features` which was already `.nullable().optional()`. **This was a HEAD bug affecting EVERY analysis while phase9 is off, not just off-season.** Diagnosed live: preview `web-g17zhf2p5` was at HEAD `25bafbe` (NOT stale), backend returned HTTP 200 valid JSON, and running the real schema against the captured live response isolated the single failing path `[phase9_shadow_only] invalid_type: Expected boolean, received null`. Regression guard added in `full-analysis-contract.test.ts` ("accepts null phase9 fields from an inactive-phase9 baseline response") — the pre-existing 11 tests passed only because the fixture omitted the field (→ `undefined`), never sending `null`. Web vitest 46→47, typecheck/lint clean. |
| CI copy-scan self-match fix (vΩ.21, 2026-07-24) | `.github/workflows/ci.yml` "Responsible gambling copy scan" grep now passes `--exclude="*.test.ts/tsx" --exclude="*.spec.ts/tsx"`. It previously flagged `apps/web/src/lib/copy-contract.test.ts:8`, which holds the prohibited terms as a regex literal — the Vitest `copy-contract.test.ts` already excludes test files (its own line 15-16), but the bash grep did not, so the two enforcement mechanisms disagreed. This is a **latent CI failure** that would have fired the `web-quality` job the moment the GitHub Actions billing lock clears. Verified 0 hits with the exclusion. |
| CORS regex staleness — MOOT for production, deferred (vΩ.21, 2026-07-24) | `render.yaml` `CORS_ORIGIN_REGEX` still matches the deleted `sabiscore*` project prefix, not the current sole `web*` project. **Not changed this session** and non-blocking: all browser→backend traffic is same-origin (proxied via Next.js `/api/*`); no direct-to-backend fetch is mounted (`ultra-api-client.ts` consumer unmounted per vΩ.20). Live OPTIONS preflight for `web-lac-theta-42` (a *listed* origin) also returns no `access-control-allow-origin`, so the behavior is murkier than a simple regex-prefix gap. Fix the regex to `https://web(-[a-z0-9-]+)?\.vercel\.app` **only** when a browser-side direct-to-backend fetch is actually activated — until then it is dead configuration, not an incident. |
| Insights timestamp coherence (vΩ.22, 2026-07-25) | `apps/web/src/components/insights-display.tsx` — the Phase-7 `InsightsDisplay` panel (renders ABOVE `FullAnalysisSection` on `/match/[id]`) formatted its two "Generated" timestamps with bare browser-local `new Date(...).toLocaleString()` (no TZ label, no semantic markup) while the canonical `full-analysis-dashboard.tsx` footer uses `<time dateTime=…>` + Africa/Lagos WAT. Both sites now reuse the already-exported `formatLagosTimestamp()` (from `full-analysis-contract.ts`) and render `<time dateTime={…}>… WAT</time>`. One live cross-surface drift closed; no new helper/dependency. Lint 0 / typecheck 0 / Vitest 47/47 / copy scan 0 / `NODE_ENV=production` build ✓. |
| ⚠️ Phase-7 insights `confidence` is NOT max(probs) — do NOT relabel (vΩ.22, 2026-07-25) | The CODEX finalization directive hypothesised the Phase-7 "Confidence" stat (`insights-display.tsx:291`) mislabels max-class-probability. **False.** `backend/src/insights/engine.py` `_forecast_match_outcome()` sets `confidence` to the model's own confidence scalar (model path, line ~552) or a `0.50` baseline sentinel (`is_baseline: True`, line ~582) — never `max(probs)`. Relabelling "Confidence" → "Top probability" here would introduce a NEW mislabelling; **left unchanged.** The 33.4% "confidence" in the referenced screenshots came from the full-analysis fallback `confidence=max(h,d,a)` (`full_analysis.py:147`), which vΩ.18 already relabelled "Top outcome probability". ⚠️ **CORRECTED in vΩ.23:** this entry also claimed "Off-season, `getMatchInsights` returns HTTP 422 (zero-fab guard)". That was **false at the time** — the endpoint returned HTTP 200 with fabricated probabilities and a 35% Kelly stake. It became true only after the vΩ.23 fail-closed fix below. `MAX_KELLY=0.025` does not exist in `apps/web`; the RL gauge scales to `0.05` (`rl_max_kelly_cap`, distinct from league value-bet caps) and the canonical Kelly gauge reads backend `effectiveKellyCap`. |
| ⭐ Phase-7 insights fail closed (vΩ.23, 2026-07-27) | **`POST /api/v1/insights` was returning HTTP 200 with a fabricated betting recommendation on zero evidence.** Live probe of `Brighton vs Everton`: `home_win_prob 0.852`, `away_win_prob 0.0`, `market_odds 2.0`, `expected_value 0.704`, `kelly_stake 35.21` (35% of bankroll vs the 4% `LeaguePolicy` cap), `"Consider betting"`. Root cause: `FeatureTransformer._validate_required_evidence` **does** raise `DataUnavailableError`, but `insights/engine.py` swallowed it with broad `except Exception` at three sites (`_prepare_features` inner + outer, and the top-level handler) and substituted a full `FEATURE_DEFAULTS` vector — inverting fail-closed into fail-open. All three now re-raise `DataUnavailableError` first; `legacy_endpoints.py` maps it to **HTTP 422 `INSUFFICIENT_EVIDENCE`** (mirrors `predictions.py:132`). Also: Kelly is now a *fraction* (`bankroll=1.0`, Quarter-Kelly, capped by `get_league_policy(league).kelly_cap`) — it was `bankroll=100.0, kelly_fraction=0.5` uncapped, and `insights-display.tsx:525` renders `kelly_stake * 100`, so `35.21` would have displayed as **3521.5%**; `ValueBet.kelly_stake` gained `le=0.05`. Hardcoded odds books removed from `aggregator.py` (3 sites) and `_create_mock_match_data` — both now `{}`, and `_calculate_value_bets` already skipped value analysis on an empty market. `predictions.is_baseline` is now carried through to the response. Zero-fab scan widened to `src/insights` + `src/data` (previously unscanned — the reason this survived). Backend 966 passed / ruff 0. |
| ⭐ `/match/[id]` "We hit a snag" — relative fetch in a server component (vΩ.23, 2026-07-27) | **The Phase-7 insights panel had NEVER rendered in production.** `getMatchInsights()` fetched the **relative** path `/api/insights` from a Node server component (`app/match/[id]/page.tsx`, `runtime="nodejs"`). Undici cannot parse relative URLs → instant `TypeError: Failed to parse URL from /api/insights`. That message does not contain `"fetch"`, so it escaped the `TypeError` guard at `api.ts:408`, survived `fetchWithRetry`, and surfaced as `APIError(msg, 0, "NETWORK_ERROR")`. `page.tsx:96` then passed only `{status, code}` to `classifyAnalysisError`, which keyed network detection off the `networkError` **boolean** — so it fell through to `"unknown"` → "UNEXPECTED ERROR / We hit a snag". Proven live: production RSC payload ended `{"errorType":"unknown","matchup":"Brighton vs Everton"}` delivered in **1.8 s**, far too fast for the 25 s proxy budget; `POST /api/insights` on the same deployment returned 200. **Fix:** function moved to server-only `apps/web/src/lib/insights-server.ts` calling the backend directly via `resolveBackendBaseUrl()` — no self-proxy hop, and `SABISCORE_BACKEND_URL` stays out of the client bundle (`lib/api.ts` is client-bundled via `apiClient`). It now preserves the backend `error_code` instead of overwriting it with the display category, which had made `page.tsx`'s `INVALID_MATCHUP` → `notFound()` branch dead code. ⚠️ **Never fetch a relative URL from a server component** — there is no origin to resolve against. |
| `insufficient_evidence` error category (vΩ.23, 2026-07-27) | `full-analysis-contract.ts` `AnalysisErrorCategory` gains `insufficient_evidence`, returned for HTTP 422. After the fail-closed fix this is the **normal** off-season response, so it must not render alarming copy: `insights-error-state.tsx` gives it an amber variant ("Insufficient Verified Evidence" / "Not enough verified data to model this match") with **no retry button** — retrying cannot produce evidence — and it is excluded from `isRetryableInfrastructureError`. `classifyAnalysisError` now also recognizes a network failure from `code === "network_error"`, not only the `networkError` boolean. |
| `_safe_float()` NaN fix (vΩ.23, 2026-07-27) | `backend/src/data/transformers.py` `_safe_float()` returned `float('nan')` for a NaN input. Callers test `is not None` to decide whether evidence is present, so a NaN source short-circuited their fallback chain **and** slipped past the fail-closed raise, surfacing later as a confusing "Required feature values unavailable" from `_handle_missing_values` instead of naming the real missing source. Now returns `None` for NaN/inf — one guard in the shared helper fixes every caller. |
| ⭐⭐ TWO league vocabularies — normalize at every boundary (vΩ.26, 2026-07-27) | **Every non-EPL match page returned HTTP 400** (`/match/Athletic Club vs Atletico Madrid?league=La Liga` → "A valid matchId and league are required"). `apps/web` carries **two** league vocabularies and both are load-bearing: the **display form** (`"La Liga"`, `"Serie A"`, `"Ligue 1"`) keys `team-data.ts`, `logo-resolver.ts`, and `league-colors.ts`; the **canonical form** (`LA_LIGA`, `SERIE_A`, `LIGUE_1`) is what the sidebar, the proxy Zod enums, and `betting-intelligence-api.ts` speak. `match-selector.tsx` used display-form `LEAGUES` ids and pushed `?league=La Liga`, which the full-analysis proxy's `z.enum` rejected before the backend was ever contacted. ⚠️ **EPL is the one league both vocabularies spell identically — it masked this defect through every prior session's testing.** The backend was never at fault (`canonical_league_id` already accepts either form). **Fix:** `apps/web/src/lib/league.ts` `canonicalLeagueId()` mirrors `backend/src/core/league_policy.py` rule-for-rule (lowercase → fold separators to `_` → alias lookup → else upper-case), returns `null` outside the closed 7-competition set. Applied at the **proxy boundary** (`full-analysis`, `insights`, `phase8-features` — this is what rescues links already in the wild and backend-supplied league values from `/team/[slug]` + `upcoming-matches-panel`) **and** at the source (`match-selector.tsx` push, `app/match/[id]/page.tsx` searchParams). ⚠️ **When adding any league-parameterized route or link, normalize — never compare raw strings, and never test only with EPL.** Pinned by `lib/league.test.ts`. Live-verified 400 → 200 with `effective_kelly_cap: 0.04` (correct calibrated policy, not the `0.0` LEAGUE_POLICY_UNAVAILABLE fallback). |
| ⭐ Loading interstitial must match the results container (vΩ.25, 2026-07-27) | **Third regression of the same class** (vΩ.14 max-h trap, vΩ.20 narrow strip, vΩ.25 width mismatch). `match-loading-experience.tsx` was `max-w-lg sm:max-w-xl lg:max-w-2xl` (672 px) while `app/match/[id]/page.tsx` renders results in `max-w-6xl` (1152 px) — the screen snapped ~480 px wider the instant analysis landed. Container is now `max-w-6xl`, and because one column stretched across that width looks wrong, the content splits into `lg:grid-cols-5` (match card + progress = `lg:col-span-3`; poll/swipe/fun-fact = `lg:col-span-2`), collapsing to a single column below `lg`. **Three things must stay in sync or the screen shifts:** (1) the live component container, (2) `MatchLoadingExperienceSkeleton` (SSR — a different container shifts everything at hydration), (3) the `match-selector.tsx` overlay wrapper, which previously clamped the same component to `max-w-xl` and would collapse the grid in its second usage site. Pinned by `match-loading-experience.test.tsx`. |
| ⭐ Match-page retry is `router.refresh()`, never a document reload (vΩ.25, 2026-07-27) | `insights-error-state.tsx` "Retry now" called `window.location.reload()`. Because `page.tsx` mounts `FullAnalysisSection` and `Phase8AnalyticsSection` as independent siblings that load fine even when the Phase-7 insights fetch fails, a full reload **discarded working analysis**, restarted the loading interstitial from 0%, and re-downloaded the bundle to retry one fetch. Now `startRefresh(() => router.refresh())` via `useTransition`: only this page's server components re-run, siblings stay mounted, and `isPending` drives the button state (no manual `useState`). Pinned by `insights-error-state.test.tsx`, which also guards that `insufficient_evidence` offers no retry and that no auto-retry countdown returns. |
| `MatchDashboard.tsx` deleted — dead superseded surface (vΩ.25, 2026-07-27) | 369 lines, zero importers; the only mention was a stale comment in `ProbabilityDonutChart` (corrected). It rendered the superseded `CertifiedMatchAnalysis` contract that `full-analysis-dashboard.tsx` replaced in vΩ.18, and was the last recharts consumer outside the two real chart components. ⚠️ `analyzeCertifiedPrediction` + the `Certified*` interfaces in `lib/api.ts` are now **unused but deliberately retained** — they wrap the live `/api/v1/predictions/analyze` backend endpoint, so deleting them is a separate decision about whether that endpoint is deprecated. Decide that before removing. |
| `/match` bundle 214 kB → 207 kB (vΩ.25, 2026-07-27) | `match-selector.tsx` statically imported `MatchLoadingExperience` (framer-motion drag/gesture machinery) although it only renders after a matchup is submitted. Now `next/dynamic` with `ssr: false` — same pattern as the vΩ.24 chart split. Route-order by weight is now `/match` 207 → `/match/[id]` 158 → `/monitoring` 145 → `/intelligence` 142 → `/performance` 127, over a 103 kB shared baseline. |
| ⭐ Neutral defaults were rendered as measurements (vΩ.24, 2026-07-27) | **Same fabrication class as vΩ.23, on the display surface.** Live payload for an off-season fixture returns `elo_context = {home_elo: 1500, away_elo: 1500, elo_difference: 0, elo_momentum_cross: 0}` alongside `is_reduced_evidence_baseline: true`, `probabilities_available: false` and 71 data gaps — `_elo_from_features` (`full_analysis.py:245`) fills absent ratings with `.get("home_elo", 1500.0)`. `full-analysis-dashboard.tsx` rendered those verbatim in `EloContextCard` **and** the quick-stat strip, directly beside a "REQUIRED MODEL INPUTS UNAVAILABLE" critical gap. Both now render `—` when `presentation.isReducedEvidenceBaseline`. **The predicate is contract-guaranteed**, not a heuristic: the Zod schema enforces `is_reduced_evidence_baseline === (prediction_status === "REDUCED_EVIDENCE_BASELINE")` (`full-analysis-contract.ts:199-208`). Likewise `UncertaintyCard` showed `CI [0.0%, 0.2%]` from a live `credible_interval: [0, 0.00196]` — an interval around a prediction that was never produced — now `—` when `!predictionAvailable`. Epistemic/aleatoric stay visible; 100% epistemic is a meaningful evidence statement. ⚠️ **When adding any new stat tile to the match dashboard, check whether the backend has a neutral default for it** — `fmt()` will happily render a placeholder as data. Regression tests in `full-analysis-dashboard.test.tsx`. |
| "Fresh" vs "Unknown" freshness contradiction (vΩ.24, 2026-07-27) | `PredictionAgePill` rendered a bare "Fresh" describing how recently the **analysis** ran, immediately beside `FreshnessPill` showing "Unknown" for **evidence** freshness — two adjacent chips making opposite-sounding claims. Relabelled to "Analyzed just now" / "Analyzed {n}m ago" / "Analyzed {n}h ago — regenerate?". The two pills measure different things and the copy now says which. |
| `/performance` bundle 232 kB → 127 kB (vΩ.24, 2026-07-27) | `RollingAccuracyChart` statically imported recharts (~100 kB) into the `/performance` first-load bundle — the heaviest route in the app and a deferred item since vΩ.17. Now `next/dynamic` with `ssr: false` + skeleton fallback; recharts is client-only regardless (it measures its container), so nothing is lost. Route size 111 kB → 6.11 kB. Apply the same pattern to any future chart surface. |
| Providers pill no longer reports an unreachable "live" count (vΩ.23, 2026-07-27) | `platform-health-pills.tsx` showed `0/2 live · 5 configured`. `live` counts providers at `status === "VERIFIED"`, which `BaseProvider.health()` only reaches when `PROVIDER_LIVE_TESTS=true` — production deliberately keeps it `false` to avoid spending free-tier quota. The numerator was therefore structurally always `0`, `ready` was permanently false, and the pill rendered a permanent amber false-outage on every page. Now `N enabled · M configured`, `ready` on `enabled > 0`. (`enabled` counts the `ENABLE_*_PROVIDER` flags, default 2; `configured` counts credential presence, 5.) |
| Off-season notice surfaced before submission on the match selector (vΩ.27, 2026-07-28) | A user could type any hypothetical matchup during the close season and only discover it was off-season after submitting, via the full-analysis "4 critical gaps / No bet" teardown (`FIXTURE_IDENTITY_UNVERIFIED` — correct, untouched). `match-selector.tsx` now runs `useQuery(["match-selector-offseason", league], () => getOffseasonStatus(canonicalLeagueId(league) ?? league))` and renders the existing `LeagueOffseasonNotice` (previously used only in `upcoming-matches-panel.tsx`) above the Home/Away inputs when `season_status === "OFF_SEASON"` for the *currently selected* league. **`getOffseasonStatus` had zero callers before this — `match-selector.tsx` is its first production consumer**, so the route was live-verified end-to-end first rather than trusted: EPL → `2026-08-08` (11d), LA_LIGA → `2026-08-15` (18d), UCL → `2026-09-15` (49d) — correct, distinct per-league dates, and both canonical (`LA_LIGA`) and display (`La Liga`) inputs resolve identically because the backend `_normalise_league` folds either. Canonical form is sent anyway, matching the `handleSubmit` precedent at line ~274. Chosen over piggybacking `getUpcomingMatches`: the season endpoint is edge-cached 1h (`s-maxage=3600`, so `staleTime` mirrors it at 1h) and does **zero prediction/value-bet work**, whereas `/api/upcoming` defaults `include_predictions=true` and would compute a prediction for one fixture just to read a boolean on every league switch once the season resumes. `getOffseasonStatus` never throws — it degrades to `season_status: "UNKNOWN"`, which renders nothing, as do loading and in-season. Fails toward silence, never a false off-season claim. Non-blocking; `handleSubmit`, the backend, and `LeagueOffseasonNotice` itself are untouched. ⚠️ **Known type drift — fixed in vΩ.28**, see below. |

| `make verify` gate 9 pins NODE_ENV (vΩ.27, 2026-07-28) | Gate 9 ran a bare `pnpm --filter @sabiscore/web build`, inheriting the caller's `NODE_ENV`. A shell exporting `NODE_ENV=development` therefore made the release gate fail on a clean tree at the `/404` prerender with the misleading `<Html> should not be imported outside of pages/_document` error — the footgun CLAUDE.md already documented but the Makefile never defended against. Now `NODE_ENV=production pnpm --filter @sabiscore/web build`. This matters more than usual while the GitHub Actions billing lock (vΩ.20) keeps CI dark and `make verify` is the only enforced gate. ⚠️ **Never judge a gate through `\| tail`** — the first run this session was piped to `tail -40` and reported exit 0 while gate 9 had actually failed; same pipe-masking trap recorded for the Docker gate in vΩ.15. Redirect to a file and check `$?`. |
| `OffseasonDataAvailability` interface fixed (vΩ.28, 2026-07-28) | `lib/api.ts` interface and both its fallback literals, plus `route.ts`'s `unknownFallback()`, previously used 5 fields (`historical_results/elo_ratings/market_odds/form_stats/team_metadata`) with zero overlap with the real backend response. Live-verified this session (`curl .../api/offseason/EPL`) against `backend/src/api/endpoints/offseason.py`'s `_data_availability()`: the real 8 fields are `historical_data/live_odds/live_standings/live_form/pi_ratings/berrar_ratings/market_drift/match_context`. All 3 sites renamed; both fallback literals also changed from an inconsistent mix (one defaulted most flags `true`, the other all `false`) to uniformly `false`, matching the route's own documented "fail toward silence" convention. Zero runtime behavior change — confirmed no caller anywhere in `apps/web/src` destructures `data_availability` today. Regression test: `lib/api-offseason.test.ts` (2 tests, mocks both the non-ok and network-error fetch paths and pins the real field list). |
| Beginner-friendly jargon explainers on the match page (vΩ.28, 2026-07-28) | `full-analysis-dashboard.tsx`'s `RLCard`, `OddsEdgeCard`, and `UncertaintyCard` showed "Kelly", "Edge", "Epistemic", "Aleatoric", "CI", and "BNN Uncertainty" completely bare — no tooltip, no `title`, nothing — despite `KellyTooltip`/`EdgeTooltip` already existing and already wired into the sibling `ValueBetCard.tsx`, and despite `uncertainty-display.tsx` (a different widget on the same `/match/[id]` route) already explaining Epistemic/Aleatoric/CI with near-identical copy. A reader could see "Epistemic" explained once and bare once on the same page load. Fixed by importing the existing `Tooltip`/`KellyTooltip`/`EdgeTooltip` from `ResponsibleGamblingTooltip.tsx` into `full-analysis-dashboard.tsx` (not previously imported there) and wiring them onto all 6 bare spots; the 3 uncertainty tooltips reuse `uncertainty-display.tsx`'s exact existing copy verbatim rather than inventing new wording. "BNN" had no expansion anywhere in the codebase — one new line was written and checked against the prohibited-copy list. Verdict tiers were audited and found **already** explained via `VERDICT_COPY`/`VERDICT_META` (a one-line rationale under every badge) — left untouched, no gap there. Both `RLCard` and `OddsEdgeCard` gained `export` (previously module-private) so they could be unit-tested the same way `EloContextCard`/`UncertaintyCard` already are; new assertions added to `full-analysis-dashboard.test.tsx` covering an abstain/PARTIAL-like state and a stake-permitted/HIGH_CONVICTION-like state. ⚠️ **Fixed a real bug caught by the test run, not just added tests**: wrapping `Tooltip` (which renders a `<div>`) inside a `<p>` for the BNN header and the RLCard Kelly-cap line triggered a live React `validateDOMNesting` warning (`<div> cannot appear as a descendant of <p>`) — both changed to `<div>` wrappers; re-ran and the warning is gone. `OddsEdgeCard`'s equivalent `<span>` wrappers were left as-is (pre-existing pattern already used successfully elsewhere, e.g. `ValueBetCard.tsx`, and `<span>` does not trigger React's auto-close warning the way `<p>` does). |
| Shared `Tooltip` hardened for keyboard/focus access (vΩ.28, 2026-07-28) | `components/ui/ResponsibleGamblingTooltip.tsx`'s `Tooltip` only opened on `onMouseEnter`/`onMouseLeave` — failed WCAG 2.2 SC 1.4.13 (content on hover must also be reachable by focus). Fixed at the shared component (not per call site): added `onFocus`/`onBlur` alongside the existing mouse handlers, `tabIndex={0}` + `role="button"` on the trigger, `role="tooltip"` + `aria-describedby` on the popup. Fixes every existing caller (`KellyTooltip`/`EdgeTooltip` in `ValueBetCard.tsx`, `insights-display.tsx`, `best-bet-spotlight.tsx`) as well as the new vΩ.28 callers, in one ~10-line diff. |
| Real-data provider activation — still fully operator-blocked (vΩ.28, 2026-07-28) | Live-reconfirmed via both Vercel `/api/health` proxies this session: `espn`/`football_data_org` `enabled:true`, `api_football`/`sportmonks`/`the_odds_api` still `enabled:false` (`provider_disabled`) despite `render.yaml` declaring them `true` since vΩ.12 — the Render blueprint env sync approval remains outstanding in the dashboard. No code-level workaround exists or was attempted (per explicit session scope). The Upstash Redis credential flagged for rotation since vΩ.5 (purged from tracked files, still live in git history) could not be verified from this environment — must be confirmed rotated in the Upstash console. A local live-probe of the 2 already-enabled providers was available this session but explicitly skipped by operator decision (limited value at 2/5, avoids spending `football_data_org` quota before the other 3 unblock). |
| ⭐ Training-data figure was overstated ~6× (vΩ.28, 2026-07-28) | **Zero-fabrication violation on the most prominent public surface.** The homepage `HERO_STATS` and `docs/page.tsx` both advertised "10.7k+ real historical matches". The authoritative record is each artifact's own `model_metadata.training_samples`, read directly from the committed `.pkl` files: EPL 380, La Liga 380, Serie A 380, Bundesliga 306, Ligue 1 306 → **1,752 total**. Those are exactly one full season per league (380 = 20 teams × 38 matchdays ÷ 2; 306 = 18 teams), which is consistent with the ~0.38–0.51 holdout accuracies already documented. `backend/data/processed/*_training.csv` hold 500 rows each (2,500 raw) — after feature engineering and incomplete-row drops, 1,752 were usable. Both surfaces now state 1,752. ⚠️ **Re-derive this number from `model_metadata.training_samples`, never copy it forward** — the inline comment at `HERO_STATS` records the source of truth. |
| Unverifiable refresh-cadence claims removed (vΩ.28, 2026-07-28) | Two surfaces promised refresh rates that do not exist in code. `best-bet-spotlight.tsx` said "Predictions refresh every 3 hours" — no 3-hour job exists in the Celery beat schedule (which has 3min/5min/hourly/daily entries) and the component's own `staleTime` is 5 minutes; now "Predictions appear here once fixtures are analyzed." `docs/page.tsx` said "Live enrichment every 180 s" — no such interval exists anywhere in `apps/web`; now "Evidence is fetched fresh per request", the same correction vΩ.9 applied to the match page. The unsourced comparative "(industry avg ~0.23)" was dropped from the Model Precision Gate caption; the `<=0.21` gate is real (matches `/api/health` `rpsGate`) and retained. `TRUST_BADGES` were audited and are substantiated: feature_count 86 confirmed from the artifact metadata, 7 competitions is the closed set. |
| RL reward decomposition rendered neutral defaults as data (vΩ.28, 2026-07-28) | **Third instance of the vΩ.24 defect class.** Live off-season payload returns `reward_components: {R_pnl: 0, R_ic: 0, R_cal: 0, R_risk: 0, R_abs: 0.05}` with `abstain: true` / `stake_permitted: false`. `RLCard` rendered four `0.000` stat tiles directly beside "Abstained: insufficient verified evidence" — a reward breakdown for a stake that was never sized. Compounding it, `.slice(0, 4)` truncated away `R_abs: 0.05`, the **only non-zero term**, so the one informative value was the one hidden. Grid now gated on `!rec.abstain && stakePermitted`. Pinned by two tests in `full-analysis-dashboard.test.tsx` (hidden on abstain, shown when a stake was actually sized). ⚠️ The vΩ.24 warning stands and now has a third data point — **every new stat tile on this dashboard must be checked against what the backend emits when evidence is absent.** |
| ⚠️ Vercel production-alias status **corrected** (vΩ.28, 2026-07-28) | The vΩ.21 entry below describing the alias as "stuck" is now **stale** — live-verified this session: both `web-lac-theta-42.vercel.app/api/health` and `web-git-master-oversabis-projects.vercel.app/api/health` return `sha:"97f3b38"`, matching HEAD. **Currently in sync, no promotion needed.** The alias still does **not auto-promote** (the underlying mechanism vΩ.21 describes is unchanged and will drift again on a future push without a manual promotion) — re-check `sha` parity after every push per the vΩ.21 procedure below; don't assume today's sync state persists. `sabiscore.com` re-confirmed still unresolved (DNS lookup failure) — unchanged, still deferred to Vercel dashboard + registrar operator action. |

## Confirmed incomplete / next gates

| Gap | Files | Action |
|---|---|---|
| Vercel env var | Vercel dashboard (not code) | ✅ VERIFIED 2026-07-24: live `/api/health` on `web-lac-theta-42.vercel.app` returns `backendStatus: ok` with full readiness checks — `SABISCORE_BACKEND_URL` targets bav1 correctly. `BACKEND_URL` (daily Vercel cron route) still worth confirming, though the GitHub Actions keepalive (vΩ.20) no longer depends on it. |
| ⚠️ Production alias does NOT auto-promote (vΩ.21, re-verified vΩ.29 on 2026-07-28) | Vercel dashboard (not code) | **Confirmed operator action — mechanism unchanged, currently in sync at `sha:f33b5ab`.** Vercel builds every master commit, but the production alias may remain pinned. Compare branch and production `/api/health` SHAs after every push and promote the latest READY deployment when they differ. `sabiscore.com` is now attached to `web`; Vercel requires the registrar apex `A` record `76.76.21.21`. DNS verification and HTTPS are pending. |
| Render provider ENABLE flags | Render dashboard (not code) | Live provider health 2026-07-28 shows `api_football`/`sportmonks`/`the_odds_api` `enabled:false` despite `render.yaml` declaring `ENABLE_*=true`; Blueprint env sync awaits operator approval. The three provider secrets are already reported configured and must never be copied into code or reports. |
| Walk-forward RPS — records-sourcing helper | `models/model_registry.py`, `services/analytics.py` | Blocking bug fixed + regression-tested (vΩ.29, see ground truth above). Remaining: no code joins `MatchPredictionLog` to actual final scores (ID-space decision, not mechanical); real match data needed anyway (season resumes 2026-08-08). |
| make verify (full 14-step) | `Makefile` | Re-verified 2026-07-28 as discrete Windows-safe gates. Ruff, 972-test backend suite, scraper tests/validation, web lint/typecheck/Vitest/build, Compose config, Gitleaks, prohibited-copy scan, and Playwright pass. Gate 4 passes against disposable local PostgreSQL at Alembic head `0003_team_reconciliation`, with no schema drift. Gates 11–12 remain BLOCK: each Docker image build exceeded 15 minutes under the current 3.825 GiB Docker VM; the backend tag remained an old 2026-07-15 image and no web verify image exists. Increase Docker Desktop to 6–8 GB and rerun without `SKIP_DOCKER_GATES`. |
| C-24 Vercel deployment | Vercel project | ✅ Linked to Vercel project `web`; `SABISCORE_BACKEND_URL` reaches the Render backend after warm-up. Custom-domain DNS remains pending. |

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
