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

## Completed backend quality work

- Ruff source and test lint passes after explicit structural cleanup.
- Bare exception handlers in the certified paths now use scoped exception types.
- Intentional compatibility/bootstrap imports are documented instead of globally ignored.
- The enabled production runtime graph has an explicit MyPy manifest covering API startup, fixture intelligence, schemas, verdict services, and provider orchestration.
- Core odds, provider registry, betting-intelligence, and provider-orchestration type contracts are explicit without changing public runtime behavior.
- Runtime and Alembic normalize plain PostgreSQL URLs to the installed Psycopg 3 driver, with regression coverage for plain, async, explicit, and SQLite URLs.
- Revision 0003 widens Alembic's internal version column before recording its long revision identifier, with ordering regression coverage.
- Alembic upgrade reaches head successfully on PostgreSQL 15.
- Legacy scraper fallbacks now stop when verified source data is unavailable.
- API-facing feature dictionaries normalize float32 values to six decimals while preserving float32 model arrays.
- Scraper import cleanup is applied after removing obsolete fallback code.

## Active certification work

- The clean full backend suite is the next mandatory gate after the final lint cleanup.
- OpenAPI checks, Docker Compose startup/image builds, and Playwright desktop/mobile smoke tests remain gate-blocking until verified green.
- Vercel Git integration is temporarily build-rate-limited after the rapid certification commit sequence; the last pre-limit canonical build was green.
- The branch must not be merged to `master` while any critical or high-severity gate is red or unverified.
