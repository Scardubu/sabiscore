# Portfolio B — Player Availability Intelligence: Source Qualification Study

**Directive reference:** `PRODUCTION_EXECUTIVE_DIRECTIVE.md` §6 (Portfolio B),
§22 (Player Availability Research Programme), §40 (Gate R1 — Source
Qualification), §47 Action 4.
**Phase:** 2 (Missing Information Discovery) → gates the decision to proceed to
Phase 3 (Data Qualification). **No production code was written or changed to
produce this document** — per §45, "No production integration yet" until a
source clears qualification.
**Date:** 2026-09-09. **Author:** this session, via direct code inspection of
`backend/src/providers/` and external verification of provider documentation
(WebSearch/WebFetch; API-Football's own docs site returned HTTP 403 to direct
fetch, so claims below are sourced from third-party technical writeups of the
same documented behavior — flagged per source, not asserted as first-hand).
**Prior art:** none. `docs/DEBT.md` has zero entries mentioning injuries,
lineups, sidelined players, or player availability — this is the first
recorded treatment of this portfolio in this repository.

---

## 0. Why this is not starting from zero

Rule 2 of the directive ("Look before you write") applies to sources, not
just code. Before evaluating any new external vendor, this session checked
whether the raw data already flows into the platform through providers
already under contract. It does:

- `backend/src/providers/api_football.py` — `APIFootballProvider.injuries()`
  and `.lineups()`, live, authenticated, called today.
- `backend/src/providers/sportmonks.py` — `SportmonksProvider.injuries()`
  (via the `/sidelined` endpoint) and `.lineups()`, live, authenticated,
  called today.
- Both are wired into `backend/src/providers/orchestrator.py`'s
  `_collect_prematch_enriched()` (injuries + lineups + team stats) and
  `_collect_lineup_refresh()` (a **dedicated, time-sensitive lineup-only
  profile** that the orchestrator's own docstring says "runs close to
  kickoff" — the architecture already anticipated the late-arrival problem
  documented in §3 below, even though nothing downstream currently uses it).

**The acquisition question — for the availability signal specifically — is
therefore already substantially answered.** The open questions are
temporal fidelity, historical reconstructability, and whether the raw data
that already lands in evidence collection ever reaches a feature, which is
where this study spent its effort.

---

## 1. Current gap, verified at the code level

`backend/src/data/transformers.py::FeatureTransformer._add_injury_features`
(line 671):

```python
def _add_injury_features(self, features: pd.DataFrame, injuries: pd.DataFrame) -> pd.DataFrame:
    # Not in expected features list explicitly, but might be used for 'missing_value' calculation
    # We'll keep it simple and just return features as is for now,
    # assuming missing_value is handled in team_stats
    return features
```

This is a complete no-op. The adjacent `_add_team_stats_features` writes
`home_squad_value` / `away_squad_value` / `home_missing_value` /
`away_missing_value` / `squad_value_diff` — names that sound exactly like
Portfolio B's target representations — but a direct check against the live
feature contract settles it:

```
home_missing_value  -> in CANONICAL_FEATURES_68: False | in APEX_FEATURES_68: False
away_missing_value  -> in CANONICAL_FEATURES_68: False | in APEX_FEATURES_68: False
home_squad_value    -> in CANONICAL_FEATURES_68: False | in APEX_FEATURES_68: False
away_squad_value    -> in CANONICAL_FEATURES_68: False | in APEX_FEATURES_68: False
squad_value_diff    -> in CANONICAL_FEATURES_68: False | in APEX_FEATURES_68: False
```

