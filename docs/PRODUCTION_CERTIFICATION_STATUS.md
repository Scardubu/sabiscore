# SabiScore Production Certification Status

Last updated: 2026-06-29

This document records the evidence-backed state of the `codex/final-production-certification` branch. It must not be interpreted as a release declaration until every mandatory gate is green.

## Completed frontend hardening

- One responsive application shell with keyboard skip navigation and 44px touch targets.
- Centralized six-verdict presentation contract.
- Five-provider evidence visibility in the intelligence dashboard.
- Calibrated probability-versus-market bars and derived edge display.
- Quarter-Kelly concrete bankroll guidance capped at 5%.
- Backend-derived readiness health endpoint; no static accuracy or uptime claims.
- Node.js 22 pinned for canonical Vercel and CI builds.
- Canonical Vercel preview, web lint, typecheck, tests, and optimized build pass.

## Completed backend quality gates

- Ruff source and test lint passes after explicit structural cleanup.
- Bare exception handlers in the certified paths now use scoped exception types.
- Intentional compatibility/bootstrap imports are documented instead of globally ignored.
- MyPy diagnostics are captured as a downloadable CI artifact while remaining gate-blocking.

## Active certification work

- MyPy type errors are the current backend veto.
- Full backend tests, Alembic upgrade, OpenAPI checks, Docker Compose startup, and Playwright smoke tests remain gate-blocking until verified green.
- The branch must not be merged to `master` while any critical or high-severity gate is red or unverified.
