# 0005 — Portfolio exposure policy

**Status:** Proposed · 2026-08-05

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
