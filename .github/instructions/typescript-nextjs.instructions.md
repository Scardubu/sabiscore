---
applyTo: "**/*.{ts,tsx}"
---

# TypeScript / Next.js Rules

These rules apply automatically to all TypeScript and TSX files.
They are non-negotiable and complement `copilot-instructions.md`.

---

## React Version Lock (apps/web)

- `apps/web` is pinned to **React 18.3.1** — do NOT bump to React 19.
- React 19 is NOT a drop-in change. It requires an explicit planned upgrade session.
- `apps/web` uses React 18 patterns: do NOT use React 19 APIs (`use()`, form actions, etc.) here.
- TaxBridge / Hashablanca verticals use React 19 — different rules apply there.

## Next.js App Router (apps/web)

- Prefer RSC + streaming patterns over client-side data fetching.
- `maxTsServerMemory` ≤ 3072 (8 GB system has 8192 MB; cap at half).
- Cache: `Cache-Control: no-store` on ALL evidence and decision endpoints.
- CSP: set per-request in `apps/web/src/middleware.ts` with `script-src` nonce + `'strict-dynamic'`.
  - NEVER move CSP to static `next.config.js` — Next.js inline bootstrap/RSC scripts require per-request nonce.
- Edge Runtime routes: MUST NOT use Node.js-only modules (no `jsonwebtoken`, no `fs`, no `crypto` Node built-in).

## Provider Traffic (SabiScore Frontend — ABSOLUTE)

- ZERO direct provider calls from Next.js routes or components.
- ALL provider traffic proxied via `SABISCORE_BACKEND_URL`.
- NEVER import TensorFlow.js or execute models in the browser.
- NEVER expose provider API secrets via `NEXT_PUBLIC_*` variables.
- Validate all proxy parameters with Zod before forwarding to backend.

## Credential Safety

- Zero `NEXT_PUBLIC_*` provider key variables.
- ESPN is keyless — no `ESPN_API_KEY` anywhere in frontend code.
- No provider credentials in Next.js environment at all.

## SabiScore UI Constraints (apps/web /intelligence page)

Prohibited UI terms (never use these strings):
- `lock` · `banker` · `guaranteed` · `sure bet` · `free money` · `execute immediately`

Language must remain quiet and analytical — no promotional betting copy.

## Effect-TS (TaxBridge / Hashablanca / SwarmX backends)

- Effect-TS Layer discipline is mandatory for all Fastify backend services.
- Never bypass the Layer system with direct service instantiation.
- `acquireRelease` for all connection-lifecycle resources.
- Fiber supervision for all concurrent operations.

## BullMQ (TaxBridge / SwarmX)

- Workers must use **separate `ioredis` connections** per role: Queue / Worker / QueueEvents.
- NEVER share a single ioredis connection across roles.
- TaxBridge financial writes require idempotency keys at every database boundary.

## SwarmX Agents

- Agents are stateless between turns — NEVER persist in-memory state between invocations.
- No agent-to-agent direct calls — route through the orchestrator bus.

## pnpm / Monorepo

- `pnpm-lock.yaml` is canonical — NEVER create or commit `package-lock.json`.
- Use `pnpm --filter <package>` for package-scoped commands.
- Workspace dependencies declared with `workspace:*`.

## Zod Validation

- Validate all external inputs (proxy params, API request bodies, webhook payloads) with Zod.
- For SabiScore: `validateFixtureId()` pattern using `z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)`.

## TypeScript Strictness

- Strict mode always on — no `any` without explicit typed wrapper.
- No `@ts-ignore` — use `@ts-expect-error` with an explicit comment if unavoidable.
- Path aliases must be configured in both `tsconfig.json` AND the bundler config.

## Betting Intelligence Types (apps/web)

The canonical shape for `MatchAnalysisResult`:
```typescript
{
  critical_gaps?: string[];   // blocks analysis → render in red
  advisory_gaps?: string[];   // reduces confidence → render in amber
  conflicts?: string[];       // provider-level conflicts
}
```

Kelly fraction: `KELLY_FRACTION = 0.25` (quarter-Kelly). MAX stake = 0.05 (5%).

## Suggested Skills (attach to Copilot Chat for this domain)

```
#file:.ai/skills/nextjs-performance-architect/SKILL.md
#file:.ai/skills/security-hardening-auditor/SKILL.md
#file:.ai/skills/component-quality-gate/SKILL.md
#file:.ai/skills/effect-ts-layer-architect/SKILL.md
#file:.ai/skills/typescript-config-surgeon/SKILL.md
#file:.ai/skills/design-token-system-architect/SKILL.md
```
