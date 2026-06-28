---
name: nexus
description: >
  Invoke NEXUS — the 34-skill orchestration engine for the SabiScore monorepo.
  Classifies task intent (including SabiScore-domain intents: provider gateway, evidence
  orchestration, betting engine, fixture identity, intelligence UI, ML/model), selects
  the minimum effective skill graph, resolves dependencies, and emits a Skill Trace Block
  before any implementation begins. Use at the start of every engineering task.
  Triggers: /nexus, "run NEXUS", "route this through NEXUS", "what skills for this",
  "classify this task", "which skills should I use", "begin task", "start working on".
argument-hint: "[describe your task in full — include the target file/surface if known]"
allowed-tools: Read, Grep, Glob, Bash(git diff --name-only HEAD:*), Bash(cat:*), Bash(jq:*)
user-invocable: true
---

## NEXUS Activation

**Task from user:** $ARGUMENTS

**Live workspace context (read before classifying):**

```
Active branch:       !`git branch --show-current 2>/dev/null || echo "(unknown)"`
Recent changes:      !`git diff --name-only HEAD 2>/dev/null | head -8 || echo "(no recent changes)"`
Suite version:       !`jq -r '"Suite v" + .suiteVersion + " | " + (.skills | length | tostring) + " skills"' .ai/registry.json 2>/dev/null || echo "(registry.json not found — run: make validate)"`
Current vertical:    !`git diff --name-only HEAD 2>/dev/null | grep -qE "^backend/" && echo "SabiScore (FastAPI/Python)" || (git diff --name-only HEAD 2>/dev/null | grep -qE "^apps/web" && echo "SabiScore Frontend (Next.js)" || echo "(determine from task)")`
```

---

## NEXUS PROTOCOL — Execute All Five Steps in Order

> Read `NEXUS.md` for the full skill registry and detailed graph rules.
> The abbreviated routing logic below is sufficient for most tasks.
> When in doubt: load NEXUS.md and apply the complete Step 2 graph tables.

---

### STEP 1 — CLASSIFY INTENT

Identify **all** intent types present in the task. A single task may map to multiple types.

**General intents:**

| Intent | Key Signals |
|---|---|
| Feature Build | "add X", "build Y", "implement Z", "create the feature" |
| Debugging / Profiling | "slow", "memory leak", "profile", "why is this crashing" |
| Performance | "bundle size", "LCP", "Core Web Vitals", "caching", "RSC", "PPR" |
| Security Audit | "secure", "auth", "OWASP", "CSP", "rate limit", "CORS", "XSS", "CSRF" |
| Architecture Design | "model this as", "design the system", "what should the structure be" |
| Backend Engineering | "Fastify", "FastAPI", "Prisma", "Alembic", "BullMQ", "Effect-TS", "SQLAlchemy", "job queue" |
| Frontend / UI | "component", "design", "accessibility", "animation", "token", "motion" |
| Product Design Strategy | "landing page", "dashboard", "onboarding", "hierarchy", "conversion" |
| Accessibility | "keyboard", "screen reader", "focus", "ARIA", "WCAG", "reduced motion" |
| Motion Systems | "page transitions", "Framer Motion", "scroll animation", "view transitions" |
| Edge / Caching | "edge runtime", "cache tags", "revalidate", "CDN", "middleware" |
| Domain Modeling | "bounded context", "aggregate", "entity", "domain event", "business rules" |
| API Contracts | "OpenAPI", "schema", "webhook", "versioning", "idempotency" |
| AI Feature | "streaming", "RAG", "tool calling", "LLM", "embeddings", "chatbot" |
| Prompt Engineering | "system prompt", "few-shot", "structured output", "prompt eval" |
| Multi-Agent | "SwarmX", "agent", "orchestrator", "LLM routing", "tool dispatch", "agent state" |
| Real-Time | "WebSocket", "SSE", "live updates", "presence", "optimistic UI", "job progress" |
| Data Visualization | "chart", "graph", "dashboard data", "recharts", "D3", "analytics UI" |
| Nigerian Fintech | "TaxBridge", "FIRS", "VAT", "CIT", "WHT", "e-invoicing", "NRS 2026", "BVN" |
| Mobile | "Expo", "React Native", "EAS", "Reanimated", "New Architecture" |
| Testing | "test", "Vitest", "Playwright", "MSW", "coverage", "e2e", "unit", "pytest" |
| Observability | "OTel", "trace", "span", "metrics", "log", "Grafana", "Jaeger", "structlog" |
| Editor / Tooling | "VS Code", "tsconfig", "ESLint", "husky", "git", "monorepo", "workspace" |
| Code Review | "review", "audit", "is this correct", "production-ready", "check this" |
| Release / Incident | "rollback", "feature flag", "canary", "postmortem", "incident", "release" |
| Skill Generation | "make a skill", "generate a skill" → route ONLY to `elite-skill-forge` |

