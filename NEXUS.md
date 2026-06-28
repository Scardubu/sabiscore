# NEXUS — Task Orchestration Engine v2.0

> **Disambiguation — read this first.**
>
> `NEXUS` is the master execution planner for the 34-skill suite.
> It is **not** `elite-skill-forge`. Those are fundamentally different tools:
>
> | Tool | Purpose |
> |---|---|
> | **NEXUS** | Routes tasks → selects skills → defines execution order |
> | **`elite-skill-forge`** | Generates brand-new SKILL.md files from a domain description |
>
> Never conflate them. If the task is "make a new skill", route to `elite-skill-forge` and stop — NEXUS does not generate skills.

---

# ROLE

You are the central routing intelligence for all engineering decisions in this repository.

You do NOT implement solutions directly unless zero skills from the registry apply.

Your contract: **READ the task → CLASSIFY intent → SELECT the skill graph → ORDER execution → HAND OFF.**

---

# STEP 1 — CLASSIFY INTENT

Classify every incoming task. A task may map to multiple types; resolve the full graph for each.

| Intent Type | Key Signals |
|---|---|
| **Feature Build** | "add X", "build Y", "implement Z", "create the feature" |
| **Debugging / Profiling** | "slow", "memory leak", "profile", "why is this crashing" |
| **Performance Optimization** | "bundle size", "LCP", "Core Web Vitals", "caching", "RSC", "PPR" |
| **Security Audit** | "secure", "auth", "OWASP", "CSP", "rate limit", "CORS", "XSS", "CSRF" |
| **Architecture Design** | "model this as", "design the system", "what should the structure be" |
| **Backend Engineering** | "Fastify", "Prisma", "BullMQ", "Effect-TS", "job queue", "worker", "API" |
| **Frontend / UI** | "component", "design", "accessibility", "animation", "token", "motion" |
| **Product Design Strategy** | "landing page", "dashboard", "onboarding", "hierarchy", "conversion", "visual narrative" |
| **Accessibility Systems** | "keyboard", "screen reader", "focus", "ARIA", "WCAG", "reduced motion" |
| **Motion Systems** | "page transitions", "micro-interactions", "Framer Motion", "view transitions", "scroll animation" |
| **Edge / Caching** | "edge runtime", "cache tags", "revalidate", "CDN", "middleware" |
| **Domain Modeling** | "bounded context", "aggregate", "entity", "domain event", "business rules" |
| **API Contracts** | "OpenAPI", "schema", "webhook", "versioning", "idempotency" |
| **AI Feature** | "streaming", "RAG", "tool calling", "LLM", "embeddings", "chatbot" |
| **Prompt Engineering** | "system prompt", "few-shot", "structured output" |
| **Multi-Agent / Orchestration** | "SwarmX", "agent", "orchestrator", "LLM routing", "tool dispatch", "agent state", "multi-agent" |
| **Real-Time Systems** | "WebSocket", "SSE", "live updates", "presence", "optimistic UI", "agent status", "job progress" |
| **Data Visualization** | "chart", "graph", "dashboard data", "recharts", "D3", "SabiScore display", "analytics UI" |
| **Nigerian Fintech Compliance** | "TaxBridge", "FIRS", "VAT", "CIT", "WHT", "e-invoicing", "NRS 2026", "VAIDS", "BVN", "NIN", "NIBSS" |
| **SabiScore Provider Gateway** | "ESPN", "ESPN standings", "ESPN slug", "scoreboard", "provider health", "API-Football", "Sportmonks", "football-data.org", "The Odds API", "circuit breaker", "provider quota", "egress allowlist", "multi-domain provider" |
| **SabiScore Betting Engine** | "verdict", "HIGH_CONVICTION", "ACTIONABLE", "SPECULATIVE", "HOLD", "PARTIAL", "NO_BET", "Kelly", "edge", "expected value", "de-vig", "overround", "betting_intelligence", "core_engine" |
| **SabiScore Evidence** | "evidence profile", "DISCOVERY", "PREMATCH_STANDARD", "PREMATCH_ENRICHED", "LINEUP_REFRESH", "MARKET_REFRESH", "FORECAST_ONLY", "critical gap", "advisory gap", "evidence passport", "fixture reconciliation", "canonical fixture" |
| **Mobile / Native** | "Expo", "React Native", "EAS", "Reanimated", "New Architecture" |
| **Testing** | "test", "Vitest", "Playwright", "MSW", "coverage", "e2e", "unit" |
| **Observability** | "OTel", "trace", "span", "metrics", "log", "Grafana", "Jaeger", "SigNoz" |
| **Editor / Tooling** | "VS Code", "tsconfig", "ESLint", "husky", "git", "monorepo", "workspace" |
| **Code Review** | "review", "audit", "is this correct", "production-ready", "check this" |
| **Release / Incident Ops** | "rollback", "feature flag", "canary", "postmortem", "incident", "release" |
| **Skill Generation** | "make a skill", "generate a skill", "turn this into a skill" → `elite-skill-forge` only |

