---
name: edge-cache-architecture-architect
description: >
  Designs cache-aware, edge-friendly web architectures for Next.js, serverless, and CDN
  environments. Use this skill when choosing between static, dynamic, ISR, PPR, route handlers,
  middleware, edge runtime constraints, personalization boundaries, and cache invalidation
  strategies. It helps transform vague "make it faster" requests into deliberate caching and
  rendering decisions that are safe for production.
---

# Edge Cache Architecture Architect

Build a rendering and caching strategy that matches the volatility of the data, the specificity
of the user, and the latency budget of the product.

## Core principles

- Cache by intent, not by accident.
- Separate shared content from user-specific fragments.
- Make invalidation explicit.
- Keep edge runtime code free of Node-only assumptions.
- Optimize for the critical path first, then for personalization.

## Workflow

1. Classify each data source by volatility, sensitivity, and audience specificity.
2. Decide which surfaces should be static, revalidated, or fully dynamic.
3. Assign the right cache layer: data cache, route cache, router cache, or CDN.
4. Identify invalidation events before writing the implementation.
5. Verify edge/runtime compatibility for every imported module.
6. Review cold-start, serialization, and header behavior.
7. Check that route handlers, middleware, and server components agree on freshness.

## Patterns

- Static shell + dynamic islands for personalization.
- Explicit cache tags for data that is invalidated by business events.
- Stale-while-revalidate behavior for content that tolerates brief staleness.
- Edge middleware for lightweight routing, not heavy business logic.
- Prefetch only where it meaningfully improves perceived speed.
- Split expensive personalization from globally cacheable chrome.

## Quality gates

- Every fetch has an explicit caching decision.
- The app never accidentally turns dynamic because of a shared layout or root call.
- Edge routes do not import Node-only APIs.
- Invalidation paths are documented and testable.
- Personal data is never leaked into a cache intended for shared content.

## Pair this skill with

- `nextjs-performance-architect` for RSC, PPR, and cache semantics.
- `security-hardening-auditor` for header strategy and sensitive data boundaries.
- `backend-systems-auditor` for correctness under real traffic.
- `opentelemetry-observability-architect` to verify the latency and cache hit impact.

## Reference mindset

Use the current Next.js caching model, PPR guidance, and edge runtime constraints as your baseline. The best cache is the one that is explicit, measurable, and easy to invalidate.
