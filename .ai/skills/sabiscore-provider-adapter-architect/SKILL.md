---
name: sabiscore-provider-adapter-architect
description: >
  Designs and implements operational HTTP methods for SabiScore provider adapters
  (football_data_org, api_football, sportmonks) currently stub-only. Enforces the
  gateway contract: lifespan-owned httpx client, circuit breaker, schema validation,
  redacted logging, standard ProviderResult envelope. Never fabricates provider
  response shapes — requires live API contract or recorded responses first.
  Triggers: "complete provider adapter", "implement fixtures() method", "provider stub",
  "football-data.org adapter", "api_football operational", "sportmonks operational",
  "provider HTTP method", "provider gateway gap", "adapter implementation",
  "lineups adapter", "injuries adapter", "standings method", "provider capabilities to live".
argument-hint: "[provider: football_data_org | api_football | sportmonks | all] [operation: fixtures|standings|lineups|injuries|statistics]"
allowed-tools: Read, Grep, Bash(cat:*), Bash(python -m pytest:*)
user-invocable: true
---

# SabiScore Provider Adapter Architect

Three of the five SabiScore providers are capability-only stubs as of 2026-06-28
(per Section 0 of the production brief). This skill governs the implementation of
operational HTTP methods for those stubs **once live API contracts and credentials
are available**. It must never fabricate response shapes from memory.

---

## STEP 1 — Verify Pre-conditions

Before implementing ANY provider method:

```bash
# Confirm the provider's current state
cat backend/src/providers/<provider>.py | grep "def "
# Expected: only capabilities() and health()/probe() from BaseProvider
```

**Hard pre-condition:** do not implement a method unless you have one of:
1. A live API key and can `curl` a real response, OR
2. A recorded real response from the provider's documentation or sandbox, OR
3. An explicit schema from the provider's official docs.

If none of these are available, document the gap and stop. Do not invent schemas.

---

## STEP 2 — Review the Gateway Contract

Every provider method must satisfy this contract (inherited from `BaseProvider`):

```python
async def fixtures(self, *, competition: str, **kwargs) -> ProviderResult:
    """Fetch fixture list for one competition.
    
    REQUIRED behaviours (gateway contract):
    - Use self._get_json() — NOT a raw httpx call. This gives you:
        * The lifespan-owned httpx client (shared pool, not per-request)
        * Circuit breaker open check before making any call
        * Retry with jitter on transient errors
        * Redacted URL logging (credentials stripped from logs)
    - Validate the response schema before returning records.
    - Never log raw response bodies at INFO level.
    - Set acquired_at = utc_now() at the top of the method.
    - Set provider_timestamp from the response's content date when present.
    - Set raw_snapshot_id = stable_hash(records) for audit/dedup.
    - Return ProviderResult with correct trust_tier, status, and warnings.
    - On any Exception: return ProviderResult(status=UNAVAILABLE, error_code=...).
    """
```

---

## STEP 3 — Provider-Specific Implementation Notes

### football_data_org (`OFFICIAL_AUTHENTICATED`)

```python
# Auth header (NEVER a query param for football-data.org)
headers = {"X-Auth-Token": self.api_key}

# Endpoint pattern
f"{self.base_url}/competitions/{COMPETITIONS[competition]}/matches"
f"{self.base_url}/competitions/{COMPETITIONS[competition]}/standings"

# Competition codes (7 supported):
COMPETITIONS = {
    "EPL": "PL", "LA_LIGA": "PD", "SERIE_A": "SA",
    "BUNDESLIGA": "BL1", "LIGUE_1": "FL1",
    # Note: EREDIVISIE and UCL availability depends on plan tier.
    # Do not hard-assert they are available; check capabilities() first.
}

# Key response fields to preserve:
# matches[].id, utcDate, homeTeam.id, awayTeam.id, status, competition.code
# Provider predictions field: DO NOT include in records.
```

### api_football (`OFFICIAL_AUTHENTICATED`)

```python
# Auth header (API-Football uses X-RapidAPI-Key or x-apisports-key)
# Check provider docs for current auth mechanism — it has changed across versions.

# Endpoint patterns
f"{self.base_url}/fixtures?league={LEAGUE_ID}&season={season}"
f"{self.base_url}/injuries?league={LEAGUE_ID}&season={season}"
f"{self.base_url}/fixtures/lineups?fixture={fixture_id}"

# CRITICAL: provider prediction fields MUST be excluded from records.
# Grep for prediction/value/prediction_home etc. and strip them before returning.

# Quota: API-Football uses X-RateLimit-Requests-Remaining header.
# Persist via ProviderQuota.remaining.
```

