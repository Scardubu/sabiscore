---
name: audit
description: >
  Run a full production readiness audit on the current file, directory, or named target.
  Invokes backend-systems-auditor for service code, component-quality-gate for React
  components, security-hardening-auditor for auth/header surfaces, and
  nigerian-fintech-compliance-architect for TaxBridge financial code. Produces a
  structured report with Critical / Important / Improvement tiers. Triggers on /audit
  or "audit this", "review for production", "is this production-ready".
argument-hint: [file, directory, or service name — defaults to current context]
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(cat:*), Bash(find:*)
user-invocable: true
---

## Audit Target

**Target:** $ARGUMENTS

**Files to audit:**
!`if [ -n "$ARGUMENTS" ]; then find "$ARGUMENTS" -type f 2>/dev/null | grep -E '\.(ts|tsx|js|jsx|md)$' | head -20; else git diff --name-only HEAD 2>/dev/null | head -10; fi`

---

Execute a surgical production audit across all applicable dimensions.

### 1. Determine Audit Scope

Inspect the target and classify which audit dimensions apply:

| Dimension | Apply when |
|---|---|
| `backend-systems-auditor` | Fastify routes, service files, BullMQ workers, Prisma queries |
| `component-quality-gate` | React/TSX components, hooks, layouts |
| `security-hardening-auditor` | Auth routes, middleware, headers, environment handling |
| `nigerian-fintech-compliance-architect` | VAT/CIT/WHT computation, FIRS API calls, TIN/BVN validation |
| `opentelemetry-observability-architect` | Any service with external calls or queues |
| `typescript-config-surgeon` | tsconfig.json, ESLint config, path aliases |
| `prisma-database-architect` | Schema files, migration files, Prisma queries |

### 2. Run Each Applicable Skill

For each applicable dimension, apply the full protocol from that skill and report findings.

### 3. Output Format

```
## Audit Report: [Target Name]
Generated: [date]

### 🔴 Critical (block deployment)
- [Finding] | [Location] | [Risk] | [Fix]

### 🟡 Important (fix within sprint)
- [Finding] | [Location] | [Risk] | [Fix]

### 🔵 Improvements (fix when convenient)
- [Finding] | [Location] | [Benefit] | [Fix]

### ✅ Passing
- [Criterion]: [Why it passes]

### Scores
| Dimension | Score |
|---|---|
| Idempotency | X/10 |
| Observability | X/10 |
| Shutdown Safety | X/10 |
| Accessibility | X/10 |
| Security | X/10 |
```

### 4. Produce Corrected Code

For every Critical finding, produce the corrected implementation with inline comments marking every change.