None of these five columns exist in the schema that actually trains or
serves the model. **Player availability is acquired today and reaches
nowhere.** This is the same "acquisition exists, serving discards it" shape
this repository has hit before (docs/DEBT.md item 1's canonical-remap gap,
item 56/58's xG-ingestion-never-executed finding) — confirmed here at the
code level, not inferred from the presence of a provider method.

A `Player` table exists in `backend/src/core/database.py` (line 284) with
`team_id`, `position`, `market_value` columns — but has **zero writers
anywhere in `backend/src`**. There is currently no local player-identity
backbone; any team-level aggregation would need to build one, or work
entirely off provider-side numeric IDs the way team reconciliation already
does for teams.

---

## 2. The two signals are NOT one research question

Directive §6 frames Portfolio B around "expected available strength" —
players who **cannot** play (injury/suspension) — as the starting
representation, deferring "player embeddings or lineup graphs" (i.e. who the
manager **chooses** to start) until the aggregate hypothesis survives. Having
now checked the real temporal behaviour of both endpoint families, this
turns out to be exactly the right sequencing, for a reason the directive text
doesn't yet state explicitly: **the two signals live on completely different
timelines**, and only one of them fits how this platform actually serves
predictions.

### 2a. Injury / suspension availability (roster-level, days in advance)

`APIFootballProvider.injuries()` queries `GET /injuries?league={id}&season={year}`
— every currently-injured player in a league for the current season. Per a
third-party technical description of the same documented endpoint, `/injuries`
also accepts a `fixture` parameter for a match-scoped query ("pass a specific
fixture ID and you get the injury and suspension report specifically for
that match") — **this repository's implementation does not use it**, querying
only the broader league+season form. `SportmonksProvider.injuries()` calls
`/sidelined` unfiltered by competition (the code's own comment: "the
subscribed API shape" has no league filter).

A roster injury or suspension is known once it happens and typically remains
known for days to weeks — this is compatible with the platform's primary
surface, which shows upcoming fixtures well before kickoff (`/upcoming/matches`,
the match selector), not a live pre-kickoff-only view.

### 2b. Confirmed starting lineup (tactical, minutes before kickoff)

Per a third-party technical description of API-Football's documented
`/fixtures/lineups` behaviour: **"lineups are available between 20 and 40
minutes before the fixture when the competition covers this feature"** —
checkable per-competition via the `leagues` endpoint's `coverage` field — and
for some competitions confirmed lineups are not published pre-match at all,
only after the match with a variable delay.

⚠️ **This is a hard architectural mismatch with the platform's primary
serving surface, not a caveat.** A prediction requested hours or days before
kickoff — the platform's main use case — structurally cannot use a confirmed
lineup, because it does not exist yet at request time. This is exactly why
`orchestrator._collect_lineup_refresh()` already exists as a separate,
late-firing profile distinct from `_collect_prematch_enriched()` — the
codebase already encodes this timing reality in its evidence-collection
design, even though (per §1) nothing consumes the result as a feature today.

**Conclusion: signal 2a (availability) is the one worth qualifying further
now. Signal 2b (confirmed lineup) is deferred, not rejected** — it may be
usable for a narrow near-kickoff refresh product surface in the future, but
building a feature around data that structurally does not exist for the
platform's primary use case is exactly the "build the model before the
information earns it" pattern §53 forbids.

---

## 3. Source Qualification Framework (§11 dimensions)

| Dimension | `api_football` `/injuries` | `sportmonks` `/sidelined` |
|---|---|---|
| Coverage | Unverified this session — requires a live probe across all 7 competitions to measure fixture/team coverage; not assumed |
| Historical depth | ⚠️ **Structurally limited.** `/injuries` returns *current* state for a league+season, not a point-in-time-queryable history. Per third-party documentation, `/sidelined` (per-player, batch via `players=`) does carry start/end dates and *could* answer "was player X out on date D" — but pricing research below shows historical range is itself tier-gated, and this repo's subscribed tier is not documented anywhere in code (rate limits are read from response headers dynamically, not hardcoded — confirmed via source read) |
| Temporal fidelity | Roster-level (injury/suspension): compatible with pre-kickoff serving. Confirmed-lineup: 20-40 min pre-kickoff only, some competitions post-match only (§2b) |
| Freshness | Not measured this session |
| Identity quality | `player_id`/`team_id` present on API-Football records; Sportmonks' `/sidelined` is explicitly unfiltered by competition per the code's own comment — cross-referencing against the wrong league's players is a real risk needing a coherence check before use |
| Reliability | Not measured this session (no live probe run) |
| Missingness | `_normalize_injury` (api_football.py:350) captures `player_id`, `player_name`, `team_id`, `team_name`, `fixture_id`, `injury_type`, `reason` — **no date field is captured**, so even live injuries carry no "since when" or expected-return signal today; would need normalizer work before any duration-weighted representation is possible |
| Independence | Injury/suspension state is not derivable from de-vigged market odds — a team's odds already price in *known* absences, but the model's own current feature vector has zero visibility into *why* a team is weaker this week, so this is a plausible independent-information candidate, not a market-reconstruction |
| Legal status | See §4 |
| Access stability | Both providers already `CONFIGURED_UNVERIFIED`/enabled in production (per live `/api/v1/providers/health`, confirmed this session: all 5 providers enabled) — access is not the blocker |
| Cost | api-football.com pricing (verified via WebSearch, 2026-09-09): Free 100 req/day, Pro $19/mo 7,500 req/day, Ultra $29/mo 75,000 req/day, Mega $39/mo 150,000 req/day. **This repo's actual subscribed tier is not documented in code and must be confirmed operator-side** before estimating backfill feasibility |
| Rate limits | Read dynamically from `x-ratelimit-requests-remaining`/`x-ratelimit-requests-limit` response headers (api_football.py:483) — no hardcoded assumption in code, correctly tier-agnostic, but means this study cannot state a number without a live probe |
| Integration cost | Low for wiring already-collected `ProviderResult` records into a feature (the orchestrator call already exists); moderate-to-high for historical backfill (see §5) |
| Compute cost | Negligible for the representation math itself (roster-strength arithmetic, not a model) |
| Operational fragility | Sportmonks' `/sidelined` is "unfiltered by competition" per its own code comment — a documented CLAUDE.md note also records that this provider's probe endpoint had to move off `/sidelined` to `/leagues` after finding the former 404s under the subscribed API shape; this needs re-verification, not reliance on a prior session's note, before Sportmonks is trusted for this signal |
| Provenance | `raw_snapshot_id=stable_hash(payload)` is already captured on every `ProviderResult` from both providers — raw-payload retention is already the existing convention, satisfying §32's requirement for any new source |

---

## 4. Legal / Access Classification (§12)

Both `api_football` and `sportmonks` are **L0 — Explicitly reusable**: they
are commercial APIs this platform already holds paid/keyed access to under
their own terms of service, for exactly the kind of production use already
made of their other endpoints (fixtures, standings, team statistics). No new
legal review is triggered by additionally reading `/injuries` or
`/sidelined` under the same subscription — these are not new vendors, they
are unused endpoints on vendors already under contract.

---

## 5. Coverage Gates (§15) — what must be measured before Phase 3, not assumed

| Gate | Question | Status |
|---|---|---|
| G1 — Fixture coverage | What % of SabiScore fixtures return a non-empty, coherent injuries record? | **Not measured.** Requires a live probe (`PROVIDER_LIVE_TESTS` gated, correctly not run in default CI) across all 7 competitions. |
| G2 — Historical depth | How many contiguous seasons does availability data cover? | **Not measurable from documentation alone.** `/sidelined`'s historical range is tier-gated per §3; requires either an operator-confirmed subscription tier or a live probe against a known historical player. |
| G3 — Cross-season stability | Does coverage collapse outside the provider's strongest seasons/competitions? | Not measured. |
| G4 — Cross-league portability | Does the signal generalise beyond one competition? | Not measured — Sportmonks' unfiltered-by-competition shape (§3) makes this gate *harder* to answer cleanly for that provider specifically. |
| G5 — Prediction-time availability | % available at the intended prediction cutoff | **Answered for signal 2b (confirmed lineup): fails structurally for the platform's primary surface (§2b).** Signal 2a (availability) is plausible but unmeasured — needs a probe comparing injury-report timestamps against the platform's typical prediction request time (days ahead). |
| G6 — Default rate | Would a high production default rate force this to be modelled as its own missingness signal? | Not measurable without G1/G5. |

**None of the six coverage gates can be honestly marked PASS from documentation
research alone.** This is the correct, expected outcome of Phase 2 — §40
Gate R1 exists precisely to stop a source from proceeding to Phase 3 (data
acquisition, entity resolution, temporal audit) on the strength of "the API
exists and looks reasonable." A live, `PROVIDER_LIVE_TESTS`-gated probe is
Phase 3 work, not Phase 2.

---

## 6. Information Opportunity Matrix (§13)

| Opportunity | Source | Signal | Current gap | Coverage | History | Temporal fidelity | Independence | Cost | Legal class | Integration | Leakage risk | Expected info gain | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Roster availability delta | `api_football` `/injuries` (fixture-scoped, unused today) | Which known players are unavailable this week | Total — acquired, discarded before the feature vector (§1) | Unmeasured (G1) | Current-season only as implemented; `/sidelined` may extend this but tier-gated | Compatible with pre-kickoff serving | Plausible (odds price *known* weakness, not *why*) | Already paid for | L0 | Low (wiring) to High (historical backfill) | Low if fixture-scoped correctly; **current league-wide query risks leaking non-fixture-relevant noise** | Unmeasured until Phase 3 | **Tier 0** (directive default) |
| Squad-quality-adjusted availability (replacement cost) | Same + a squad-strength baseline (does not exist locally — no `Player.market_value` populated) | Not just *that* a player is out, but *how much* strength is lost | Total — no representation exists, no squad-strength baseline table is populated | N/A | N/A | N/A | N/A | N/A (needs a strength source, itself unqualified) | N/A | High | N/A | Unmeasured | Tier 1 (conditional on Tier 0 surviving) |
| Confirmed starting XI / continuity | `api_football`/`sportmonks` `.lineups()` (collected, unused) | Actual tactical selection vs. expected | Total — collected via `LINEUP_REFRESH` profile, zero downstream consumer | Unmeasured | N/A — a per-fixture snapshot, no historical replay path documented | **Fails G5 for primary serving surface (§2b)** | N/A | Already paid for | L0 | Would need a new near-kickoff serving path, not a training feature | High if conflated with pre-kickoff serving | Deferred | Tier 1, deferred until a near-kickoff product surface exists |

---

## 7. Decision (§51)

**Signal 2a (roster injury/suspension availability): `RESEARCH`.**

Not `PROMOTE` — none of the six coverage gates (§5) have been measured, and
directive §44 explicitly prohibits building a feature before that evidence
exists. Not `HOLD` or `REJECT` — this is not a weak or implausible
hypothesis; it is a plausible, low-marginal-cost-to-test candidate sitting
on infrastructure that already exists (two authenticated providers, an
orchestrator call site, a `ProviderResult` provenance contract), where the
correct next action is bounded and cheap relative to standing up a new
vendor from scratch. Concretely, before any feature-schema or model work:

1. Run a live probe (`PROVIDER_LIVE_TESTS=true`, deliberately outside default
   CI) against `api_football.injuries()` scoped by `fixture` (not the current
   league+season query) across a sample of upcoming fixtures in all 7
   competitions, to answer G1 and G5.
2. Confirm this repository's actual subscribed api-football.com tier
   (operator-only — not visible in code) to bound what historical range
   `/sidelined` can actually answer, before assuming any backfill is
   feasible.
3. Re-verify Sportmonks' `/sidelined` endpoint against the live subscription
   rather than trusting the prior session's note that it 404s under this
   plan's shape — that note is now stale relative to today's live probe
   opportunity and should be re-confirmed, not carried forward.
4. Extend `_normalize_injury` to capture whatever date/duration field the
   raw payload actually carries (currently discarded, §3) — needed before
   any severity- or recency-weighted representation is possible.

**Signal 2b (confirmed starting lineup): `HOLD`.** The information is real
and already collected, but it structurally cannot serve the platform's
primary "browse upcoming fixtures" surface (§2b, §5 G5). Revisit only if a
near-kickoff product surface is separately prioritised — do not build a
training feature around it in the meantime.

**Squad-quality-adjusted availability (replacement cost): `HOLD`**, strictly
downstream of signal 2a surviving Phase 3 — there is no local squad-strength
baseline to weight it against yet, and building one is a separate,
larger qualification question this document does not attempt.

No production code, feature schema, or model artifact is affected by this
document. No `feature_schema_version` was created. This is a Gate R1
deliverable only.