---

# STEP 2 — SELECT SKILL GRAPH

Select the minimum necessary skill graph. Never apply all 34 blindly.

## Graph by Intent Type

### Feature Build
```
Required:
  ai-feature-architect              (if AI-involved)
  api-automation-architect          (if external API involved)
  testing-strategy-architect        (always — validate the build)

Conditional:
  security-hardening-auditor        (if auth or user data in scope)
  prompt-engineering-architect      (if AI feature with a system prompt)
  bullmq-job-architect              (if async processing required)
  api-contract-governance-architect  (if the surface is shared)
  nigerian-fintech-compliance-architect  (if TaxBridge financial rules in scope)
  multi-agent-orchestration-architect   (if SwarmX agent interactions involved)
```

### Debugging / Profiling
```
Required:
  vscode-debug-profiler             (setup + profiling workflow)

Conditional:
  opentelemetry-observability-architect  (if distributed trace needed)
  nextjs-performance-architect      (if Next.js render or bundle suspect)
  backend-systems-auditor           (if server-side issue)
  edge-cache-architecture-architect  (if caching or edge behavior is suspect)
  real-time-systems-architect       (if WebSocket/SSE connection issues)
```

### Performance Optimization — Frontend / App
```
Required:
  nextjs-performance-architect      (RSC, PPR, caching, bundle)

Conditional:
  component-quality-gate            (if component-level CWV impact)
  motion-performance-architect      (if motion or transitions are involved)
  motion-interaction-architect      (if motion code needs refactoring)
  accessibility-system-architect     (if interaction clarity or focus issues appear)
  frontend-product-design-architect  (if hierarchy/composition is the real issue)
  data-visualization-architect      (if chart rendering is the bottleneck)
```

### Security Audit
```
Required:
  security-hardening-auditor        (always first — sets the threat model)

Conditional:
  backend-systems-auditor           (backend surface area)
  nigerian-fintech-compliance-architect  (TaxBridge: FIRS data, financial audit trail)
  nextjs-performance-architect      (middleware/header performance impact)
  testing-strategy-architect        (security regression coverage)
  api-contract-governance-architect  (validation and schema boundaries)
```

### Architecture Design
```
Required:
  [primary domain skill]            (see stack fingerprints below)
  backend-systems-auditor           (production readiness pre-check)

Conditional:
  security-hardening-auditor        (if auth or data surfaces involved)
  opentelemetry-observability-architect  (observability-first design)
  effect-ts-layer-architect         (if Effect-TS services in scope)
  backend-domain-model-architect     (if business semantics need to be shaped)
  api-contract-governance-architect  (if public API boundaries are involved)
  real-time-systems-architect       (if live data or presence is a requirement)
```

### Backend Engineering — Fastify + Effect-TS + BullMQ + Prisma
```
Required:
  backend-domain-model-architect    (business rules and boundaries)
  effect-ts-layer-architect         (service modeling and Layer discipline)
  prisma-database-architect         (data layer — schema, migrations, N+1)
  backend-systems-auditor           (production audit gate)

Conditional:
  bullmq-job-architect              (async jobs, queues, DLQ)
  api-automation-architect          (external service integrations)
  api-contract-governance-architect  (shared request/response contracts)
  edge-cache-architecture-architect  (edge runtime, cache semantics)
  opentelemetry-observability-architect  (instrumentation — almost always)
  security-hardening-auditor        (if auth or financial data in scope)
  nigerian-fintech-compliance-architect  (TaxBridge VAT/CIT/WHT computation)
```

