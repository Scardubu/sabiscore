# 0004 — CLV capture at kickoff

**Status:** Accepted · 2026-08-05 (schema) · Addendum 2026-08-06 (capture job)

## Context

`docs/DEBT.md` item 6 ("CLV and ROI are structurally unavailable") already documents
this gap — tier ACCEPTED, priority NONE, on the reasoning that CLV/ROI aren't useful
analytics yet at current settled-prediction volume. This ADR revisits that
recommendation early, not because volume has changed, but because the constraint is
asymmetric: low volume is a "wait" condition, a missed kickoff is a "gone forever"
condition. Eredivisie's opening round kicks off in ~2 days; every fixture that kicks
off before this is captured represents closing-price data that can never be
retroactively recorded, independent of when CLV analytics eventually become useful.

`MatchPredictionLog` (`backend/src/db/models.py:227-251`) stores the model's own
probabilities at prediction time but no market data of any kind. Because this
platform never executes a bet at a captured price (`EXECUTE_BET` was rejected as a
product-identity decision), "CLV" here is necessarily model-probability vs. closing
de-vigged market-probability, not classic bettor's-price-vs-closing-price. The
model-side value already exists; only the closing-market side is missing.

A `MarketSnapshot` table already exists (`backend/src/db/models.py:205-224`) with
the raw-odds shape (`provider`, `bookmaker`, `home_odds`/`draw_odds`/`away_odds`,
`provider_timestamp`, `captured_at`, `coherent`, `executable`, `provenance`,
non-nullable `canonical_fixture_id` FK) but has zero write-site callers anywhere in
`backend/src` — it is itself dormant schema. `TheOddsAPIProvider.odds()`
(`backend/src/providers/the_odds_api.py`) already fetches and normalizes exactly
this shape per bookmaker, computes overround, and rejects incoherent markets before
returning — the reusable fetch path for a closing snapshot. `CanonicalFixture.
kickoff_utc` is the natural trigger-boundary field for "capture at kickoff",
distinct from the FINISHED-match trigger the settlement pass already uses
(`docs/adr/0003`).

## Decision

Add a nullable FK column to `MatchPredictionLog`:
`closing_market_snapshot_id: int | None` → `market_snapshots.id`.

Extend `MarketSnapshot` with 4 additive nullable columns:
- `home_implied_prob_devigged`, `draw_implied_prob_devigged`,
  `away_implied_prob_devigged` (float, nullable) — computed at write time as
  `(1/odds_i) / overround` per outcome, so CLV consumers never re-derive the de-vig
  arithmetic themselves.
- `is_closing_line` (bool, default False) — disambiguates a true kickoff-captured
  snapshot from any future ad-hoc MARKET_REFRESH snapshot the evidence orchestrator
  might eventually write to this same table.

`provider` and `captured_at` (already on `MarketSnapshot`) directly serve as the
closing-price source/timestamp — no new columns needed for those.

**Consensus over single-bookmaker:** `the_odds_api.odds()` returns one record per
bookmaker per fixture; comparing a prediction against one arbitrarily-chosen
bookmaker's closing price would conflate CLV with bookmaker-shopping variance. The
kickoff-capture job (post-approval work, not designed here) should compute the
median home/draw/away odds across all `coherent=True` records for the fixture and
write one `MarketSnapshot` row (`bookmaker="consensus"`, `provider="the_odds_api"`,
`is_closing_line=True`), then backfill `closing_market_snapshot_id` on every
`MatchPredictionLog` row sharing that `canonical_fixture_id`.

Next Alembic migration number: `0005` (existing: 0001-0004 in
`backend/alembic/versions/`).

## Alternatives considered

**(a) Embed raw + de-vigged columns directly on `MatchPredictionLog`** (8 new
columns, no join). Simpler single-row read. Rejected: duplicates the same closing
price across every re-prediction row for one fixture, ignores `MarketSnapshot`'s
existing near-identical shape, and contradicts `docs/DEBT.md` item 6's own prior
recommendation without a stated reason to diverge. Kept as a fallback if the join
proves worse in practice than the duplication.

**(b) Single fixed reference bookmaker instead of a computed consensus.** Simpler,
matches a real bettor's experience. Rejected as primary: a fixed bookmaker may not
cover every Eredivisie fixture, and since no bet is ever placed at a specific book's
price, a consensus line is a more robust proxy for "what the market believed at
kickoff."

