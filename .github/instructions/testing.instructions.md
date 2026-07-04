---
applyTo: "**/{__tests__,tests,test}/**/*.{ts,tsx,py}, **/*.{test,spec}.{ts,tsx,py}, **/test_*.py, **/*.test.{ts,tsx}"
---

# Testing Rules

These rules apply automatically to all test files.
They are non-negotiable and complement `copilot-instructions.md`.

---

## CI Non-Negotiables (ABSOLUTE)

- NEVER use `|| true` to suppress test or lint failures in CI.
- NEVER suppress `pip install` failures silently — use `continue-on-error: true` with a dedicated step for optional deps only.
- `PROVIDER_LIVE_TESTS=false` is mandatory in default CI — no live provider quota consumed.
- Gitleaks must run and must not have any `|| true` suppressions.

## Python Test Requirements (SabiScore Backend)

### Test Stack
- Pytest + pytest-asyncio for async tests
- `httpx.AsyncClient` with `app` fixture for FastAPI route tests (ASGI transport)
- MSW-equivalent: mock provider responses at the `httpx` transport layer, not with `requests-mock`

### Alembic in CI
Every CI run must execute:
```bash
alembic upgrade head
alembic check  # verifies no unapplied migrations
```

### Zero-Fabrication Scan (required in CI)
```bash
# Grep scan must find zero results — these are production violations:
grep -r "FEATURE_DEFAULTS\[" backend/src/services/ backend/src/api/
grep -r "Base.metadata.create_all" backend/src/alembic/
```

### Betting Engine Tests (DUAL-ENGINE — NON-NEGOTIABLE)
Any change to verdict gates, Kelly, or watchlist must have corresponding tests in BOTH:
- `tests/test_betting_intelligence_engine.py`
- `tests/test_core_engine.py`

Confirmed test coverage that must remain:
- `test_market_source_status_conflicting_forces_partial`
- `test_advisory_only_signals_never_force_partial`

### Provider Tests
- Use fixture responses from `tests/fixtures/providers/` — NEVER call live APIs in unit tests.
- Schema validation tests must cover drift detection → `SCHEMA_INVALID` / `INVALID` handling.
- Circuit breaker tests must cover: network, rate-limit, auth, client, server, schema failure modes.

### ESPN Provider Tests
```python
# Required coverage:
# 1. normalize_event() sets kickoff_utc from event.date
# 2. normalize_event() sets provider_timestamp from event.lastModified or None (never kickoff)
# 3. UnsupportedCompetitionError raised for non-registry slugs
# 4. Standings uses /apis/v2/ path (not /apis/site/v2/ stub)
```

## TypeScript Test Requirements

### Test Stack
- Vitest (unit + component)
- React Testing Library (component interaction)
- MSW v2 (API mocking — NEVER use `nock` or `fetch-mock`)
- Playwright (e2e — desktop + mobile)

### Coverage Thresholds
Do not lower coverage thresholds. Minimum targets live in `vitest.config.ts`.

### Playwright (e2e)
Both projects must pass:
- `chromium` (desktop) — smoke test `/intelligence`
- `mobile-chrome` (mobile) — smoke test `/intelligence`

The `webServer` block must automatically start `pnpm --filter @sabiscore/web start`.
Tests must NOT depend on a running backend — use backend-independent smoke specs.

### Component Tests
- Test behaviour, not implementation details.
- NEVER test internal component state directly.
- Test keyboard navigation and ARIA properties for interactive components.
- Test reduced-motion media query behaviour for animated components.

### Proxy Route Tests (apps/web)
- Verify Zod validation rejects invalid `fixtureId` formats before forwarding.
- Verify proxy correctly maps to `SABISCORE_BACKEND_URL`.
- Test that no provider secrets appear in Next.js response headers.

## Observability Regression Tests

After any system change:
- Verify spans are emitted (check OTLP output in integration tests)
- Verify no new silent error swallowing was introduced
- Verify structured log output contains `correlation_id`

## Suggested Skills (attach to Copilot Chat for testing work)

```
#file:.ai/skills/testing-strategy-architect/SKILL.md
#file:.ai/skills/backend-systems-auditor/SKILL.md
#file:.ai/skills/component-quality-gate/SKILL.md
#file:.ai/skills/git-workflow-architect/SKILL.md
```