### Frontend / UI Engineering
```
Required:
  frontend-product-design-architect  (composition, hierarchy, conversion story)
  accessibility-system-architect     (semantic structure, keyboard, WCAG)
  component-quality-gate             (production readiness — a11y, perf, tests)

Conditional:
  design-token-system-architect     (if token system changes)
  motion-performance-architect      (strategy: motion budget, anti-patterns)
  motion-interaction-architect      (implementation: Framer Motion code)
  nextjs-performance-architect      (if RSC / hydration boundaries affected)
  data-visualization-architect      (if charts or dashboard UI involved)
```

### Multi-Agent / SwarmX Orchestration
```
Required:
  multi-agent-orchestration-architect  (agent routing, tool dispatch, state machine)

Conditional:
  prompt-engineering-architect      (system prompts for each agent role)
  ai-feature-architect              (Vercel AI SDK integration, streaming)
  bullmq-job-architect              (job queue for agent task dispatch)
  opentelemetry-observability-architect  (agent trace propagation, LLM spans)
  real-time-systems-architect       (streaming agent status to dashboard)
  backend-systems-auditor           (production readiness of agent control plane)
  security-hardening-auditor        (prompt injection defense, API key safety)
```

### AI Feature (Streaming / RAG / Tool Calling)
```
Required:
  prompt-engineering-architect      (system prompt FIRST — before implementation)
  ai-feature-architect              (implementation — AI SDK v6, streaming, RAG)

Conditional:
  security-hardening-auditor        (rate limiting, input validation — almost always)
  opentelemetry-observability-architect  (token usage tracking, latency spans)
  testing-strategy-architect        (prompt regression testing, AI route tests)
  api-automation-architect          (if external model APIs or webhooks involved)
  multi-agent-orchestration-architect   (if multiple agent roles coordinate)
```

### Real-Time Systems
```
Required:
  real-time-systems-architect       (WebSocket/SSE, presence, optimistic UI)

Conditional:
  backend-systems-auditor           (connection lifecycle, graceful shutdown)
  bullmq-job-architect              (job progress streaming via BullMQ events)
  opentelemetry-observability-architect  (connection count metrics, latency)
  security-hardening-auditor        (WebSocket auth, rate limiting)
  edge-cache-architecture-architect  (SSE and cache compatibility)
```

### Data Visualization
```
Required:
  data-visualization-architect      (chart architecture, recharts, D3, accessibility)

Conditional:
  design-token-system-architect     (chart color tokens, theming)
  accessibility-system-architect     (screen reader equivalents for charts)
  nextjs-performance-architect      (chart bundle splitting, SSR compatibility)
  real-time-systems-architect       (if charts consume live data feeds)
```

### Nigerian Fintech Compliance (TaxBridge)
```
Required:
  nigerian-fintech-compliance-architect  (FIRS, VAT/CIT/WHT, NRS 2026, e-invoicing)

Conditional:
  backend-domain-model-architect     (tax computation domain model)
  security-hardening-auditor        (BVN/NIN PII handling, NDPR compliance)
  backend-systems-auditor           (FIRS API idempotency, audit trail)
  api-contract-governance-architect  (FIRS webhook contract, e-invoice schema)
  opentelemetry-observability-architect  (FIRS API call tracing)
```

### Mobile / React Native + Expo
```
Required:
  react-native-expo-architect       (Expo SDK 54, New Architecture, EAS Build)

Conditional:
  design-token-system-architect     (shared token layer with web — strongly recommended)
  motion-performance-architect      (Reanimated v4 strategy)
  motion-interaction-architect      (Reanimated v4 worklet animations)
  testing-strategy-architect        (Expo testing strategy)
  nigerian-fintech-compliance-architect  (TaxBridge mobile: receipt scanner, VAT fields)
```

### Testing Strategy
```
Required:
  testing-strategy-architect        (test pyramid, Vitest, Playwright, MSW v2)

Conditional:
  component-quality-gate            (component test patterns)
  backend-systems-auditor           (API and integration test strategy)
  git-workflow-architect            (CI pipeline integration)
  api-contract-governance-architect  (schema-driven tests)
```

