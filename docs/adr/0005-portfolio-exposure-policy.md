# 0005 — Portfolio exposure policy

**Status:** Accepted · 2026-08-05 (policy) · Addendum 2026-08-06 (implementation)

## Context

Quarter-Kelly sizing (per-league `kelly_cap` — `EREDIVISIE`/base tier: 0.025,
CALIBRATED tier: 0.04, UCL: 0.020, all hard-capped by `MAX_KELLY_CAP`/
`CORE_MAX_KELLY_CAP` = 0.05, defined independently in three files —
`insights/engine.py:38`, `betting_intelligence.py:59`, `core_engine.py:39`,
currently in agreement) sizes each bet independently. It has no concept of
aggregate exposure across fixtures that share systematic factors. Eredivisie's
opening round is ~9 fixtures in one weekend — a single miscalibrated model input or
simple correlation across same-league/same-matchday fixtures could see naive
per-bet sizing recommend near-simultaneous full-Kelly stakes on several fixtures as
if they were independent draws, when they are not.

`rl_betting_agent.py`'s state vector already has a `current_drawdown` slot
(`rl_agent.py:41`, default 0.0) with nothing in the system computing a real value
for it — a natural future integration point for a portfolio module, not something
this ADR builds.

This platform places no stake by construction: `EXECUTE_BET` was rejected as a
product-identity decision. Everything proposed here is advisory shadow evaluation —
it recommends what a stake *would* be, never executes one.

## Decision

Three advisory policies, computed and surfaced but never gating a live decision (no
`EXECUTE_BET` path exists to gate):

**(a) Aggregate open-exposure cap.** A bankroll-percentage ceiling summed across all
concurrently-recommended positions. When the sum would exceed the ceiling,
later-ranked recommendations are flagged as exceeding the cap (advisory only — still
shown, not suppressed) rather than silently sized down.

**(b) Same-matchday/same-league correlation haircut.** When N fixtures in the same
league and matchday are all flagged actionable, reduce each individual Kelly stake
by a haircut factor that grows with N (exact curve is implementation detail,
post-approval). Directly motivated by Eredivisie's ~9-fixture opening weekend.

**(c) Bankroll drawdown limit.** Once realized drawdown (computed from actual
settled positions — the eventual real source of `current_drawdown`, currently
always 0.0) crosses a threshold, pause new position *recommendations* only. Never
retroactively touch already-open positions — there is nothing to touch since no
positions are ever executed.

## Alternatives considered

**(a) Do nothing; rely on per-league `kelly_cap` alone.** Already bounds any single
bet. Rejected as sufficient: no mechanism at all for same-day correlation across
fixtures, the specific risk a 9-fixture opening weekend creates.

**(b) A fixed max-simultaneous-positions count instead of a percentage-based
exposure cap.** Simpler. Rejected as primary: doesn't scale with how large each
recommended stake is — 5 positions at UCL's 0.020 cap is a very different aggregate
risk than 5 at CALIBRATED's 0.04 cap. Worth adding as a secondary, cheap guard
alongside (a), not instead of it.

## Consequences

- No live behavior changes — nothing in production currently reads a
  portfolio-level signal, so this ADR authorizes design work, not a deployed policy
  change.
- Establishes `current_drawdown` (`rl_agent.py:41`) as the eventual wiring point for
  policy (c) — flagged, not built, in this stream.
- A real implementation will need its own persistence (querying which positions are
  "concurrently open") and its own future migration — no migration proposed here.
  If both this and ADR-0004's eventual implementation land, whichever is written
  first claims the next Alembic head; standard sequential handling, not a conflict.

## Reversal

**Cost:** near-free. Advisory shadow evaluation gating nothing live — removing it
deletes a computation and a display surface, with no data migration and no behavior
change to any executed decision (none exist to affect).
**Trigger:** if the correlation-haircut curve in (b) needs real historical
same-matchday settlement data to calibrate honestly rather than a defensible prior —
in which case wait for ADR-0004's closing-price/settlement data to accumulate first.

## Addendum — 2026-08-06: implementation scope, a prerequisite correction, and constants

**Scope, confirmed narrower than "wherever a recommendation exists":** this ADR
targets `PredictionEngine.calculate_value_bets`
(`backend/src/models/prediction.py`), the Kelly path feeding
`upcoming_match_service.py`'s `GET /upcoming/matches` — the endpoint that actually
backs the frontend's "today's slate" panel. `betting_intelligence.py` and
`core_engine.py` (the on-demand "analyze these N specific matches" engines) are
untouched; CLAUDE.md's dual-engine rule does not apply because neither is modified.

**A prerequisite bug, found and fixed during implementation.** This ADR's Context
section assumed Quarter-Kelly sizing is already capped per-league everywhere.
`calculate_value_bets` was the one exception — it computed
`kelly_pct = (edge_pct/100/(odds-1)) * kelly_fraction` with **no cap at all**, unlike
`insights/engine.py`, `betting_intelligence.py`, and `core_engine.py`, which all clamp
via `min(get_league_policy(league).kelly_cap, MAX_KELLY_CAP)`. Fixed as a prerequisite
(same clamp, same pattern) — an aggregate cap over individually-uncapped stakes would
have been meaningless.

**Correction to Consequences: no new persistence is required.** Since no
`EXECUTE_BET` path exists, "concurrently recommended" means nothing beyond
"co-present in one stateless batch response" — `enriched_matches` already holds every
fixture needed, in memory, at the moment it's needed. The persistence caveat above
applies only to a hypothetical future execution-aware version.

**Grouping semantics, resolved:** policy (a)'s cap is whole-batch (every
`has_value=True` fixture in the response, any date). Policy (b)'s haircut groups by
(canonical league, UTC calendar day of `match_date`) — no kickoff-time window needed,
since all 7 supported leagues kick off same-UTC-day. League grouping goes through
`canonical_league_id()`; the raw `league` field on each match is never mutated (the
frontend's league-color lookup depends on the existing display string).

**Constants chosen** (`backend/src/core/portfolio_exposure.py`), reasoned starting
points marked `PORTFOLIO_POLICY_SOURCE = "DEFAULT_PENDING_CALIBRATION"` — no
same-matchday settlement data exists yet to calibrate against:

- `AGGREGATE_CAP_MULTIPLIER = 3.0` — aggregate cap = 3× the largest per-league
  `kelly_cap` present in the batch (reuses an existing deliberated number rather than
  a fresh invented percentage).
- `HAIRCUT_PER_ADDITIONAL_FIXTURE = 0.10`, floored at `HAIRCUT_FLOOR_MULTIPLIER = 0.50`.
- Policy (c)'s pause threshold is **not** assigned a placeholder number — there is no
  formula yet, only an absence. The stub always reports
  `status: "insufficient_settled_predictions"` (reusing the exact string
  `/model-performance` already established), never a fabricated `0.0`.

See `docs/DEBT.md` item 9 for the recalibration trigger.