**SabiScore-domain intents (additional classifier layer):**

| Intent | Key Signals |
|---|---|
| Provider Gateway | "provider health", "ESPN", "ESPN standings", "ESPN slug", "scoreboard", "API-Football", "Sportmonks", "football-data.org", "The Odds API", "circuit breaker", "provider quota", "adapter", "provider capabilities", "httpx.AsyncClient", "egress allowlist", "multi-domain" |
| Evidence Orchestration | "evidence profile", "DISCOVERY", "PREMATCH_STANDARD", "PREMATCH_ENRICHED", "LINEUP_REFRESH", "MARKET_REFRESH", "FORECAST_ONLY", "evidence criticality", "critical gap", "advisory gap", "evidence passport" |
| Fixture Identity | "canonical fixture", "fixture reconciliation", "team alias", "provider team ID", "VERIFIED", "CONFLICTING", "REQUIRES_REVIEW", "fuzzy matching" |
| Betting Engine | "verdict", "HIGH_CONVICTION", "ACTIONABLE", "SPECULATIVE", "HOLD", "PARTIAL", "NO_BET", "Kelly", "edge", "expected value", "de-vig", "overround", "betting_intelligence.py", "core_engine.py" |
| Intelligence UI | "/intelligence", "decision card", "evidence rail", "odds snapshot", "model-vs-market", "price window", "bookmaker candidate", "readiness rail" |
| ML / Model | "model artifact", "calibration", "feature registry", "prediction pipeline", "phase 9", "shadow mode", "xG", "pi-ratings", "Dixon-Coles", "SHAP", "bivariate Poisson" |
| Scraper | "scraper manifest", "raw snapshot", "parser validation", "source allowlist", "robots policy", "apps/scraper" |

---

### STEP 2 — SELECT SKILL GRAPH

Select the minimum necessary skill graph for all identified intents.

**SabiScore-specific skill graphs:**

**Provider Gateway (FastAPI/Python backend):**
```
Required:
  backend-systems-auditor           (production audit: idempotency, graceful shutdown)
  api-automation-architect          (circuit breaker, retry/backoff, saga patterns)
  opentelemetry-observability-architect  (provider latency, quota, circuit metrics)

Conditional:
  testing-strategy-architect        (provider adapter tests, contract tests)
  api-contract-governance-architect  (provider response schema validation)
  security-hardening-auditor        (credential handling, egress allowlists)
  backend-domain-model-architect    (provider gateway domain model)

ESPN-specific guards (apply when the target is the ESPN provider):
  - Trust tier is UNOFFICIAL_PUBLIC, keyless; confirm no ESPN[_]API[_]KEY exists
  - Egress allowlist must permit BOTH site.api.espn.com AND sports.core.api.espn.com
  - Standings MUST use /apis/v2/ (the /apis/site/v2/ path returns a stub)
  - Exactly 7 canonical competitions; unsupported slugs fail closed
  - provider_timestamp = None for scoreboards (never set to kickoff)
  - ESPN is supplementary-only — never a critical_gap source
```

**Evidence Orchestration:**
```
Required:
  backend-domain-model-architect    (evidence criticality, gap classification model)
  api-automation-architect          (concurrent provider fan-out, reconciliation)

Conditional:
  opentelemetry-observability-architect  (evidence freshness metrics, gap rate)
  testing-strategy-architect        (evidence contract tests per profile)
  backend-systems-auditor           (orchestrator production audit)
```

**Fixture Identity & Reconciliation:**
```
Required:
  backend-domain-model-architect    (canonical entity design, VERIFIED/CONFLICTING/REQUIRES_REVIEW)
  prisma-database-architect         (canonical team/fixture/alias schema → use Alembic equivalent)

Conditional:
  api-contract-governance-architect  (reconciliation API contract)
  testing-strategy-architect        (fuzzy-match conflict tests)
```

