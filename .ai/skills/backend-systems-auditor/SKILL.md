---
name: backend-systems-auditor
description: >
  Audits backend architectures, APIs, and service designs against production-grade engineering
  standards: idempotency contracts, observability-first design (traces/metrics/logs),
  graceful shutdown sequences, database migration discipline (expand-migrate-contract), and
  event sourcing correctness. Use this skill whenever a user asks to review backend code,
  audit an API design, check a database schema, review a migration strategy, evaluate service
  reliability, check graceful shutdown logic, or asks "is my backend production-ready",
  "review this API", "audit my service architecture", "is this migration safe", "how do I
  add observability", "will this scale", or shares a Fastify/Express/Node/Python service for
  review. Always use this skill for backend architecture review — don't improvise without it.
---

# Backend Systems Auditor

Audit any backend service, API, or architecture against production engineering standards.
Every finding is specific, every recommendation is actionable, every risk is quantified.

## Audit Dimensions

### 1. Idempotency
The contract: calling an operation N times produces the same result as calling it once.

Check for:
- [ ] All POST/PUT/DELETE endpoints accept and honor idempotency keys
- [ ] Database writes are wrapped in upserts or conditional inserts (not blind inserts)
- [ ] Job/queue processors deduplicate before executing
- [ ] Payment and financial operations have explicit idempotency enforcement
- [ ] Retry logic cannot produce duplicate side effects

### 2. Observability
The contract: any production incident can be diagnosed from logs, metrics, and traces alone.

Check for:
- [ ] Structured JSON logging (no string concatenation logs)
- [ ] Trace context propagated across service boundaries (W3C TraceContext headers)
- [ ] One span per external call (database, HTTP, cache, queue)
- [ ] Metrics: request rate, error rate, p50/p95/p99 latency per endpoint
- [ ] Health check endpoint: `/health` (liveness) and `/ready` (readiness) separated
- [ ] Error logs include: error class, message, stack, request ID, user context

### 3. Graceful Shutdown
The contract: the process drains cleanly on SIGTERM before exiting.

Correct sequence:
```
SIGTERM received
  → Stop accepting new requests (close server)
  → Wait for in-flight requests to complete (drain)
  → Complete active queue jobs (finish, don't re-queue)
  → Release database connections (pool.end())
  → Flush telemetry (otel.shutdown())
  → Exit 0
```

Check for:
- [ ] `process.on('SIGTERM', ...)` handler present
- [ ] Server close waits for connections to drain (not immediate `process.exit()`)
- [ ] Database pool properly closed in shutdown handler
- [ ] Queue workers acknowledge or re-queue jobs on shutdown
- [ ] Kubernetes `preStop` hook and `terminationGracePeriodSeconds` configured correctly

### 4. Database Migration Discipline
The contract: schema changes are always backward-compatible during deployment.

Expand-Migrate-Contract ceremony:
```
Deploy 1 — Expand:  Add new column/table (nullable or with default). Old code still works.
Deploy 2 — Migrate: Backfill data. Run dual-write if needed.
Deploy 3 — Contract: Remove old column/table. New code now required.
```

Check for:
- [ ] No `NOT NULL` columns added without a default in a single migration
- [ ] No column renames in a single migration (add new + copy + drop old)
- [ ] No table drops without a prior deprecation period
- [ ] Migrations are irreversible by design (rollback = forward migration)
- [ ] Long-running migrations use batching, not full-table locks

### 5. API Design
Check for:
- [ ] Consistent error response shape across all endpoints
- [ ] HTTP status codes semantically correct (201 for creation, 422 for validation, 409 for conflict)
- [ ] Pagination on all list endpoints (cursor-based preferred over offset for large datasets)
- [ ] Rate limiting headers present (`X-RateLimit-Limit`, `Remaining`, `Reset`)
- [ ] Authentication errors always 401, authorization errors always 403 (never swapped)
- [ ] No sensitive data in URLs (tokens, passwords — use request body or headers)

### 6. Reliability & Scalability
- [ ] No synchronous blocking calls in async hot paths
- [ ] No N+1 queries (use `include`/joins or DataLoader patterns)
- [ ] No unbounded queries (always `LIMIT` on queries that could return large sets)
- [ ] Background jobs for any operation > 500ms (email, PDF, external API calls)
- [ ] Timeouts on all outbound HTTP calls
- [ ] Connection pool sized correctly for expected concurrency

## Protocol

### Step 1 — Intake

Accept: service code, API route files, schema/migration files, architecture description, or a GitHub repo excerpt.

Ask if needed: **"What's the deployment target and expected load?"** (affects scaling recommendations)

### Step 2 — Audit Report

```
## Backend Audit: [Service/API Name]

### 🔴 Critical (production risk — fix before shipping)
- [Finding]: [Specific location] → [Risk] → [Fix]

### 🟡 Important (reliability risk — fix within sprint)
- [Finding]: [Specific location] → [Risk] → [Fix]

### 🔵 Improvements (quality — fix when convenient)
- [Finding]: [Specific location] → [Benefit] → [Fix]

### ✅ Passes
- [Criterion]: [Why it passes]

### Observability Score: [0–10]
### Idempotency Score: [0–10]
### Shutdown Safety Score: [0–10]
```

### Step 3 — Corrected Code

For critical findings, produce the corrected implementation with inline comments marking every change:
```typescript
// ← BEFORE: process.exit(0)
// ← AFTER: drain in-flight requests first
await server.close()
await db.$disconnect()
process.exit(0)
```

### Step 4 — Migration Safety Review

For any schema change, produce:
1. Is this a breaking change? Yes/No + why
2. Correct migration sequence (Expand → Migrate → Contract breakdown)
3. Estimated lock duration on the database
4. Rollback strategy

## Quality Gates (what a passing audit looks like)

- Zero `console.log` in production code paths (use structured logger)
- Zero unhandled promise rejections
- Zero missing idempotency keys on write operations
- Graceful shutdown handler present and correct
- All endpoints have documented error responses
- No migration adds a NOT NULL column without a default in a single step

## Activation Triggers

- "Review / audit my backend / API / service"
- "Is this production-ready?"
- "Is this migration safe?"
- "How do I add observability to my service?"
- "Will this scale?"
- "Check my graceful shutdown logic"
- "Review my Fastify / Express / Hono routes"
- "Audit my Prisma schema / migrations"
- "Is my API design correct?"

## Skill Chain

**Feeds into**: `opentelemetry-observability-architect` (audit findings reveal what needs instrumentation) → `prisma-database-architect` (N+1 and slow query findings surface here).

**Creative combination**: Run `backend-systems-auditor` as the gate before any deployment. Feed its critical findings to `prisma-database-architect` (schema/query issues), `bullmq-job-architect` (sync operations that need queuing), and `opentelemetry-observability-architect` (anything that needs visibility). The audit becomes a deployment checklist.

## Creative Combinations

**The "Deployment Gate" pattern**: Run `backend-systems-auditor` as a required pre-deploy check in `git-workflow-architect`'s CI. Any critical finding blocks the merge. Audit becomes infrastructure.

**The "Observability Bootstrap" pattern**: After `backend-systems-auditor` flags missing observability, immediately chain `opentelemetry-observability-architect`. The audit tells you *what* needs watching; OTel tells you *how* to watch it. Two skills that close the production readiness loop.
