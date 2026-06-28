# ESPN Provider Integration — SabiScore (Canonical)

Last updated: 2026-06-28
Supersedes: the earlier "ESPN API Integration" note that targeted `apps/scraper`
and `apps/api`. Those paths are **legacy** and must not be used.

---

## 0. Why This Document Replaces the Earlier One

The earlier integration note was written against an outdated map of the
repository. It placed ESPN in `apps/scraper`, fed features through
`apps/api/ingestion/pipeline.py`, and let Next.js cron routes fetch ESPN
directly. Every one of those placements contradicts the canonical production
shape defined in `SABISCORE_PRODUCTION_SETUP_GUIDE.md` and the production
certificate.

| Earlier note | Canonical authority |
|---|---|
| Backend = `apps/api/main.py` | `apps/api` is legacy. Backend is `backend/src/api/main.py` |
| ESPN lives in `apps/scraper` | All provider traffic goes through `backend/src/providers/` |
| ESPN supplies injuries/lineups | ESPN is `SUPPLEMENTARY_ONLY`; never sole injury/lineup evidence |
| Next.js cron fetches ESPN | Next.js never calls providers; it proxies the backend |
| ESPN features → `predict/route.ts` | Feature construction is backend-only; browser never builds model inputs |
| Raw `fetch()`, no validation | Validate every response; fail closed on schema drift |
| `event.date` used as timestamp | Separate `kickoff_utc` from `provider_timestamp`; use `acquired_at` |

The earlier note's **strategy** was right — "ESPN for event intelligence, not
primary statistics." Only its placement was wrong.

---

## 1. ESPN's Role in the Canonical Architecture

```text
backend/src/providers/
  ├── espn/                  ← THIS integration (keyless, supplementary)
  ├── football_data_org/     ← OFFICIAL_AUTHENTICATED (fixtures, standings)
  ├── api_football/          ← OFFICIAL_AUTHENTICATED (enrichment, odds)
  ├── sportmonks/            ← OFFICIAL_AUTHENTICATED (optional enrichment)
  └── the_odds_api/          ← OFFICIAL_AUTHENTICATED (1X2 market snapshots)
```

ESPN's trust tier and scope are fixed:

| Property | Value |
|---|---|
| Trust tier | `UNOFFICIAL_PUBLIC` |
| Auth | Keyless — **no `ESPN[_]API[_]KEY` variable** |
| Scope | Fixture discovery, scoreboard, event status, standings corroboration |
| Evidence precedence | Lowest — never establishes critical odds/lineup/injury/probability evidence |
| Polling | Reasonable cadence only — **no 8-second feed, no low-latency guarantee** |

ESPN feeds the **evidence orchestrator**, where it is the discovery-tier source.
It never computes probabilities, verdicts, EV, Kelly stakes, or model features.

```text
                        backend/src/providers/espn/  (this module)
                                    │
                                    ▼
              Evidence Orchestrator (backend/src/services/)
              precedence: official providers first, ESPN supplementary
                                    │
                                    ▼
              Canonical Identity + Reconciliation (provider IDs → canonical)
                                    │
                                    ▼
              Strict Betting Engine  (the ONLY verdict/EV/Kelly authority)
                                    │
                                    ▼
              FastAPI routes  →  apps/web proxy routes  →  /intelligence UI
```

---

## 2. Module Layout

```text
backend/src/providers/espn/
  ├── __init__.py        Public surface
  ├── mappings.py        7 canonical competitions ↔ ESPN slugs (fail closed)
  ├── schemas.py         Wire schemas (strict) + normalized contracts + envelope
  └── client.py          EspnProvider — httpx + circuit breaker + redaction

backend/tests/providers/
  └── test_espn_provider.py   11 tests (kickoff/timestamp, IDs, schema drift, circuit, allowlist)

apps/web/src/app/api/providers/espn/
  └── route.ts           Thin Zod-validated proxy to the backend (no direct ESPN call)
```