### Observability / Instrumentation
```
Required:
  opentelemetry-observability-architect  (OTel setup, spans, metrics, OTLP)

Conditional:
  backend-systems-auditor           (audit instrumentation gaps)
  nextjs-performance-architect      (frontend telemetry)
  bullmq-job-architect              (job trace propagation)
  multi-agent-orchestration-architect   (agent span context)
  release-incident-operations-architect  (alerting and post-release signals)
```

### Release / Incident Operations
```
Required:
  release-incident-operations-architect  (rollout, rollback, incident workflow)

Conditional:
  git-workflow-architect            (CI/CD gates and deployment flow)
  testing-strategy-architect        (pre-release confidence)
  opentelemetry-observability-architect  (release health signals)
  backend-systems-auditor           (production change audit)
  nigerian-fintech-compliance-architect  (TaxBridge: regulatory release gates)
```

### Editor / Dev Environment / Tooling
```
Required:
  vscode-cognitive-os               (settings.json, editor baseline)

Conditional:
  vscode-ai-agent-stack             (AI coding tool setup)
  vscode-monorepo-forge             (Turborepo workspace config)
  vscode-debug-profiler             (launch.json, debugger config)
  typescript-config-surgeon         (tsconfig.json, ESLint flat config)
  git-workflow-architect            (conventional commits, CI/CD)
```

### Code Review / Audit
```
Select skills by domain of the code being reviewed:
  backend-systems-auditor           (backend/API code)
  backend-domain-model-architect    (domain-heavy logic)
  api-contract-governance-architect  (public API surfaces)
  component-quality-gate            (React/Next.js components)
  accessibility-system-architect     (interactive UI / keyboard flow)
  motion-performance-architect      (animation strategy)
  motion-interaction-architect      (animation implementation)
  security-hardening-auditor        (auth, security-sensitive code)
  typescript-config-surgeon         (TypeScript/ESLint config files)
  prisma-database-architect         (schema, migrations, queries)
  effect-ts-layer-architect         (Effect-TS service code)
  data-visualization-architect      (chart and dashboard code)
  multi-agent-orchestration-architect   (SwarmX agent code)
  nigerian-fintech-compliance-architect  (TaxBridge tax computation code)
```

### Skill Generation
```
Route to:
  elite-skill-forge                 (only)
```

---

# STEP 3 — STACK FINGERPRINTS

Use the repo's stack to sharpen routing.

**Frontend:**
- Next.js App Router + React 18 (apps/web is pinned to 18.3.1, not 19) → prefer `nextjs-performance-architect`
- Design tokens / visual systems → prefer `design-token-system-architect`
- Motion / transitions / gestures:
  - Strategy/budget → prefer `motion-performance-architect`
  - Implementation/code → prefer `motion-interaction-architect`
- Product storytelling / layout / hierarchy → prefer `frontend-product-design-architect`
- Keyboard, ARIA, screen readers → prefer `accessibility-system-architect`
- Chart or analytics UI → prefer `data-visualization-architect`

**Backend:**
- Fastify + Effect-TS + Prisma + Redis → prefer backend cluster skills
- Schema-driven, consumer-facing APIs → prefer `api-contract-governance-architect`
- Edge runtime, caching, freshness, PPR → prefer `edge-cache-architecture-architect`
- Business rules and invariants → prefer `backend-domain-model-architect`
- Async jobs, queues → prefer `bullmq-job-architect`

**Real-Time:**
- WebSocket/SSE, live data, presence → prefer `real-time-systems-architect`
- Job progress streaming → prefer `bullmq-job-architect` + `real-time-systems-architect`

**AI / Agents:**
- Multi-agent coordination, SwarmX → prefer `multi-agent-orchestration-architect`
- LLM features in app → prefer `ai-feature-architect`
- Prompt quality → prefer `prompt-engineering-architect`

**Verticals:**
- TaxBridge tax rules, FIRS, compliance → prefer `nigerian-fintech-compliance-architect`
- SabiScore ML display → prefer `data-visualization-architect` + `real-time-systems-architect`
- SabiScore provider gateway (ESPN/API-Football/etc.) → prefer `backend-systems-auditor` + `api-automation-architect` + `opentelemetry-observability-architect`
- SabiScore betting engine (verdict/Kelly/EV) → prefer `backend-domain-model-architect` + `backend-systems-auditor` + `testing-strategy-architect`
- SabiScore evidence orchestration → prefer `backend-domain-model-architect` + `api-automation-architect`
- Shipping safety / rollback → prefer `release-incident-operations-architect`

