---
name: backend-domain-model-architect
description: >
  Shapes business logic into bounded contexts, aggregates, invariants, and explicit use
  cases using Effect-TS for typed service composition. Use this skill when modeling new
  backend domains, extracting a fat controller into a coherent service layer, deciding on
  transactional boundaries, translating a messy product requirement into durable server-side
  design, or implementing domain events with Effect-TS Layers. Triggers: "model this domain",
  "bounded context", "aggregate", "domain event", "invariant", "use case layer", "domain
  service", "business rules", "DDD", "design the service layer". Always use this skill before
  writing any route handler — controllers orchestrate, they don't contain business logic.
---

# Backend Domain Model Architect

Good backend architecture begins with the business language. The code makes the domain
easier to reason about than the spreadsheet or meeting notes that inspired it.

## Core Principles

- Model the business vocabulary explicitly — the code IS the documentation.
- Protect invariants at the domain boundary, not in the controller.
- Keep side effects out of pure domain decisions.
- Choose transaction boundaries intentionally — one aggregate = one transaction.
- Prefer clear consistency rules over hidden coupling.
- Make commands idempotent where retries are possible.
- Model what CAN'T happen as aggressively as what CAN.

---

## Workflow

### Step 1 — Extract Bounded Contexts
Define the language boundaries before writing any code:

```
TaxBridge bounded contexts:
  TaxComputation  → VAT, CIT, WHT calculation rules, rate codes
  FIRSCompliance  → e-invoicing, submission, audit trail
  BusinessProfile → CAC registration, TIN, BVN
  PaymentReceipt  → receipt ingestion, OCR, line-item extraction

SabiScore bounded contexts:
  MatchIntelligence → ML predictions, confidence scores, anomaly detection
  DataIngestion     → event stream normalization, source validation
  AlertEngine       → threshold triggers, user notifications
```

### Step 2 — Write the Glossary
Before schema or code:
```
// TaxBridge glossary
TIN           — 11-digit Tax Identification Number, unique per Nigerian taxpayer
VATReturn     — Monthly/quarterly VAT declaration; immutable once filed
TaxableSupply — Transaction subject to standard 7.5% VAT rate
ZeroRated     — VAT-applicable but at 0% (exports, basic food items)
Exempt        — Outside VAT scope (certain financial services, education)
WHT           — Withholding Tax; deducted at source by payers, remitted to FIRS
```

### Step 3 — Define the Type Model (Effect-TS + TypeScript)

```typescript
// domain/tax-computation/types.ts
import { Data, Schema } from 'effect'

// Value Objects — immutable, equality by value
export class TIN extends Schema.Class<TIN>('TIN')({
  value: Schema.String.pipe(Schema.pattern(/^\d{11}$/, { message: 'TIN must be 11 digits' }))
}) {}

export class TaxAmount extends Schema.Class<TaxAmount>('TaxAmount')({
  value:    Schema.NonNegative,
  currency: Schema.Literal('NGN'),
}) {
  static fromNaira(amount: number) {
    return new TaxAmount({ value: amount, currency: 'NGN' })
  }
}

export class VATRate extends Schema.Class<VATRate>('VATRate')({
  percentage: Schema.Union(Schema.Literal(0), Schema.Literal(7.5)),
  rateType:   Schema.Union(
    Schema.Literal('standard'),
    Schema.Literal('zero-rated'),
    Schema.Literal('exempt'),
  ),
}) {}

// Aggregate — the consistency boundary
export class TaxableTransaction extends Data.Class<{
  id:              string
  tin:             TIN
  grossAmount:     TaxAmount
  vatRate:         VATRate
  transactionDate: Date
  status:          'pending' | 'computed' | 'submitted' | 'amended'
}> {
  // Invariant enforcement — bad states are unrepresentable
  computeVAT(): TaxAmount {
    if (this.vatRate.rateType === 'exempt') {
      return TaxAmount.fromNaira(0)
    }
    return TaxAmount.fromNaira(
      this.grossAmount.value * (this.vatRate.percentage / 100)
    )
  }

  // Commands always return new state — never mutate
  markSubmitted(): TaxableTransaction {
    if (this.status !== 'computed') {
      throw new Error(`Cannot submit transaction in status: ${this.status}`)
    }
    return new TaxableTransaction({ ...this, status: 'submitted' })
  }
}
```

### Step 4 — Domain Services (Effect-TS Layers)

```typescript
// domain/tax-computation/service.ts
import { Effect, Layer } from 'effect'

// Service interface — the public contract
export class TaxComputationService extends Effect.Service<TaxComputationService>()(
  'TaxComputationService',
  {
    effect: Effect.gen(function* () {
      // Dependencies resolved via Layer injection
      const db   = yield* DatabaseService
      const firs = yield* FIRSApiService

      return {
        computeVATReturn: (
          tin:    TIN,
          period: TaxPeriod,
        ): Effect.Effect<VATReturn, TaxComputationError> =>
          Effect.gen(function* () {
            // 1. Fetch all taxable transactions for the period
            const transactions = yield* db.getTransactions({ tin, period })

            // 2. Pure domain computation — no IO
            const vatComputation = transactions.reduce<VATAccumulator>(
              (acc, tx) => ({
                outputVAT: acc.outputVAT + tx.computeVAT().value,
                inputVAT:  acc.inputVAT  + (tx.isInputCredit ? tx.computeVAT().value : 0),
              }),
              { outputVAT: 0, inputVAT: 0 }
            )

            const netVAT = vatComputation.outputVAT - vatComputation.inputVAT

            // 3. Enforce business invariant: net VAT cannot be negative for standard filers
            if (netVAT < 0 && !(yield* isExcessCreditFiler(tin))) {
              yield* Effect.fail(new TaxComputationError({
                code:    'NEGATIVE_NET_VAT',
                message: 'Net VAT is negative. Verify input credit eligibility.',
              }))
            }

            // 4. Persist computation result (idempotent via upsert)
            return yield* db.upsertVATReturn({ tin, period, netVAT, transactions })
          }),
      }
    }),
  }
) {}
```

