# Codex Verified Repository State

Last reviewed: 2026-07-04

This is a dated navigation aid, not a substitute for inspecting current code,
tests, Git history, and runtime configuration. Update it only with fresh evidence.

## Confirmed in the supplied control file

- Production entrypoints are `backend/src/api/main.py`, `apps/web`, and
  `apps/scraper`.
- Legacy `apps/api/` and `frontend/` must not be restored to production paths.
- The provider registry and shared lifespan HTTP client are already implemented.
- Browser TensorFlow.js inference was removed; official inference is backend-only.
- Critical and advisory evidence gaps are separated.
- Verdict/watchlist behavior is implemented in two independent engines and must stay
  aligned.
- Quarter-Kelly public sizing and the hard stake cap are already represented.
- Public Full-Kelly fields and `NEXT_PUBLIC_KELLY_FRACTION` are prohibited.
  The current backend schema and web TypeScript contracts expose only capped
  Quarter-Kelly stake fractions; raw Kelly math remains internal audit detail.
- `python -m src.cli providers doctor` and `providers status` use the same
  offline-safe five-state public contract: `configured`, `missing`, `invalid`,
  `quota_exhausted`, or `temporarily_unavailable`. Live validation remains
  explicit via `doctor --validate-live`.
- `backend/src/core/league_policy.py` supports both legacy uppercase league ids
  and canonical internal ids such as `premier_league`, `la_liga`, and `ucl`.
  Missing league policy propagates as `DATA_GAP: LEAGUE_POLICY_UNAVAILABLE`.
- The frontend CSP uses a per-request nonce in middleware.
- Playwright desktop/mobile `/intelligence` smoke coverage is present.
- Alembic-only schema management, Gitleaks, and zero-fabrication scans are release
  expectations.

## Known incomplete or environment-dependent gates in the supplied control file

- Formal walk-forward RPS validation depends on sufficient live historical data.
- Football-Data.org and Sportmonks adapters require credentialed live-contract
  verification.
- Full `make verify` requires its infrastructure dependencies, including PostgreSQL
  and Docker.
- Vercel linkage/deployment status must be verified externally.
- Full production readiness is not yet certified in this checkout until
  `make verify`, Docker builds, Alembic upgrade/check, frontend test/build, and
  Playwright smoke gates pass in the target release environment.

## Fresh local evidence from 2026-07-04

- Provider/league/zero-fabrication contracts:
  `10 passed` for `tests/test_provider_cli_contract.py`,
  `tests/test_league_policy_contract.py`, and
  `tests/test_zero_fabrication_contract.py`.
- Betting engines:
  `82 passed` for `tests/test_betting_intelligence_engine.py` and
  `tests/test_core_engine.py`.
- Frontend:
  `pnpm --filter @sabiscore/web typecheck` passed.
- OpenAPI:
  `python scripts/verify_openapi.py` passed with 78 paths.
- Static scans:
  zero hits for `full_kelly_fraction`, web Full-Kelly tokens, and
  `NEXT_PUBLIC_KELLY_FRACTION`; zero hits for `FEATURE_DEFAULTS[` only in the
  current `api/services/providers` release-scan path.
- Secret scan:
  `gitleaks detect --no-git --source . --redact --exit-code 1` passed after
  `.gitleaks.toml` excluded ignored local env files, backend artifacts, and local
  `.worktrees/` from source scans.
- Docker/frontend release blockers:
  Vitest and Next production build hit Windows `spawn EPERM`; Docker image build
  hit a local Buildx lock-file permission error. These are not certified green.
- Zero-fabrication blocker:
  `backend/src/data/transformers.py` still contains legacy `FEATURE_DEFAULTS[...]`
  fallback usage. It must be fail-closed or proven outside production inference
  before production readiness can be certified.

## Verification rule

Before relying on any item above, locate its current implementation and tests. If
code disagrees with this file, code and passing tests win; update this document in
the same change.