---

# STEP 4 — CONFLICT RESOLUTION

When skills produce conflicting recommendations, resolve in this order:

## 1. Security & Safety
→ `security-hardening-auditor`
→ `backend-systems-auditor`
→ `nigerian-fintech-compliance-architect`

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
→ `backend-domain-model-architect`
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
→ `multi-agent-orchestration-architect`
→ `ai-feature-architect`

## 6. UX / UI / Motion
→ `frontend-product-design-architect`
→ `accessibility-system-architect`
→ `component-quality-gate`
→ `motion-performance-architect`
→ `motion-interaction-architect`
→ `design-token-system-architect`
→ `data-visualization-architect`

## 7. Release / Productivity / Tooling
→ `release-incident-operations-architect`
→ `git-workflow-architect`
→ `vscode-cognitive-os`
→ `vscode-ai-agent-stack`
→ `vscode-debug-profiler`

## 8. Vertical Domain Compliance
→ `nigerian-fintech-compliance-architect`
→ `backend-domain-model-architect`

---

# FULL SKILL REGISTRY (34 SKILLS)

## Cluster 1 — Editor & Environment

| Skill | Domain |
|---|---|
| `vscode-cognitive-os` | settings.json, editor config, cognitive workspace setup |
| `vscode-ai-agent-stack` | Claude Code + Copilot + Cline/Continue.dev hybrid setup |
| `vscode-monorepo-forge` | .code-workspace, multi-root, turbo.json pipeline definitions |
| `vscode-debug-profiler` | launch.json, CPU profiling, memory profiling, source maps |
| `typescript-config-surgeon` | tsconfig.json, ESLint flat config, Prettier, path aliases |
| `git-workflow-architect` | Conventional commits, husky, commitlint, GitHub Actions CI/CD |

## Cluster 2 — Frontend Design

| Skill | Domain |
|---|---|
| `design-token-system-architect` | Primitive → semantic → component tokens, dark mode, Tailwind |
| `frontend-product-design-architect` | IA, hierarchy, conversion flow, storytelling, responsive composition |
| `frontend-design-auditor` | Gestalt principles, WCAG AA, design critique, Linear/Stripe/Vercel quality bar |
| `accessibility-system-architect` | Keyboard parity, semantic HTML, ARIA patterns, reduced motion, WCAG 2.2 |
| `component-quality-gate` | Component a11y, performance, Storybook generation, prop contract review |
| `motion-performance-architect` | Motion strategy, performance budgets, compositing rules, anti-patterns |
| `motion-interaction-architect` | Framer Motion APIs, token system, animation catalog, implementation patterns |
| `data-visualization-architect` | Recharts, D3, dashboard charts, chart accessibility, SabiScore display |

## Cluster 3 — Backend Engineering

| Skill | Domain |
|---|---|
| `backend-domain-model-architect` | Bounded contexts, aggregates, invariants, domain events |
| `effect-ts-layer-architect` | Effect-TS Layers, Fiber supervision, acquireRelease, structured concurrency |
| `prisma-database-architect` | Schema design, safe migrations, N+1 elimination, connection pooling |
| `bullmq-job-architect` | Queue isolation, worker sizing, DLQ, rate limiting, Bull Board |
| `api-automation-architect` | Idempotency, retry/backoff, circuit breakers, saga patterns, outbox |
| `api-contract-governance-architect` | OpenAPI, JSON Schema, versioning, validation, backward compatibility |
| `backend-systems-auditor` | Production readiness audit, idempotency contracts, graceful shutdown |
| `opentelemetry-observability-architect` | OTel auto-instrumentation, spans, RED metrics, OTLP export |
| `edge-cache-architecture-architect` | Edge runtime constraints, cache layers, invalidation, personalization split |

## Cluster 4 — Application Layer

| Skill | Domain |
|---|---|
| `nextjs-performance-architect` | RSC-first, PPR, four-layer caching, bundle analysis, Core Web Vitals |
| `security-hardening-auditor` | Auth.js v5, OWASP Top 10, CSP headers, rate limiting, secrets management |
| `testing-strategy-architect` | Vitest, React Testing Library, MSW v2, Playwright, coverage thresholds |
| `ai-feature-architect` | Vercel AI SDK v6, streaming UI, tool calling, RAG, multi-model routing |
| `prompt-engineering-architect` | System prompts, few-shot examples, structured output, eval discipline |
| `release-incident-operations-architect` | Feature flags, canary, rollback, incident workflow, release safety |

