---
name: api-automation-architect
description: >
  Designs and generates production-grade API automation workflows with idempotency guarantees,
  retry logic, circuit breakers, structured error handling, and OpenTelemetry-style observability.
  Use this skill whenever a user wants to automate API calls, build a multi-step API workflow,
  chain external services, handle webhooks reliably, implement retry/backoff logic, add circuit
  breakers, design idempotent operations, or asks things like "automate this API workflow",
  "make this API call resilient", "chain these API calls together", "handle failures in my
  integration", "add retry logic to this", "build a webhook processor", or "design a reliable
  integration with [service]". Always use this skill for API integration design — don't improvise
  production resilience patterns without it.
---

# API Automation Architect

Design reliable, observable, production-hardened API automation workflows. Every integration
is idempotent, every failure is typed, every operation is traceable.

## Resilience Pattern Taxonomy

| Pattern | Use when |
|---|---|
| **Idempotency key** | Operation must be safe to retry without duplication |
| **Exponential backoff** | Transient failures (rate limits, 503s) |
| **Circuit breaker** | Downstream service is degraded; protect it from cascading load |
| **Dead letter queue** | Message/job must not be lost on failure |
| **Saga / compensating txn** | Multi-step workflow that must be reversible |
| **Outbox pattern** | Events must be emitted exactly once alongside DB writes |
| **Webhook idempotency** | Incoming webhooks may be delivered more than once |

## Protocol

### Step 1 — Classify the Workflow

Identify which integration shape applies:

- **Single API call with resilience**: Add retry, timeout, error typing
- **Sequential chain**: A → B → C, each step depends on prior output
- **Fan-out**: One trigger, multiple parallel calls, aggregate results
- **Event-driven**: Webhook ingestion, queue consumption, event processing
- **Long-running**: Job orchestration, polling loops, async status checks
- **Bidirectional sync**: Two systems kept in sync, conflict resolution needed

### Step 2 — Design the Workflow

Produce a workflow design with:

#### A. Operation Contract
```
Input:  [what the workflow receives]
Output: [what it returns on success]
Errors: [typed failure cases]
Side effects: [what external state it modifies]
Idempotency: [how duplicate invocations are handled]
```

#### B. Step-by-Step Flow (text diagram)
```
[Trigger] → [Validate input] → [Check idempotency key]
         → [Call API A] → [Transform] → [Call API B]
         → [Persist result] → [Emit event]
         → [Error] → [Classify] → [Retry / DLQ / Alert]
```

#### C. Resilience Configuration
For each external call, specify:
- **Timeout**: ms value (not "reasonable timeout" — a number)
- **Retry strategy**: max attempts, backoff formula, retryable error codes
- **Circuit breaker**: failure threshold %, recovery timeout
- **Fallback**: what to do when all retries exhausted

### Step 3 — Generate Implementation

Produce TypeScript implementation. Default to these libraries unless user specifies otherwise:
- **HTTP**: `ky` or native `fetch` with abort signals
- **Retry**: `p-retry` or `cockatiel`
- **Circuit breaker**: `cockatiel` CircuitBreaker policy
- **Queue**: BullMQ (if Node.js/Redis is in stack)
- **Observability**: OpenTelemetry spans via `@opentelemetry/api`

#### Standard resilient call wrapper:
```typescript
const resilientCall = async <T>(
  operation: () => Promise<T>,
  options: {
    operationName: string
    maxAttempts?: number       // default: 3
    timeoutMs?: number         // default: 5000
    idempotencyKey?: string
  }
): Promise<Result<T, ApiError>> => {
  const span = tracer.startSpan(options.operationName)
  try {
    const result = await retry(
      () => withTimeout(operation(), options.timeoutMs ?? 5000),
      { retries: options.maxAttempts ?? 3, factor: 2, minTimeout: 500 }
    )
    span.setStatus({ code: SpanStatusCode.OK })
    return Ok(result)
  } catch (err) {
    span.recordException(err as Error)
    span.setStatus({ code: SpanStatusCode.ERROR })
    return Err(classifyError(err))
  } finally {
    span.end()
  }
}
```

### Step 4 — Observability Checklist

Every workflow must emit:
- [ ] Span per external call (name, duration, status)
- [ ] Structured log per retry attempt (attempt number, error, backoff ms)
- [ ] Metric: success rate, p50/p95/p99 latency, circuit breaker state
- [ ] Alert trigger condition: error rate > X% over Y minutes

### Step 5 — Idempotency Implementation

For any write operation (POST, mutation, payment, email send):
```typescript
// 1. Generate deterministic key from inputs
const idempotencyKey = createHash('sha256')
  .update(JSON.stringify({ userId, action, timestamp: dayjs().startOf('hour').toISOString() }))
  .digest('hex')

// 2. Check if already processed
const existing = await redis.get(`idem:${idempotencyKey}`)
if (existing) return JSON.parse(existing)

// 3. Execute and store result
const result = await executeOperation()
await redis.setex(`idem:${idempotencyKey}`, 86400, JSON.stringify(result))
return result
```

## Quality Gates

- No fire-and-forget API calls (every call has timeout + error handling)
- No infinite retry loops (always a max attempt ceiling)
- No silent failures (every error path either retries, alerts, or queues to DLQ)
- Idempotency key present on all write operations
- At least one observability span per external service boundary
- Circuit breakers on all high-volume or critical downstream dependencies

## Activation Triggers

- "Automate this API workflow"
- "Make this API call resilient / reliable"
- "Add retry logic / circuit breaker to this integration"
- "Design an idempotent operation for [action]"
- "Chain these API calls together safely"
- "Build a webhook processor that handles duplicates"
- "How do I handle failures in my [Stripe / Twilio / etc] integration?"
- "Add observability to my API calls"

## Skill Chain

**Feeds into**: `opentelemetry-observability-architect` (every resilient call needs a span) → `bullmq-job-architect` (workflows that exceed 500ms belong in a queue).

**Creative combination**: `api-automation-architect` designs the resilience contract. `effect-ts-layer-architect` wraps it in a typed Layer with structured errors. `opentelemetry-observability-architect` makes every retry and circuit breaker state change visible. Three skills that together make external API calls genuinely production-hardened.