---

## 3. Endpoints ESPN Exposes

ESPN base: `https://site.api.espn.com/apis/site/v2/sports/soccer`

| Use | Path |
|---|---|
| Scoreboard (fixtures + status) | `/{slug}/scoreboard` |
| Standings (corroboration) | `/{slug}/standings` |
| Teams (metadata) | `/{slug}/teams` |
| Event summary | `/{slug}/summary?event={id}` |

Canonical competition → slug (all 7 required):

| Competition | Slug |
|---|---|
| EPL | `eng.1` |
| LA_LIGA | `esp.1` |
| SERIE_A | `ita.1` |
| BUNDESLIGA | `ger.1` |
| LIGUE_1 | `fra.1` |
| EREDIVISIE | `ned.1` |
| UCL | `uefa.champions` |

The shipped module implements `scoreboard` discovery end-to-end. `standings`,
`teams`, and `summary` follow the same pattern: add a wire schema in
`schemas.py`, a method in `client.py` that routes through `breaker.call`, and a
normalized contract. Do not add them by copying raw `fetch()` — reuse the
validated `_get_*` + `parse_*` pattern.

---

## 4. The Provider Contract (How It Plugs In)

`EspnProvider` is dependency-injected, not self-instantiating. The gateway
lifespan owns the shared `httpx.AsyncClient` and the circuit breaker, and passes
them in:

```python
# backend/src/providers/gateway.py  (illustrative wiring)
from contextlib import asynccontextmanager
import httpx
from src.providers.espn import EspnProvider
from src.core.config import settings

@asynccontextmanager
async def provider_gateway_lifespan(app):
    # ONE client for the whole app lifespan — never per-request.
    async with httpx.AsyncClient(
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    ) as http:
        espn = EspnProvider(
            http=http,
            breaker=app.state.circuit_registry.for_provider("espn"),
            enabled=settings.enable_espn_provider,  # default True; keyless
        )
        app.state.providers = {"espn": espn, ...}
        yield
        # httpx client closed automatically on exit
```

The breaker must implement the documented `CircuitBreaker` protocol (in
`client.py`): distinguish network / rate-limit / auth / client / server / schema
failures, honor `Retry-After`, use half-open recovery, and share state across
workers (Redis-backed) where multiple workers run.

---

## 5. What the Provider Returns

Every call returns a redacted `ProviderEnvelope`:

```python
ProviderEnvelope(
    provider="espn",
    trust_tier=TrustTier.UNOFFICIAL_PUBLIC,
    status=ProviderStatus.HEALTHY,   # only after a successful, schema-valid probe
    competition="EPL",
    fixtures=(NormalizedFixture(...), ...),
    quota=None,                       # keyless → no quota
    warnings=(...),                   # per-event skips, degradation notes
    snapshot_hash="sha256:...",       # audit/dedup of the raw payload
    acquired_at=datetime(...),        # when SabiScore fetched it
    correlation_id="...",
)
```

Each `NormalizedFixture` preserves provider IDs and separates timestamps:

```python
NormalizedFixture(
    provider="espn",
    provider_event_id="401234567",
    competition="EPL",
    kickoff_utc=datetime(2026, 6, 26, 18, 0, tzinfo=utc),
    status="STATUS_SCHEDULED",
    provider_home_team_id="359",        # preserved for reconciliation
    provider_away_team_id="363",
    provider_home_team_name="Arsenal",  # display, but reconcile to canonical
    provider_away_team_name="Chelsea",
    provider_timestamp=None,            # ESPN scoreboards carry none — NOT kickoff
    acquired_at=datetime(...),
)
```

**Reconciliation, not display.** Pass `provider_*_team_id` into the canonical
identity layer. Never render a raw provider ID as a team name in the UI.

---

## 6. Status Semantics (Configured ≠ Healthy)