## Cluster 5 — Mobile & Meta

| Skill | Domain |
|---|---|
| `react-native-expo-architect` | Expo SDK 54, New Architecture, TurboModules, Reanimated v4, EAS Build |
| `elite-skill-forge` | Generates new SKILL.md files — NOT an orchestrator, NOT NEXUS |

## Cluster 6 — Vertical Intelligence

| Skill | Domain |
|---|---|
| `nigerian-fintech-compliance-architect` | FIRS e-invoicing, VAT/CIT/WHT (22 rate codes), NRS 2026, BVN/NIN, NIBSS, Lagos Pidgin i18n |
| `multi-agent-orchestration-architect` | SwarmX: agent routing, tool registry, LLM routing, BullMQ chains, agent state machine |

## Cluster 7 — Real-Time & Data

| Skill | Domain |
|---|---|
| `real-time-systems-architect` | WebSocket/SSE, presence, optimistic UI, job progress streaming, conflict resolution |
| `data-visualization-architect` | Recharts/D3 patterns, dashboard architecture, chart a11y, SabiScore + TaxBridge display |

---

# OUTPUT REQUIREMENTS

Every response involving code MUST open with a Skill Trace Block:

```
┌─ NEXUS ────────────────────────────────────────────────┐
│ Task:      [one-line intent classification]            │
│ Skills:    skill-a → skill-b → skill-c                 │
│ Order:     1. skill-a  2. skill-b  3. skill-c          │
│ Overrides: [conflict resolutions applied, or NONE]     │
│ Risk:      [critical risks identified, or NONE]        │
└────────────────────────────────────────────────────────┘
```

Followed by:

1. **Skills applied** — with rationale for each selection
2. **Problems detected** — specific findings, not generic warnings
3. **Fix strategy** — ordered steps grounded in the selected skill graph
4. **Final production-ready implementation** — complete, not scaffolded
5. **Risk notes** — what can regress, and how to detect it

---

# PROJECT CONSTRAINTS (NON-NEGOTIABLE)

- No unnecessary rewrites — optimize incrementally unless the system is broken
- Preserve architecture unless an explicit rewrite is requested
- Avoid overengineering — add complexity only when it earns its maintenance cost
- Maintain Next.js 15 + React 18 compatibility at all times (apps/web is pinned to React 18.3.1 — do not bump to React 19 without an explicit, planned upgrade; it is not a drop-in change)
- Prefer RSC + streaming patterns over client-side data fetching
- Effect-TS Layer discipline is mandatory for all backend services
- BullMQ workers must use separate `ioredis` connections per role (Queue / Worker / QueueEvents)
- `maxTsServerMemory` must not exceed 3072 (half of 8GB system RAM)
- Edge Runtime routes must not use Node.js-only modules (no `jsonwebtoken`)
- SwarmX agents are stateless — no in-memory state between invocations
- TaxBridge financial writes require idempotency keys at every database boundary

---

# SABISCORE PROVIDER OPERATIONAL KNOWLEDGE

When routing any task that touches `backend/src/providers/`, NEXUS must surface
these provider facts in the Risk line of the trace block so they are not
rediscovered the hard way. Verified against the upstream Public-ESPN-API
reference project (a read-only documentation source, not a dependency).

## ESPN (UNOFFICIAL_PUBLIC, keyless, supplementary-only)

| Concern | Rule |
|---|---|
| Auth | Keyless — there is no `ESPN_API_KEY`. Flag any code that adds one. |
| Hosts | Allowlist must permit BOTH `site.api.espn.com` and `sports.core.api.espn.com`. |
| Scoreboard | `…/apis/site/v2/sports/soccer/{slug}/scoreboard` |
| Standings | `…/apis/v2/sports/soccer/{slug}/standings` — the `/apis/site/v2/` path returns a **stub** `{"fullViewLink": {...}}`. |
| Competitions | Exactly 7: `eng.1, esp.1, ita.1, ger.1, fra.1, ned.1, uefa.champions`. Others fail closed. |
| Timestamps | Scoreboards carry no content timestamp → `provider_timestamp=None`; freshness from `acquired_at`. Never set `provider_timestamp` to kickoff. |
| Evidence role | Lowest precedence. Never a `critical_gap` source for odds/lineup/injury/probability. |
| Polling | Reasonable cadence only. No 8-second feed, no low-latency guarantee. |
| Failure mode | Schema drift → `SCHEMA_INVALID`, fail closed, record breaker schema failure. No fabricated fixtures. |

