---
name: api-contract-governance-architect
description: >
  Defines and governs API contracts with contract-first discipline, explicit schemas,
  compatibility strategy, idempotency rules, error shapes, and versioning policy. Use this
  skill when designing REST or webhook surfaces, validating request/response schemas, preparing
  OpenAPI documents, or preventing accidental breaking changes across frontend, mobile, and
  service consumers.
---

# API Contract Governance Architect

The contract is the product boundary. Treat it as a first-class artifact, not a side effect of
implementation.

## Core principles

- Contract first, implementation second when the surface is shared.
- Validation belongs at the edge of the system.
- Backward compatibility is a requirement, not a nice-to-have.
- Errors must be predictable and machine-readable.
- Idempotency and pagination rules should be explicit from day one.

## Workflow

1. Define the resource model and the consumer needs.
2. Draft the request and response schema, including errors.
3. Specify authentication, rate limiting, and idempotency semantics.
4. Decide how pagination, filtering, sorting, and partial updates work.
5. Version only when compatibility cannot be preserved.
6. Add schema-driven tests and examples.
7. Document deprecations and sunset paths before rollout.

## Patterns

- OpenAPI for REST contracts.
- JSON Schema for runtime validation.
- Webhook signatures and replay protection for inbound events.
- Cursor pagination for mutable datasets.
- Stable error envelopes with codes, messages, and field-level detail.
- Explicit allowlists for accepted input shape.

## Quality gates

- No undocumented fields are emitted.
- No breaking change ships without a migration plan.
- Consumers can generate types or clients from the contract.
- Validation failures are deterministic and explainable.
- Retries cannot create duplicate side effects.

## Pair this skill with

- `backend-domain-model-architect` for the business semantics.
- `backend-systems-auditor` for safety and production readiness.
- `effect-ts-layer-architect` for typed request flow and error discipline.
- `api-automation-architect` for external integrations and retries.

## Reference mindset

Use the discipline of schema-driven systems, Fastify request lifecycle hooks, and OpenAPI-style contracts. A good API surface protects both the producer and the consumer from ambiguity.