**Betting Engine / Verdict Logic:**
```
Required:
  backend-domain-model-architect    (verdict state machine, Kelly formula, EV invariants)
  backend-systems-auditor           (determinism audit, pure function isolation)
  testing-strategy-architect        (UCL cap, Kelly, overround, SPECULATIVE exclusion)

Conditional:
  api-contract-governance-architect  (Core Engine request/response schema)
  opentelemetry-observability-architect  (verdict distribution metrics)
```

**Intelligence UI (`/intelligence`):**
```
Required:
  frontend-product-design-architect  (evidence-first workspace IA)
  data-visualization-architect       (model-vs-market chart, price window)
  accessibility-system-architect     (WCAG 2.1 AA, keyboard-operable drawer)
  component-quality-gate             (decision card, evidence rail components)

Conditional:
  design-token-system-architect     (SabiScore chart token system)
  real-time-systems-architect       (live evidence refresh via SSE)
  motion-performance-architect      (skeleton strategy, reduced-motion)
  motion-interaction-architect      (stable skeleton dimensions, transition impl)
  nextjs-performance-architect      (RSC boundaries, no-store headers, Zod validation)
```

**ML / Model / Feature Engineering:**
```
Required:
  backend-domain-model-architect    (model artifact contract, calibration model)
  testing-strategy-architect        (feature registry, prediction pipeline tests)

Conditional:
  opentelemetry-observability-architect  (prediction latency, model readiness metrics)
  backend-systems-auditor           (model artifact loading, readiness checks)
  security-hardening-auditor        (synthetic feature injection prevention)
```

**General skill graphs** (when no SabiScore-specific intent detected):
> Apply the standard NEXUS.md Step 2 graphs unchanged.

---

### STEP 3 — RESOLVE DEPENDENCY ORDER

List skills in execution sequence with explicit rationale:

```
1. [highest-priority skill]   — reason: sets constraints all others must respect
2. [second skill]             — reason: depends on output of skill 1
3. [third skill]              — reason: implementation, may conflict with 2 → resolution: [...]
...
N. [implementation skills last]
```

**Ordering rules:**
- Security skills always run before implementation skills
- `motion-performance-architect` always runs before `motion-interaction-architect`
- `backend-domain-model-architect` always runs before `effect-ts-layer-architect`
- `frontend-product-design-architect` always runs before `component-quality-gate`
- `prompt-engineering-architect` always runs before `ai-feature-architect`
- For SabiScore backend: `backend-systems-auditor` before any provider adapter implementation

---

### STEP 4 — EMIT SKILL TRACE BLOCK

Output this block **before any implementation begins**:

```
┌─ NEXUS ────────────────────────────────────────────────┐
│ Task:      [one-line intent classification]            │
│ Vertical:  [SabiScore / TaxBridge / SwarmX / all]     │
│ Stack:     [Python/FastAPI | TS/Fastify | Next.js]     │
│ Skills:    skill-a → skill-b → skill-c                 │
│ Order:     1. skill-a  2. skill-b  3. skill-c          │
│ Overrides: [conflict resolutions applied, or NONE]     │
│ Risk:      [critical risks identified, or NONE]        │
└────────────────────────────────────────────────────────┘
```

---

### STEP 5 — HAND OFF AND IMPLEMENT

Load the selected skills and begin implementation.

**Pre-implementation checklist** (run through mentally before writing any code):

- [ ] Is this SabiScore backend work? Confirm: Alembic only, no `Base.metadata.create_all()`, `httpx.AsyncClient` lifespan, `evaluation_at` from endpoint layer
- [ ] Is this SabiScore frontend work? Confirm: zero direct provider calls, Zod on all proxy params, `Cache-Control: no-store` on evidence/decision routes
- [ ] Does this touch the betting engine? Confirm: `evaluation_at` injected, UCL cap in place, SPECULATIVE → watchlist only, only `critical_gaps` force PARTIAL
- [ ] Does this touch credentials? Confirm: no `NEXT_PUBLIC_*` provider keys, no ESPN API key variable, Gitleaks CI gate active
- [ ] Does this change observability? Confirm: new spans/metrics added where required, no silent regressions
- [ ] Does this touch the ESPN provider? Confirm: keyless (no `ESPN[_]API[_]KEY`), allowlist permits both `site.api.espn.com` and `sports.core.api.espn.com`, standings use `/apis/v2/` not `/apis/site/v2/`, exactly 7 competitions, `provider_timestamp=None` for scoreboards, supplementary-only (never a `critical_gap`)
- [ ] Does this touch scraper? Confirm: no probability/verdict/Kelly calculations in `apps/scraper`

**Do not implement before the Skill Trace Block is complete.**