`ProviderStatus` distinguishes states the earlier note collapsed:

```text
DISABLED         provider turned off
CONFIGURED       enabled, not yet probed
HEALTHY          successful probe within the validity window
DEGRADED         partial success
RATE_LIMITED     429 / Retry-After in effect
SCHEMA_INVALID   response failed contract validation (fail closed)
UNAVAILABLE      transport error, allowlist block, or 5xx
CIRCUIT_OPEN     breaker open — no call attempted
```

`doctor` reports HEALTHY only after `EspnProvider.probe()` succeeds. A provider
is never "verified" merely because it is enabled.

---

## 7. Provider CLI + API Surface

ESPN appears in the standard provider surfaces — no bespoke routes:

```bash
cd backend
python -m src.cli providers doctor --provider espn   # cheapest live probe
python -m src.cli providers capabilities             # ESPN: 7 competitions, discovery scope
```

```text
GET /api/v1/providers                 # includes espn with trust_tier + status
GET /api/v1/providers/health          # espn status reflects last probe
GET /api/v1/providers/espn/fixtures?competition=EPL   # discovery, redacted envelope
```

---

## 8. Tests

```bash
cd backend
python -m pytest tests/providers/test_espn_provider.py -q --no-cov
```

Coverage maps to the certificate's ESPN requirements:

- ESPN kickoff is **not** treated as provider update time
- provider team IDs preserved (not displayed as names)
- schema drift → `SCHEMA_INVALID`, no fabricated fixture, breaker records it
- circuit-open short-circuits with **no** network call
- all 7 competitions map; unsupported competitions fail closed
- disabled ≠ healthy; probe is health-gated
- egress allowlist blocks any non-ESPN host (fails closed)

Live ESPN tests remain opt-in (`PROVIDER_LIVE_TESTS=false` by default). The
shipped tests use `httpx.MockTransport` and consume no network or quota.

---

## 9. Evidence Orchestrator Wiring (Where ESPN Sits)

In the `DISCOVERY` profile, ESPN is a valid low-cost source. In every other
profile it is supplementary corroboration only:

```python
# Field precedence (illustrative): official sources outrank ESPN everywhere.
FIXTURE_DISCOVERY_PRECEDENCE = ["football_data_org", "api_football", "espn"]
STANDINGS_PRECEDENCE         = ["football_data_org", "api_football", "espn"]
# ESPN is absent from odds / lineup / injury precedence entirely.
```

Rules the orchestrator enforces for ESPN:
- ESPN alone cannot satisfy a `critical_gap` for odds, lineups, injuries, or probabilities.
- A missing ESPN scoreboard is at most an `advisory_gap`, never `critical`.
- ESPN `provider_timestamp=None` means freshness is judged by `acquired_at`.

---

## 10. Anti-Patterns (Do Not Reintroduce)

```python
# ❌ WRONG — per-request client (earlier note's implicit pattern)
async def fetch_scoreboard(league):
    async with httpx.AsyncClient() as c:      # new pool every call
        return (await c.get(url)).json()       # no breaker, no validation

# ✅ RIGHT — lifespan client + breaker + validation (this module)
env = await app.state.providers["espn"].discover_fixtures("EPL")
```

```typescript
// ❌ WRONG — browser/Next.js calling ESPN directly (earlier note, Step 8/10)
const res = await fetch("https://site.api.espn.com/.../scoreboard");

// ✅ RIGHT — proxy the canonical backend, Zod-validated, no-store
const res = await fetch(`${SABISCORE_BACKEND_URL}/api/v1/providers/espn/fixtures?competition=EPL`,
                        { cache: "no-store" });
```

```python
# ❌ WRONG — synthetic feature from ESPN into the model (earlier note, Step 7)
features = [home_rank, away_rank, injuries_home, ...]   # ESPN-derived, into predict

# ✅ RIGHT — ESPN supplies discovery/status only; the strict engine owns features.
```
