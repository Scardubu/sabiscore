---
name: audit
description: >
  Run a full production readiness audit on a file, directory, route, service, or named
  target within the SabiScore monorepo. Routes to the correct dimension skills by surface:
  backend-systems-auditor for FastAPI/Fastify services, component-quality-gate for React
  components, security-hardening-auditor for auth and credential surfaces, betting-engine
  audit for verdict/Kelly logic, provider-gateway audit for httpx adapters, and
  nigerian-fintech-compliance-architect for TaxBridge financial code. Produces a structured
  Critical / Important / Improvement report with corrected code for every Critical finding.
  Triggers: /audit, "audit this", "review for production", "is this production-ready",
  "production audit", "check this code", "review this service", "audit the provider gateway",
  "audit the betting engine", "audit the evidence orchestrator", "review my component".
argument-hint: "[file path, directory, service name, or surface — defaults to current git diff]"
allowed-tools: Read, Grep, Glob, Bash(git diff --name-only HEAD:*), Bash(cat:*), Bash(find . -type f:*), Bash(wc -l:*)
user-invocable: true
---

## Audit Activation

**Target:** $ARGUMENTS

**Auto-detected scope:**
```
Files to audit:
!`if [ -n "$ARGUMENTS" ]; then
  find "$ARGUMENTS" -type f 2>/dev/null \
    | grep -E '\.(py|ts|tsx|js|jsx|md|yaml|toml)$' \
    | grep -v '__pycache__\|node_modules\|\.git\|\.venv' \
    | head -25
else
  git diff --name-only HEAD 2>/dev/null | head -15
fi`
```

---

## AUDIT PROTOCOL — Execute All Four Phases

---

### Phase 1 — Classify the Surface

Read every file in scope. Identify which audit dimensions apply:

| Dimension | Apply when | Primary skill |
|---|---|---|
| SabiScore Provider Gateway | `backend/src/providers/`, httpx adapters, circuit breaker, quota | `backend-systems-auditor` + `api-automation-architect` |
| SabiScore Betting Engine | `betting_intelligence.py`, `core_engine.py`, verdict logic, Kelly/EV/de-vig | `backend-domain-model-architect` + `backend-systems-auditor` |
| SabiScore Evidence Orchestration | `evidence_orchestrator.py`, evidence profiles, critical/advisory gap logic | `backend-domain-model-architect` + `api-automation-architect` |
| SabiScore Fixture Identity | Reconciliation code, canonical team/fixture mappings | `backend-domain-model-architect` |
| SabiScore Frontend | `apps/web`, `/intelligence`, evidence rail, decision card, proxy routes | `component-quality-gate` + `nextjs-performance-architect` |
| SabiScore ML / Model | Feature registry, prediction pipeline, calibration, model artifact loading | `backend-domain-model-architect` + `backend-systems-auditor` |
| SabiScore Scraper | `apps/scraper`, manifest validation, source policy | `backend-systems-auditor` + `security-hardening-auditor` |
| TaxBridge Financial | VAT/CIT/WHT computation, FIRS API calls, TIN/BVN validation | `nigerian-fintech-compliance-architect` |
| General FastAPI / Python | Any `backend/` service not SabiScore-specific | `backend-systems-auditor` |
| General Fastify / TS | TaxBridge/Hashablanca/SwarmX backend | `backend-systems-auditor` + `effect-ts-layer-architect` |
| React / Next.js Components | Any `.tsx` component, layout, hook | `component-quality-gate` |
| Auth / Secrets / Headers | `middleware`, auth routes, env files, CSP config | `security-hardening-auditor` |
| Observability | Any service with external calls, queues, or LLM usage | `opentelemetry-observability-architect` |
| TypeScript Config | `tsconfig.json`, ESLint flat config, path aliases | `typescript-config-surgeon` |
| Database | Alembic migrations, SQLAlchemy models, Prisma schema | `prisma-database-architect` (for Prisma) or direct review |
| Motion / Animation | Framer Motion, GSAP, CSS animation | `motion-performance-architect` + `motion-interaction-architect` |
| Credential Safety | Any `.env*`, provider key handling, API key variables | `security-hardening-auditor` |

---

### Phase 2 — Run Each Applicable Dimension

For each dimension identified in Phase 1, apply the full audit protocol below.

---

