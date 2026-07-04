---
applyTo: "**/*.py"
---

# Python / FastAPI Rules (SabiScore Backend)

These rules apply automatically to all Python files in this repository.
They are non-negotiable and complement the main `copilot-instructions.md`.

---

## Schema Management (ABSOLUTE)

- **Alembic is the ONLY schema authority.** NEVER write `Base.metadata.create_all()`.
- NEVER call `Base.metadata.create_all()` at app startup OR inside any migration.
- SQLite fallback: only with explicit `ALLOW_SQLITE_FALLBACK=true`. Never activate silently.
- Always run `alembic check` in CI after `alembic upgrade head`.

## HTTP Client (ABSOLUTE)

- Provider gateway uses a **single application-lifespan `httpx.AsyncClient`** injected via `app.state` and `Depends()`.
- NEVER instantiate `httpx.AsyncClient` per-request or per-function call.
- All provider requests are HTTPS-only.
- Egress must route through the explicit allowlist.

## Betting Logic (ABSOLUTE)

- `evaluation_at` is required in every verdict calculation — pass it as a parameter.
- NEVER call `datetime.now()` or `datetime.utcnow()` inside pure betting logic.
- UCL fixtures are capped at `ACTIONABLE` — they cannot reach `HIGH_CONVICTION`.
- `SPECULATIVE` verdicts go into `watchlist` ONLY — never into `top_opportunities`.
- Only `critical_gaps` force `PARTIAL` status. Advisory gaps reduce confidence only.
- Provider predictions / value-bet flags from external sources must NEVER enter model inputs.

## DUAL-ENGINE RULE (NON-NEGOTIABLE)

When editing `betting_intelligence.py` or `core_engine.py`:
- **ANY change to verdict gates, Kelly sizing, rankings, or watchlist logic MUST be applied to BOTH files.**
- Use `sabiscore-betting-engine-auditor` skill for all betting engine work.
- Verify after every change: `git diff --name-only | grep -E "betting_intelligence|core_engine"` must show BOTH.

## ProviderStatus Enum

Always reference actual enum values from `backend/src/providers/base.py`:
```python
ProviderStatus.VERIFIED
ProviderStatus.CONFIGURED_UNVERIFIED
ProviderStatus.UNCONFIGURED
ProviderStatus.PARTIAL          # docs call this DEGRADED
ProviderStatus.UNAVAILABLE      # also used when disabled
ProviderStatus.RATE_LIMITED
ProviderStatus.CIRCUIT_OPEN
ProviderStatus.INVALID          # docs call this SCHEMA_INVALID
ProviderStatus.CONFLICTING
# DISABLED does not exist as an enum value
```

## Logging (ABSOLUTE)

- Structured logs only — use `structlog`.
- Redact: auth headers · API-key query params · raw URLs with credentials · DSNs · passwords.
- No raw provider response bodies at INFO level.

## Circuit Breaker

Must distinguish: `network` / `rate-limit` / `auth` / `client` / `server` / `schema` failures.
Must honor `Retry-After`. Must support half-open recovery.

## ESPN-Specific Rules

- **Keyless** — no `ESPN_API_KEY`. Flag any code that references this variable.
- Egress allowlist must permit BOTH `site.api.espn.com` AND `sports.core.api.espn.com`.
- Standings: `…/apis/v2/sports/soccer/{slug}/standings` — NOT `/apis/site/v2/` (returns stub).
- Only 7 competitions supported. Others raise `UnsupportedCompetitionError`.
- `provider_timestamp = None` on scoreboards. Never set it to kickoff time.

## Async Patterns

- Always use `httpx.AsyncClient` (not `requests`).
- FastAPI lifespan (`@asynccontextmanager`) for application-scoped resources.
- DI via `Depends()` — never access `app.state` directly from endpoint functions.

## Credential Safety

- NEVER log API keys, passwords, or DSNs.
- NEVER include secrets in tracebacks or OpenTelemetry spans.
- Gitleaks must remain clean in CI.

## Suggested Skills (attach to Copilot Chat for this domain)

```
#file:.ai/skills/backend-domain-model-architect/SKILL.md
#file:.ai/skills/backend-systems-auditor/SKILL.md
#file:.ai/skills/api-automation-architect/SKILL.md
#file:.ai/skills/sabiscore-betting-engine-auditor/SKILL.md
#file:.ai/skills/opentelemetry-observability-architect/SKILL.md
```
