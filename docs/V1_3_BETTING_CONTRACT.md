# SabiScore Betting Contract v1.3

This document records the public decision contract enforced by the certification branch.

## Evidence ownership

- Every verified external source is represented by its canonical provider owner.
- Missing provider provenance is a data gap and cannot produce an executable verdict.
- One independent provider has a hard ceiling of `HOLD`.
- At least two independent providers are required before an executable verdict may be considered.
- `HIGH_CONVICTION` requires at least four independent provider owners in addition to every existing mathematical, freshness, calibration, uncertainty, lineup, and league gate.
- ESPN is supplementary discovery/corroboration evidence and cannot independently authorize execution.

## Evidence collection

- The explicit `PRODUCTION_CYCLE` runs the standard, enriched, and market profiles concurrently.
- Provider quota accounting, retries, and circuit breakers remain owned by each adapter.
- Fixture evidence is stored in the existing cache layer for six hours and keyed by fixture ID.
- Only `VERIFIED` observations containing at least one normalized record count toward source diversity.
- Empty, unavailable, rate-limited, unconfigured, partial, invalid, or circuit-open results remain visible but never count as verified evidence.
- Refreshing evidence is an explicit user or orchestrator action; it is not hidden background polling.

## Staking

- Public staking uses Quarter-Kelly only.
- The absolute displayed stake cap is 5% of bankroll.
- Full-Kelly may be calculated internally for bounded arithmetic but is never returned by public schemas or rendered by the web application.
- `PARTIAL`, `NO_BET`, and `HOLD` always return `pass` and a zero stake fraction.

## Compatibility path

The legacy compatibility core does not carry provider-ownership provenance. It is therefore capped at `ACTIONABLE`; only the versioned betting-intelligence engine can emit `HIGH_CONVICTION`.

## Zero fabrication

Missing odds, model metadata, freshness, timestamps, source status, uncertainty, calibration state, or feature values remain missing. They are never replaced with averages, zeros, current timestamps, generic odds, or assumed verification.