**(c) Do nothing until settled-prediction volume is high enough to matter**
(`docs/DEBT.md` item 6's own stated priority). Rejected for this schema-only
proposal specifically because of the 2-day irreversibility window — an additive,
nullable migration costs near-zero today; not having it costs permanent data loss
for every Eredivisie fixture kicking off before it ships. This does not argue for
building the capture job or CLV computation now — only for the schema existing so
late capture doesn't compound the loss further.

## Consequences

- No existing column becomes non-nullable; both new columns are additive and
  nullable/defaulted. Zero risk to any current read path.
- `MarketSnapshot` remains uncalled by anything until the kickoff-capture job
  (post-approval work) is built — this ADR makes the schema ready, nothing more.
- CLV remains uncomputable until the capture job exists and has run past at least
  one kickoff; this ADR does not restore the removed `/performance` CLV card — that
  stays out of scope until real closing-price rows exist.
- Once a scheduler is designed (not here), it needs its own decision on what happens
  to fixtures whose kickoff already passed before the feature ships — those closing
  lines are unrecoverable regardless of schema readiness.

## Reversal

**Cost:** low. Pure schema revert — drop the 4 `MarketSnapshot` columns and the
`MatchPredictionLog` FK. No data migration needed: nothing writes to these columns
until a capture job exists (out of scope here), so there is nothing to preserve.
**Trigger:** if a future implementer determines the FK-reference join is
operationally worse than column duplication (alternative (a)), or if
`MarketSnapshot` gets repurposed for MARKET_REFRESH evidence writes in a way that
conflicts with the `is_closing_line` disambiguation this ADR relies on.

## Addendum — 2026-08-06: implementing the capture job surfaced a schema gap this ADR didn't anticipate

This ADR's Decision section assumed a non-nullable `canonical_fixture_id` FK on
`MarketSnapshot` was safe because a capture job would simply supply one.
Implementation-time investigation found that's false for every fixture
currently reachable: `fixture_sync_service.sync_upcoming_fixtures()` — the
only writer of upcoming fixtures in production today — populates the legacy
`matches`/`teams`/`leagues` tables only. Nothing in the live process writes to
`canonical_fixtures`; it is populated opportunistically by the identity-
reconciliation pipeline during prediction/evidence requests (`reconcile_team`,
`orchestrator._resolve_team_statistics()`), not as a side effect of ordinary
fixture ingestion. A capture job that could only key on `canonical_fixture_id`
would find zero rows to enumerate and would silently capture nothing for
Eredivisie's opening round — the exact irreversibility this ADR exists to
prevent, just moved one layer down.

**Correction, shipped in the same `0005_clv_capture_schema` migration:**
`market_snapshots.canonical_fixture_id` is relaxed from `NOT NULL` to
nullable, and a new `match_id` column (plain string, no FK — mirroring
`match_prediction_logs.match_id`'s existing convention) is added as the real
join key. The capture job (`backend/src/services/clv_capture_service.py`)
enumerates the legacy `matches` table — where fixtures actually live — maps
each fixture's `Match.league_id` (a football-data.org short code, e.g.
`"DED"`) to a canonical competition via `fixture_sync_service._LEAGUE_META`,
fetches that competition's odds board from `TheOddsAPIProvider.odds()`, and
matches each odds-board event to a candidate fixture by kickoff-timestamp
proximity (the provider's normalized `OddsMarketRecord` carries no team
names, only `provider_event_timestamp` — modifying that contract was judged
riskier than a timestamp-proximity match with an ambiguity guard). An
ambiguous match (zero or multiple same-league fixtures within a 10-minute
tolerance of one odds-board event) is skipped rather than guessed, per this
ADR's own provenance discipline.

`canonical_fixture_id` on every row written by this job is `NULL` and stays
that way until a separate identity-resolution effort makes fixture sync
populate `canonical_fixtures`. This does not change the ADR's Decision or
Reversal sections in substance — the join-key *shape* (an FK reference, not
raw odds columns duplicated per row) is unchanged; only which key currently
carries real data is different. Do not backfill `canonical_fixture_id`
speculatively; when identity resolution lands, it should backfill this column
the same way it backfills every other `canonical_fixture_id` in the schema.

## Addendum 2 — 2026-08-07: computation shipped, and it did not need to wait

Addendum 1 (above) reads as though CLV computation is blocked until identity
resolution populates `canonical_fixture_id`. It isn't, and computation shipped
this session without waiting on that: `match_id` is non-null and populated on
every row this platform actually writes to both `market_snapshots` (the
capture job) and `match_prediction_logs` (both write sites,
`api/endpoints/predictions.py` and `services/analytics.py` — both hardcode
`canonical_fixture_id=None` too, confirmed by reading them directly), and both
columns are already indexed. `canonical_fixture_id` was never a real
prerequisite for the join — only for the `closing_market_snapshot_id`
backfill described in the original Decision section, which remains undone and
still correctly waits on identity resolution.

**Shipped:** `repositories/fixtures.py::build_clv_records_query()` /
`get_clv_records()` join the latest `MatchPredictionLog` per `match_id` to the
latest `MarketSnapshot(is_closing_line=True)` for that same `match_id` (two
`MAX()`-per-`match_id` subqueries, mirroring `build_settled_predictions_query`'s
existing pattern one section above it in the same file). Unlike the settled-
predictions join, this one does not require the match to be finished — a
closing line exists as soon as the capture job runs, independent of the
result. `services/clv_service.py::compute_clv_summary()` takes the joined
`(model_probs, closing_probs)` pairs and computes
`model_prob[argmax] - closing_implied_prob[argmax]` per record (mirroring
`walk_forward_validate()`'s own argmax convention for `accuracy`), averaged,
plus a positive-rate, gated on `n >= 10` (reuses
`model_registry.MIN_RECORDS_FOR_DECOMPOSITION`'s threshold rather than
inventing a second one). Surfaced as an independent `clv` field on
`GET /model-performance`, computed unconditionally so it is never gated by the
walk-forward floor already in that same response (the two data sources —
finished matches vs. captured closing lines — can be insufficient
independently of each other).

**Deliberately not called:** `connectors/odds_market.py::
compute_market_features()`, despite computing an equivalent `clv_{outcome}`
value. It accepts raw decimal odds and re-derives the de-vig internally —
`MarketSnapshot.*_implied_prob_devigged` already stores that arithmetic done
once, at capture time, which is the entire point of those columns per this
ADR's own Decision section. Routing through a 12-field function built for a
different (Phase-9 shadow-feature) use case to get 3 numbers already sitting
in the database was judged the wrong rung of the ladder; `clv_service.py`
subtracts the stored columns directly.

**Deliberately not touched:** `MatchActionability.clv_pct`
(`services/intelligence_synthesizer.py`, `full_analysis.py:448`) — a
different, still-dormant "CLV" concept living in the Kelly/verdict/abstain
advisory surface (per-recommendation, not this diagnostic aggregate); and the
`/performance` frontend CLV card — out of scope by explicit product-owner
decision this session, not by any remaining technical blocker. See
`docs/DEBT.md` item 6 for the current, dated status of both.
