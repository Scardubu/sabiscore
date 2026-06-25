# AI Engineering Control System (Claude Code)

This repository is governed by a modular AI skill system located in:

```
.ai/skills/
```

These skills define specialist behaviors applied during code analysis, modification,
and generation. Orchestration is handled by **NEXUS** — see the mandatory entry point
section below.

---

# PROJECT STACK (IMMUTABLE CONSTANTS)

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19 + RSC, Tailwind CSS v4 |
| Mobile | React Native, Expo SDK 54, Reanimated v4, EAS |
| Backend | Fastify 5, Effect-TS, BullMQ, Redis |
| Database | PostgreSQL, Prisma 5, pgvector |
| Monorepo | Turborepo, pnpm workspaces |
| Observability | OpenTelemetry (OTel), structured logging, OTLP |
| Auth | Auth.js v5 |
| AI / Agents | Vercel AI SDK v6, Ollama (local), SwarmX (multi-agent orchestration) |
| Runtimes | Node.js (API), Edge Runtime (Next.js routes) |

**Active applications:**
- **TaxBridge** — Nigerian SME tax compliance (VAT, CIT, WHT, FIRS e-invoicing, NRS 2026)
- **SabiScore** — Sports ML intelligence and data visualization platform
- **Hashablanca** — Encrypted blockchain data analytics
- **SwarmX** — Local multi-agent AI orchestration (30+ agents, 7-layer control plane, BullMQ)

---

# CORE EXECUTION RULE

Before ANY action that involves understanding, modifying, or generating code:

1. Route through **NEXUS** for task classification and skill selection
2. Load ONLY the skills NEXUS selects — never blind-load the full suite
3. Execute skills in NEXUS's dependency order
4. Resolve conflicts using the priority hierarchy below
5. Open every code response with a **Skill Trace Block** (see Output Requirements)

---

# SKILL ORCHESTRATION PRINCIPLE

Claude Code must operate as a multi-agent system:

- One task ≠ one skill
- One task = a skill composition graph resolved by NEXUS

---

# MANDATORY SKILL ENTRY POINT

All tasks MUST begin with:

👉 **NEXUS**

NEXUS is the system orchestrator responsible for:

- Task intent classification
- Skill selection from the 34-skill registry
- Dependency graph resolution
- Execution ordering
- Conflict resolution

No other skill may be invoked before NEXUS has run.

> ⚠️ **Name disambiguation:** NEXUS is the orchestrator defined in `NEXUS.md`.
> It is entirely separate from `elite-skill-forge` — a skill that **generates** new
> SKILL.md files from domain descriptions. These are different tools:
>
> | Tool | Location | Purpose |
> |---|---|---|
> | NEXUS | `NEXUS.md` | Routes tasks → selects skill graphs → orders execution |
> | `elite-skill-forge` | `.ai/skills/elite-skill-forge/` | Generates brand-new skills |

---

# SKILL PRIORITY HIERARCHY (CONFLICT RESOLUTION)

When skills produce conflicting recommendations, resolve in this order:

## 1. Security & Safety
→ `security-hardening-auditor`
→ `backend-systems-auditor`
→ `nigerian-fintech-compliance-architect` (for TaxBridge financial operations)

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
→ `backend-domain-model-architect` (business invariants)

---

# REGISTRY NOTES

The suite includes 34 skills spanning editor setup, design systems, accessibility,
motion, backend domain modeling, API contracts, edge caching, release safety, observability,
AI workflows, multi-agent orchestration, Nigerian fintech compliance, real-time systems,
and data visualization.

**Cluster breakdown:**
- Cluster 1 — Editor & Environment (6 skills)
- Cluster 2 — Frontend Design (7 skills: includes `motion-interaction-architect`)
- Cluster 3 — Backend Engineering (9 skills)
- Cluster 4 — Application Layer (6 skills)
- Cluster 5 — Mobile & Meta (2 skills)
- Cluster 6 — Vertical Intelligence (2 skills: `nigerian-fintech-compliance-architect`, `multi-agent-orchestration-architect`)
- Cluster 7 — Real-Time & Data (2 skills: `real-time-systems-architect`, `data-visualization-architect`)

The best results come from skill composition, not from forcing one skill to cover the whole
problem. NEXUS routes to the smallest effective graph and keeps the order explicit.

---

# MOTION SKILL DISAMBIGUATION

Two motion skills exist with distinct, non-overlapping roles:

| Skill | Role |
|---|---|
| `motion-performance-architect` | **Strategy**: motion budget, performance measurement, compositing rules, anti-patterns |
| `motion-interaction-architect` | **Implementation**: Framer Motion APIs, code patterns, token system, animation catalog |

Always load `motion-performance-architect` first (sets constraints), then `motion-interaction-architect`
for implementation. Both may be active simultaneously for complex animation work.

---

# PROJECT CONSTRAINTS (NON-NEGOTIABLE)

- No unnecessary rewrites — optimize incrementally unless the system is broken
- Preserve architecture unless an explicit rewrite is requested
- Avoid overengineering — add complexity only when it earns its maintenance cost
- Maintain Next.js 15 + React 19 compatibility at all times
- Prefer RSC + streaming patterns over client-side data fetching
- Effect-TS Layer discipline is mandatory for all backend services
- BullMQ workers must use separate `ioredis` connections per role (Queue / Worker / QueueEvents)
- `maxTsServerMemory` must not exceed 3072 (half of 8GB system RAM)
- Edge Runtime routes must not use Node.js-only modules (no `jsonwebtoken`)
- SwarmX agents must be stateless between turns — no in-memory state persistence
- TaxBridge financial operations require idempotency keys on every write

---

# OBSERVABILITY RULE

If any system-level change is made:

- Evaluate telemetry impact — does this require new spans or metrics?
- Validate performance implications — does this add latency to the hot path?
- Ensure no silent regressions — what breaks without a visible signal?
- For real-time systems: verify WebSocket/SSE connections are tracked and bounded
- For SwarmX agents: verify agent invocation spans propagate trace context to LLM calls
- For TaxBridge: verify FIRS API call latency is tracked with dedicated metric label
