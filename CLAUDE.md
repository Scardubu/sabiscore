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

## Confirmed incomplete / next gates

| Gap | Files | Action |
|---|---|---|
| Walk-forward RPS validation | `models/model_registry.py` | First-pass training complete; formal temporal cross-validation pending live match data from provider APIs |
| Provider adapters (fdo, sm) — live verification | `football_data_org.py`, `sportmonks.py` | Code operational; needs live API key response to verify upstream contract |
| make verify (full 14-step) | `Makefile` | Requires Postgres + Docker + all credentials active; run when Docker available |
| C-24 Vercel deployment | Vercel project | Requires Vercel project linked to repo; unknown status |

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