### Step 5 — Domain Events

```typescript
// domain/shared/events.ts
import { Data } from 'effect'

// Base event type
export class DomainEvent<T extends string, P> extends Data.Class<{
  type:        T
  aggregateId: string
  occurredAt:  Date
  payload:     P
}> {}

// TaxBridge domain events
export class VATReturnFiled extends DomainEvent<'vat-return.filed', {
  tin:      string
  period:   string
  netVAT:   number
  currency: 'NGN'
}> {}

export class FIRSSubmissionFailed extends DomainEvent<'firs.submission.failed', {
  tin:       string
  returnId:  string
  reason:    string
  retryable: boolean
}> {}

// SabiScore domain events
export class AnomalyDetected extends DomainEvent<'anomaly.detected', {
  matchId:    string
  metric:     string
  deviation:  number
  confidence: number
}> {}

// Publish via BullMQ (outbox pattern — reliability guaranteed)
export class DomainEventPublisher extends Effect.Service<DomainEventPublisher>()(
  'DomainEventPublisher',
  {
    effect: Effect.gen(function* () {
      const queue = yield* BullMQService

      return {
        publish: <T extends string, P>(
          event: DomainEvent<T, P>
        ): Effect.Effect<void, never> =>
          queue.add(event.type, event, {
            jobId: `${event.aggregateId}:${event.occurredAt.toISOString()}`,  // idempotent
          }),
      }
    }),
  }
) {}
```

### Step 6 — Application Service (Orchestration Layer)

```typescript
// application/file-vat-return.ts
// The controller calls this. No business logic lives in the controller.

export const fileVATReturn = (
  input: FileVATReturnInput
): Effect.Effect<VATReturn, TaxComputationError | ValidationError, TaxComputationService | DomainEventPublisher> =>
  Effect.gen(function* () {
    // 1. Validate input at application boundary
    const validated = yield* Schema.decode(FileVATReturnSchema)(input)

    // 2. Call domain service (pure business logic)
    const taxService = yield* TaxComputationService
    const vatReturn  = yield* taxService.computeVATReturn(validated.tin, validated.period)

    // 3. Publish domain event (side effect, isolated)
    const events = yield* DomainEventPublisher
    yield* events.publish(new VATReturnFiled({
      aggregateId: vatReturn.id,
      occurredAt:  new Date(),
      payload: {
        tin:      validated.tin.value,
        period:   validated.period,
        netVAT:   vatReturn.netVAT,
        currency: 'NGN',
      },
    }))

    return vatReturn
  })

// Fastify route handler — orchestrates, never contains logic
app.post('/api/vat-returns', async (req, reply) => {
  const result = await Effect.runPromise(
    pipe(
      fileVATReturn(req.body),
      Effect.provide(TaxComputationService.Default),
      Effect.provide(DomainEventPublisher.Default),
    )
  )
  return reply.status(201).send(result)
})
```

---

## Domain Model Quality Gates

- [ ] A developer reads the types and understands the business rules without comments
- [ ] No route handler or controller contains core business logic
- [ ] Invariants are enforced in the aggregate, not scattered across services
- [ ] Retryable commands produce the same result when executed N times
- [ ] Schema design follows the domain model — the model was not shaped by the schema
- [ ] All domain events are named in past tense (filed, submitted, detected, failed)
- [ ] Every bounded context has its own explicit error types

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Fat controller | Business logic in route handlers | Extract to application service + domain service |
| Anemic domain | Entities are DTOs with no behavior | Add methods that enforce invariants |
| Transaction script | All logic in one procedural function | Decompose into domain services and aggregates |
| Shared mutable state | Multiple services write to the same row without coordination | Define clear aggregate ownership |
| Schema-first domain | Database schema dictates the domain model | Model domain first; derive schema from model |

---

## Pair This Skill With

- `effect-ts-layer-architect` — Layer composition for service dependency injection
- `prisma-database-architect` — translate domain model to persistence schema
- `api-contract-governance-architect` — expose the domain via typed API contracts
- `backend-systems-auditor` — production readiness audit after domain is modeled
- `nigerian-fintech-compliance-architect` — TaxBridge domain rules, FIRS constraints, rate codes

---

## Activation Triggers

- "Model this domain / business workflow"
- "Bounded context / aggregate / domain event"
- "Extract business logic from my controller"
- "Enforce this invariant"
- "Use case layer / application service"
- "Domain-driven design for [feature]"
- "Design the service layer"
- "How do I model [TaxBridge / SabiScore] with Effect-TS?"
- "Make bad states unrepresentable"
- "Domain events with BullMQ outbox"
