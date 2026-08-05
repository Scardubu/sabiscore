# 0004 — CLV capture at kickoff

**Status:** Proposed · 2026-08-05

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
