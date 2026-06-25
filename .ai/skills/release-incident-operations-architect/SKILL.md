---
name: release-incident-operations-architect
description: >
  Designs safer release, rollback, and incident workflows for production systems. Use this
  skill when introducing feature flags, canaries, progressive delivery, kill switches, migration
  sequencing, release notes, incident response steps, or post-release monitoring requirements.
  It turns shipping into an observable, reversible process instead of a one-way event.
---

# Release & Incident Operations Architect

Production work is not complete when the code compiles. It is complete when the change can be
shipped, observed, rolled back, and explained.

## Core principles

- Every meaningful release needs a rollback plan.
- Blast radius should be intentionally small.
- Monitoring must verify the intended outcome, not just the absence of crashes.
- Migrations and code changes should be safe in either rollout order when possible.
- Incident response should be rehearsed, not improvised.

## Workflow

1. Identify the failure modes and blast radius before shipping.
2. Decide whether the change should be gated by a flag, staged rollout, or both.
3. Verify data migrations, background jobs, and caches for compatibility.
4. Write the rollout checklist and the rollback checklist together.
5. Confirm observability signals that prove the feature is healthy.
6. Define who owns the release and who responds if it misbehaves.
7. Capture the learning in a postmortem or release note.

## Patterns

- Feature flags for risk isolation and staged enablement.
- Canary releases for real traffic validation.
- Dark launches for safe backend readiness checks.
- Kill switches for emergency disablement.
- Forward-and-backward compatible migrations.
- Health checks and SLO-linked alerting for key user journeys.

## Quality gates

- A bad release can be stopped or reverted quickly.
- Production data is protected during partial rollout states.
- The team knows what signal indicates success or failure.
- Operational steps are documented where the change lands.
- Post-incident learning feeds back into the deployment workflow.

## Pair this skill with

- `git-workflow-architect` for CI/CD and release hygiene.
- `testing-strategy-architect` for pre-release confidence.
- `opentelemetry-observability-architect` for signals and alerting.
- `backend-systems-auditor` for production-readiness review.

## Reference mindset

Treat release engineering as part of product engineering. The best deployment is reversible, measurable, and boring.
