---
name: effect-ts-layer-architect
description: >
  Designs, audits, and generates production-grade Effect-TS code using correct Layer discipline,
  Fiber supervision, structured concurrency, and acquireRelease lifecycle patterns. Use this skill
  whenever a user is working with Effect-TS or the Effect library, asks about Layers, Services,
  Fibers, Scope, acquireRelease, Effect.gen, pipe, or structured concurrency in TypeScript. Also
  triggers for questions like "how do I structure my Effect layers", "model this service with
  Effect", "how do I handle errors in Effect-TS", "convert this to Effect", or any code that
  imports from the 'effect' package. Always use this skill for Effect-TS architecture questions
  — don't answer from general knowledge without it.
---

# Effect-TS Layer Architect

Produce correct, idiomatic Effect-TS code using full Layer discipline. Every service has a
clear acquisition strategy, a defined lifetime, and a typed error channel.

## Core Concepts Reference

### Layer Taxonomy

| Constructor | Use when |
|---|---|
| `Layer.succeed(Tag, impl)` | Stateless service, no setup needed |
| `Layer.effect(Tag, Effect)` | Stateful service, setup required, no cleanup |
| `Layer.scoped(Tag, Effect)` | Service with cleanup (`acquireRelease`) |
| `Layer.provide(layer, deps)` | Hide a layer's dependencies from callers |
| `Layer.merge(a, b)` | Combine independent infrastructure layers |
| `Layer.provideMerge` | Merge + expose dependencies |

### Service Definition Pattern

```typescript
// 1. Define the interface
interface DatabaseService {
  readonly query: (sql: string) => Effect.Effect<Row[], DatabaseError>
}

// 2. Create the Tag
const DatabaseService = Context.GenericTag<DatabaseService>("DatabaseService")

// 3. Implement the Live layer
const DatabaseLive = Layer.scoped(
  DatabaseService,
  Effect.acquireRelease(
    Effect.tryPromise(() => connect(config)).pipe(
      Effect.mapError(e => new DatabaseError({ cause: e }))
    ),
    (conn) => Effect.promise(() => conn.close())
  ).pipe(
    Effect.map(conn => ({
      query: (sql) => Effect.tryPromise(() => conn.query(sql)).pipe(
        Effect.mapError(e => new DatabaseError({ cause: e }))
      )
    }))
  )
)

// 4. Test layer
const DatabaseTest = Layer.succeed(DatabaseService, {
  query: (_sql) => Effect.succeed([])
})
```

## Protocol

### Step 1 — Classify the Request

Identify which pattern applies:
- **New service design**: User wants to model a domain service with Effect
- **Layer wiring**: User wants to compose services into an application layer
- **Error modeling**: User wants to type their error channel correctly
- **Migration**: User has Promise/async code to convert to Effect
- **Concurrency**: User needs Fiber supervision, racing, or parallel execution
- **Audit**: User has existing Effect code to review

### Step 2 — Generate or Audit

#### For new service design:
1. Define the service interface (what it exposes)
2. Choose the correct Layer constructor (see taxonomy above)
3. Implement Live layer with proper error typing
4. Implement Test/mock layer with `Layer.succeed`
5. Show the composition at the app entry point

#### For Layer wiring:
1. Map all services and their dependencies
2. Produce a dependency graph (text diagram)
3. Compose using `Layer.provide` and `Layer.merge`
4. Show `Effect.runPromise(program.pipe(Effect.provide(AppLayer)))`

#### For error modeling:
1. Define tagged error classes with `Data.TaggedError`
2. Show typed error channels at each layer boundary
3. Demonstrate `Effect.catchTag`, `Effect.catchAll`, `Effect.orElse`

#### For migration (Promise → Effect):
1. Wrap with `Effect.tryPromise` (for async that can fail)
2. Wrap with `Effect.promise` (for async that won't fail)
3. Wrap sync with `Effect.try` / `Effect.sync`
4. Replace `async/await` chains with `Effect.gen`

#### For Fiber supervision / concurrency:
- `Effect.fork` + `Fiber.join` for background work
- `Effect.all([...], { concurrency: N })` for bounded parallelism
- `Effect.race` for competing effects, first wins
- `Supervisor` for lifecycle-managed fiber trees
- `Effect.timeout` + `Effect.retry` for resilience

### Step 3 — Output Format

Always produce:
1. **Working TypeScript** — compiles under strict mode, no `any`, no type assertions
2. **Import block** — complete, using `effect` package named imports
3. **Inline comments** — explain *why* each Layer choice was made
4. **Test layer** — always include a `*Test` layer alongside `*Live`
5. **Composition snippet** — show how this integrates at the app boundary

## Quality Gates

- No `Effect.runSync` inside async contexts
- No floating Fibers (every fork has a join or supervision)
- Every service has a typed error channel (no `never` by accident)
- `acquireRelease` used for any resource with a close/disconnect/cleanup
- `Layer.provide` used to hide internal deps from callers
- Test layers always present alongside Live layers

## Activation Triggers

- "How do I structure this service with Effect-TS?"
- "Convert this async function to Effect"
- "Model [database/cache/queue/HTTP client] with Effect layers"
- "How do I handle errors in Effect?"
- "Wire up my application layers"
- "Run two Effects in parallel with Effect-TS"
- "How do I test Effect services?"
- "What's the difference between Layer.effect and Layer.scoped?"

## Skill Chain

**Feeds into**: `backend-systems-auditor` (Effect layers expose idempotency and shutdown contracts for audit) → `api-automation-architect` (Effect patterns map directly to resilient API workflow design) → `bullmq-job-architect` (Effect Fibers and BullMQ workers are natural structural equivalents).

**Creative combination**: Model the service with `effect-ts-layer-architect`, wire its external API calls with `api-automation-architect` using Effect-wrapped retry/circuit breaker patterns, then push long-running operations to queues designed with `bullmq-job-architect`. A fully Effect-native backend.