#### 2A — SABISCORE PROVIDER GATEWAY AUDIT

```
[ ] Single application-lifespan httpx.AsyncClient — not instantiated per-request
[ ] Circuit breaker distinguishes: network / rate-limit / auth / client / server / schema failures
[ ] Retry logic: no retries on 401/403/422; bounded retries on 429/5xx with Retry-After
[ ] Egress allowlist enforced — only approved provider hostnames
[ ] HTTPS-only in production (no HTTP fallback)
[ ] Provider response schema validated — fails closed on schema drift
[ ] Raw snapshots persisted (where policy permits) before parsing
[ ] Auth headers / API keys redacted from all logs and traces
[ ] Quota headers extracted and persisted (provider-specific header names)
[ ] Provider health semantics: disabled ≠ unconfigured ≠ configured ≠ healthy ≠ degraded ≠ rate-limited
[ ] ESPN has no API key variable — keyless only
[ ] Provider circuit state shared across workers (Redis-backed where multi-worker)
[ ] Graceful client shutdown registered as application lifespan event
[ ] Concurrency bounded per provider (not unlimited parallelism)
[ ] Acquisition timestamp distinct from provider's content timestamp
[ ] Correlation ID attached to every provider request
```

#### 2B — SABISCORE BETTING ENGINE AUDIT

```
[ ] evaluation_at is an explicit parameter — never datetime.now() inside pure verdict logic
[ ] All three 1X2 outcomes evaluated: HOME_ML, DRAW_ML, AWAY_ML
[ ] de-vig formula correct:
      raw_implied_i = 1/odds_i
      overround = sum(raw_implied)
      fair_market_i = raw_implied_i / overround
      edge_i = model_prob_i - fair_market_i
      ev_i = model_prob_i * odds_i - 1
      full_kelly_i = max(0, ev_i / (odds_i - 1))
      stake_i = min(full_kelly_i * KELLY_FRACTION, MAX_KELLY_CAP)
[ ] UCL fixtures cannot reach HIGH_CONVICTION (hard cap at ACTIONABLE)
[ ] SPECULATIVE verdicts return in watchlist[], not top_opportunities[]
[ ] Only critical_gaps force PARTIAL — advisory gaps never block valid analysis
[ ] Verdict order enforced: PARTIAL > NO_BET > HOLD > SPECULATIVE > ACTIONABLE > HIGH_CONVICTION
[ ] Positive model probability without positive EV → NO_BET (not ACTIONABLE)
[ ] Edge < 4.2pp → cannot be ACTIONABLE
[ ] Authoritative abstention overrides all stake and verdict calculations
[ ] PARTIAL/HOLD/NO_BET → stake="pass"
[ ] Ranking formula is identical during selection and synthesis (no dual-scoring bug)
[ ] All ranking factors are bounded, returned in audit, documented, tested
[ ] Provider predictions excluded from model inputs
[ ] breakeven_odds, target_ev_odds, edge_preserving_odds returned in audit block
[ ] No synthetic feature values injected into production inference
```

#### 2C — EVIDENCE ORCHESTRATION AUDIT

```
[ ] All six profiles implemented: DISCOVERY / PREMATCH_STANDARD / PREMATCH_ENRICHED / LINEUP_REFRESH / MARKET_REFRESH / FORECAST_ONLY
[ ] Provider selection by field-specific precedence (not round-robin or random)
[ ] Independent providers run concurrently within configured limits (asyncio.gather with semaphore)
[ ] Evidence persisted (raw + selected) before returning
[ ] critical_gaps and advisory_gaps are separate lists — never merged
[ ] Missing optional evidence does not force PARTIAL
[ ] Fixture identity unresolved → critical gap → fails closed
[ ] Missing market for FORECAST_ONLY → not an error (returns forecast without EV/stake)
[ ] Missing availability <24h before kickoff → critical under policy; otherwise advisory
[ ] Unconfirmed lineup within 90min → HOLD or PARTIAL per explicit policy, not silent default
[ ] team_metrics=DATA_GAP not set automatically when a validated stored prediction exists
[ ] No hardcoded evidence states — all states reflect actual stored provider evidence
[ ] Stale evidence carries freshness warning, not automatic critical gap
[ ] Evidence passport includes: selected source, age, trust tier, warning, retry action
```

#### 2D — SABISCORE FRONTEND AUDIT