### sportmonks (`OFFICIAL_AUTHENTICATED`)

```python
# Auth via api_token query param (not a header for Sportmonks v3)
params = {"api_token": self.api_key, "include": "...", ...}

# Endpoint patterns (Sportmonks v3 — confirm version before implementing)
f"{self.base_url}/football/fixtures"
f"{self.base_url}/football/lineups/fixture/{fixture_id}"

# xG: only include when the subscription level includes xG data.
# Check capabilities response before constructing xG records.

# Sportmonks value-bet / prediction endpoints: EXCLUDE entirely.
```

---

## STEP 4 — Schema Validation Pattern

```python
from pydantic import BaseModel, ValidationError

class FootballDataMatchRecord(BaseModel):
    """Wire schema for football-data.org match record (strict)."""
    id: int
    utcDate: str
    status: str
    # ... add fields as confirmed from live response

def _parse_matches(self, raw: dict) -> list[dict]:
    """Validate raw response; fail closed on schema drift."""
    matches = raw.get("matches", [])
    validated = []
    warnings = []
    for match in matches:
        try:
            record = FootballDataMatchRecord.model_validate(match)
            validated.append(record.model_dump())
        except ValidationError as exc:
            self.breaker.record_failure()
            warnings.append(f"schema_drift on match {match.get('id')}: {exc.error_count()} errors")
    return validated  # partial success is acceptable; empty = total schema failure
```

---

## STEP 5 — Test Requirements

For each new method, add tests to `backend/tests/providers/test_<provider>.py`:

```python
@pytest.mark.asyncio
async def test_fixtures_returns_verified_result():
    """Real schema from recorded response → VERIFIED status."""

@pytest.mark.asyncio
async def test_fixtures_schema_drift_fails_closed():
    """Malformed response → INVALID status, no fabricated records."""

@pytest.mark.asyncio
async def test_fixtures_circuit_open_short_circuits():
    """Circuit open → no HTTP call, CIRCUIT_OPEN status."""

@pytest.mark.asyncio
async def test_credentials_not_logged():
    """API key must not appear in log output."""

@pytest.mark.asyncio
async def test_provider_predictions_excluded():
    """If provider returns prediction fields, they must be stripped."""
```

Tests must use `httpx.MockTransport` — no live network calls in default CI
(`PROVIDER_LIVE_TESTS=false`).

---

## STEP 6 — Evidence Orchestrator Integration

After implementing a provider method, wire it into `orchestrator.py`:

1. The orchestrator's `_safe_call()` will stop returning `adapter_stub_no_operational_method`.
2. Verify the correct profile routes to the new method.
3. Run orchestrator-level tests confirming the result flows through correctly.

```bash
cd backend
python -m pytest tests/providers/test_orchestrator.py -q --no-cov
python -m pytest tests/ -k "evidence" -q --no-cov
```

## Quality Gate

Before declaring a provider adapter complete:

- [ ] Pre-condition met: real API response or official schema in hand
- [ ] `self._get_json()` used (not raw httpx)
- [ ] Schema validated with Pydantic; drift → INVALID result
- [ ] Provider prediction fields stripped
- [ ] Quota headers extracted into ProviderQuota
- [ ] `acquired_at` and `provider_timestamp` set correctly
- [ ] `raw_snapshot_id = stable_hash(records)` present
- [ ] Circuit breaker records failure on schema drift
- [ ] Credentials absent from logs (grep `api_key` in log output)
- [ ] Tests: VERIFIED, schema_drift, circuit_open, prediction_exclusion
- [ ] Orchestrator wired and orchestrator tests updated
- [ ] `PROVIDER_LIVE_TESTS=false` remains the default

## Pairs With

- `backend-systems-auditor` — production audit before any provider change
- `api-automation-architect` — circuit breaker, retry, egress-allowlist patterns
- `sabiscore-betting-engine-auditor` — downstream of provider, ensure evidence feeds correctly
- `opentelemetry-observability-architect` — provider latency, quota, circuit metrics

## Vertical Notes

**SabiScore only** — this skill is exclusively for `backend/src/providers/`.