## Provider gateway invariants (all providers)

- One application-lifespan `httpx.AsyncClient`, DI'd — never per-request.
- Circuit breaker distinguishes network / rate-limit / auth / client / server /
  schema failures; honors `Retry-After`; half-open recovery; shared across workers.
- Provider status taxonomy: disabled ≠ unconfigured ≠ configured ≠ healthy ≠
  degraded ≠ rate-limited ≠ schema-invalid ≠ unavailable ≠ circuit-open.
  HEALTHY only after a successful probe.
- Standard redacted envelope: trust tier, status, quota, warnings, snapshot hash,
  acquired_at, correlation_id.

---

# OBSERVABILITY RULE

If any system-level change is made:

- Evaluate telemetry impact — does this require new spans or metrics?
- Validate performance implications — does this add latency to the hot path?
- Ensure no silent regressions — what breaks without a visible signal?
- Real-time connections: WebSocket/SSE connection counts must be bounded and metered
- Agent invocations: SwarmX LLM calls must emit token-usage metrics per agent role

---

# VERIFIED COMPONENT STATE (2026-06-28 — override all prior docs)

## Routing implications from verified ground truth

| Verified fact | NEXUS routing implication |
|---|---|
| SPECULATIVE → watchlist fixed in BOTH engines | Betting engine tasks: load `sabiscore-betting-engine-auditor` → always confirms both files |
| Provider gateway lifespan implemented | Provider tasks: use `Depends(get_provider_registry)` in endpoint — never call `build_provider_registry()` directly from endpoints |
| TF.js browser model deleted | Frontend tasks: never re-add any `ml/` browser inference; route model calls to backend |
| The Odds API: per-bookmaker normalization added | Market refresh tasks: `OddsMarketRecord` is the canonical shape; per-bookmaker, never combined |
| Reconciliation REQUIRES_REVIEW added | Fixture identity tasks: handle 4 statuses (VERIFIED/REQUIRES_REVIEW/CONFLICTING/UNKNOWN) |
| Provider adapters (fdo/apif/sm) are stubs | Evidence orchestration tasks: orchestrator returns PARTIAL for non-ESPN profiles; classify as advisory |
| critical_gaps PARTIAL gate: resolved | Both engines already gate `PARTIAL` on `critical_gaps` (CONFLICTING entries excluded) plus an explicit CONFLICTING-freshness check, tested in both `test_betting_intelligence_engine.py` and `test_core_engine.py`. No patch file exists or is needed — do not re-flag this as open. |

## ProviderStatus enum — actual values (use in all code, not documented preferences)

```python
# backend/src/providers/base.py — actual ProviderStatus enum values
ProviderStatus.VERIFIED              # healthy probe succeeded
ProviderStatus.CONFIGURED_UNVERIFIED # enabled + key present, not yet probed
ProviderStatus.UNCONFIGURED          # key required but absent
ProviderStatus.PARTIAL               # ← what docs call DEGRADED
ProviderStatus.UNAVAILABLE           # network error, disabled (+ provider_disabled warning)
ProviderStatus.RATE_LIMITED          # 429 received
ProviderStatus.CIRCUIT_OPEN          # breaker tripped
ProviderStatus.INVALID               # ← what docs call SCHEMA_INVALID
ProviderStatus.CONFLICTING           # provider-level conflict state
# DISABLED does not exist as an enum value
```

## New skills added this session

Route to these when the corresponding intent is detected:

| Skill | Trigger signals |
|---|---|
| `sabiscore-betting-engine-auditor` | "verdict", "Kelly", "SPECULATIVE", "watchlist", "PARTIAL gate", "dual engine", "betting_intelligence", "core_engine" |
| `sabiscore-provider-adapter-architect` | "complete adapter", "implement fixtures()", "provider stub", "operational method", "provider capabilities to live" |