```
[ ] Zero direct provider API calls from Next.js (all proxied via SABISCORE_BACKEND_URL)
[ ] No TensorFlow.js import anywhere in apps/web
[ ] No NEXT_PUBLIC_ prefixed provider key variables
[ ] Cache-Control: no-store on all evidence and decision API routes
[ ] All proxy params validated with Zod before forwarding
[ ] Backend errors normalized to consistent error envelope before client
[ ] Request timeout and AbortController applied to all backend proxy calls
[ ] CSP: no 'unsafe-eval' in production; 'unsafe-inline' minimized or hash-nonce'd
[ ] No hard-coded LAN development origins in production config
[ ] Remote image allowlist is explicit (no wildcard **)
[ ] '/intelligence' language: no "lock", "banker", "guaranteed", "sure bet", "free money"
[ ] Verdict UI terms: QUALIFIES AT CURRENT PRICE / WATCHLIST / WAIT FOR LINEUPS / PASS / FORECAST ONLY
[ ] Evidence rail: accessible labels (not color-only status indicators)
[ ] Decision card: all required fields present (verdict, execution eligibility, selected outcome, bookmaker, odds, model prob, fair market prob, edge, EV, stake, min price, next action)
[ ] Model-vs-market: accessible tabular equivalent alongside chart
[ ] No chart rendered when evidence is missing (graceful empty state)
[ ] Stable skeleton dimensions (no layout shift during refresh)
[ ] Reduced motion support implemented
[ ] Keyboard-operable source drawer
```

#### 2E — CREDENTIAL SAFETY AUDIT

```
[ ] Run: git log --all -p -- '*.env*' | grep -iE "(api_key|password|secret|token)" | head -20
[ ] Run: grep -rn "NEXT_PUBLIC_.*KEY\|NEXT_PUBLIC_.*TOKEN\|NEXT_PUBLIC_.*SECRET" apps/web/
[ ] Run: grep -rn "ESPN_API_KEY" . --include="*.py" --include="*.ts" --include="*.env*"
[ ] No real credentials in any committed file (must be empty placeholders)
[ ] DATABASE_URL, REDIS_URL, SECRET_KEY, DB_PASSWORD blank in all committed .env.example files
[ ] Gitleaks CI gate present (.github/workflows/secret-scan.yml or equivalent)
[ ] Pre-commit hook or Makefile target runs Gitleaks locally
[ ] Auth headers and API keys not present in structured logs or OTel spans
```

#### 2F — GENERAL BACKEND AUDIT (FastAPI / Python)

```
[ ] Alembic is the only schema management authority — no Base.metadata.create_all() at startup
[ ] SQLite fallback requires ALLOW_SQLITE_FALLBACK=true — not the default path
[ ] Database connection failure fails readiness probe (/health/ready returns 503)
[ ] Separate health endpoints: /health/live, /health/ready, /health
[ ] Readiness requires: database, migrations, required model artifacts, critical services
[ ] No startup call to Base.metadata.drop_all()
[ ] Pydantic v2 models for all request/response schemas (not dataclasses or dicts)
[ ] All async routes use async def with await (no sync I/O in event loop)
[ ] Background tasks or slow operations use FastAPI BackgroundTasks or Celery, not blocking calls
[ ] Graceful shutdown: lifespan context manager closes httpx clients, DB pools, Redis connections
[ ] Structured logging (structlog) with redaction of sensitive fields
[ ] OTel spans on all external calls (provider, DB, Redis)
[ ] /health endpoints do not expose filesystem paths, credentials, or provider details publicly
```

#### 2G — REACT / NEXT.JS COMPONENT AUDIT

```
[ ] 'use client' directive present on all components using hooks or browser APIs
[ ] No server-side-only imports in client components (no 'fs', 'path', etc.)
[ ] LazyMotion + domAnimations + m. prefix for Framer Motion (not heavy motion import)
[ ] No duplicate style props on JSX elements (last-write-wins is silent data loss)
[ ] All interactive <div>/<span> elements are <button> or have role + keyboard handler
[ ] Touch targets ≥ 24×24px (WCAG 2.5.5)
[ ] Missing aria-label on icon-only controls
[ ] :focus-visible used instead of :focus (prevents on-click outline)
[ ] Images have width, height, and priority prop where above-fold
[ ] No useEffect with missing or incorrect dependencies
[ ] Suspense boundaries around RSC data-fetching children (for PPR)
[ ] Key props present on all list renders
```

---

### Phase 3 — Prioritize Findings

| Priority | Tag | Disposition |
|---|---|---|
| P0 | Build-blocking / deployment-blocking | Fix before any other action |
| P1 | Security violation (credential exposure, XSS, SSRF, injection) | Fix in same patch, rotate credentials if exposed |
| P2 | Runtime bug / silent data loss / betting engine invariant violation | Fix in same patch |
| P3 | Production contract violation (SabiScore canonical shape, CLAUDE.md constraints) | Fix within sprint |
| P4 | Accessibility violation (WCAG 2.1 AA) | Fix within sprint |
| P5 | Performance / responsive design issue | Fix or document |
| P6 | Polish / improvement / observability gap | Fix when convenient |

---

### Phase 4 — Structured Report and Corrected Code

```
## Audit Report: [Target Name]
Generated: [timestamp]
Surface:   [FastAPI backend / Next.js frontend / Betting engine / Provider gateway / etc.]
Vertical:  [SabiScore / TaxBridge / SwarmX / all]

### 🔴 P0–P2: Critical (block deployment or fix immediately)
- [Finding] | [Location: file:line] | [Risk] | [Fix]

### 🟡 P3–P4: Important (fix within sprint)
- [Finding] | [Location: file:line] | [Risk] | [Fix]

### 🔵 P5–P6: Improvements (fix when convenient)
- [Finding] | [Location: file:line] | [Benefit] | [Fix]

### ✅ Passing (explicitly verified)
- [Criterion]: [Evidence of passing]

### Scores
| Dimension                    | Score |
|---|---|
| Credential Safety            | X/10  |
| Betting Engine Determinism   | X/10  |
| Provider Gateway Resilience  | X/10  |
| Evidence Criticality Model   | X/10  |
| Frontend/Backend Boundary    | X/10  |
| Observability                | X/10  |
| Test Coverage (estimated)    | X/10  |
| Accessibility (if applicable)| X/10  |
| Overall Production Readiness | X/10  |
```

**For every P0–P2 finding, produce the corrected implementation immediately** with:
- Inline comments marking every change with `# AUDIT FIX [P0|P1|P2]:` or `// AUDIT FIX`
- Brief explanation of why the original was wrong
- Verification step (what to run/check to confirm the fix works)

---

## Quick Reference: SabiScore Invariants (Never Violate)

```python
# INVARIANT: Alembic only — never call this at app startup
# Base.metadata.create_all()   ← FORBIDDEN in production

# INVARIANT: evaluation_at must come from endpoint layer
async def analyze(request: AnalyzeRequest) -> AnalysisResponse:
    evaluation_at = request.evaluation_at  # ← CORRECT
    # NOT: evaluation_at = datetime.now()  ← WRONG (non-deterministic)

# INVARIANT: UCL cap
if competition == "UCL" and verdict == "HIGH_CONVICTION":
    verdict = "ACTIONABLE"  # ← enforce; HIGH_CONVICTION blocked for UCL

# INVARIANT: SPECULATIVE goes to watchlist, not top_opportunities
if verdict == "SPECULATIVE":
    watchlist.append(match_id)  # ← CORRECT
    # NOT: top_opportunities.append(...)  ← WRONG

# INVARIANT: only critical_gaps force PARTIAL
if critical_gaps:  # ← CORRECT
    return PARTIAL_response(...)
# NOT: if any_gaps:  ← WRONG (advisory gaps do not block)

# INVARIANT: no synthetic feature injection
if feature_value is None:
    raise EvidenceGapError(f"Required feature {name} is missing")
    # NOT: feature_value = 0.0  ← WRONG (synthetic injection)
```

```typescript
// INVARIANT: all evidence/decision routes must not cache
export async function GET() {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',  // ← REQUIRED on all evidence/decision routes
    },
  })
}

// INVARIANT: validate proxy params before forwarding
const params = FixtureParamsSchema.safeParse(rawParams)
if (!params.success) {
  return Response.json({ error: 'Invalid params' }, { status: 422 })
}
// NOT: fetch(`${BACKEND_URL}/api/v1/fixtures/${rawParams.id}`)  ← WRONG (unvalidated)
```
