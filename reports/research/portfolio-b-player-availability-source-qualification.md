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

**Signal 2a (roster injury/suspension availability): `RESEARCH` → revised to
`HOLD` the same day, after the live probe named below actually ran.**

The original verdict (below, struck through in spirit not in fact — kept for
the record) reasoned from documentation alone, correctly per Phase 2's own
rules, and named the live probe as the bounded next step:

> Not `PROMOTE` — none of the six coverage gates (§5) have been measured, and
> directive §44 explicitly prohibits building a feature before that evidence
> exists. Not `HOLD` or `REJECT` — this is not a weak or implausible
> hypothesis; it is a plausible, low-marginal-cost-to-test candidate.

**That probe ran the same day** (real credentials, previously misdiagnosed
as absent — see `docs/DEBT.md` item 65's follow-up section for the exact
attribute-name bug), via `backend/scripts/probe_player_availability_sources.py`
(2 GET requests, read-only). Result, decisive:

- `api_football.injuries(competition="EPL")` → `UNAVAILABLE`,
  `api_logical_error`, plan message verbatim: *"Free plans do not have
  access to this season, try from 2022 to 2024."* This subscription is the
  free plan, and the free plan cannot query the current season's injuries
  at all — a hard tier wall, not a coverage gap G1/G5 could have measured
  differently.
- `sportmonks.injuries(competition="EPL")` → `TRANSPORT_CLIENT_ERROR`, HTTP
  404 on `/sidelined`, live-reconfirmed today (not a stale note carried
  forward).

**Revised verdict: `HOLD`, not `REJECT`.** Nothing here says player
availability is uninformative — both failures are subscription/endpoint
problems. api-football.com's own pricing tiers (§3) explicitly gate "volume
and historical range" by plan; a $19/mo Pro subscription plausibly resolves
the api_football half outright. The engineering-only next steps this
document could responsibly recommend (build the adapter, test it, run the
probe) are now **done and answered negatively as currently configured**.
What remains is a business/operator decision (pay for a higher tier;
separately investigate whether Sportmonks needs a different endpoint or
plan), not more code from this document's own scope. Remaining
non-blocked next step, cheap and still open: query api_football with an
explicit `season=2024` (within the free plan's allowed range) to confirm
the endpoint otherwise works and only the current season is blocked — the
shipped `injuries()` has no season override yet to test this with.

`_normalize_injury`'s discarded date field (§3) remains unaddressed —
correctly deferred, since there is no live response to extend the
normalizer against until a paid tier or a different query actually returns
current-season records.

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

---

## 8. Follow-up — the "remaining non-blocked next step" ran; it changes the verdict shape

**Date:** 2026-09-09 (same day). §7 named one open, cheap, non-blocked next
step: query `api_football` with an explicit `season=2024`. `injuries()` had
no season override to do this with, so one was added — a single optional
`season: int | None = None` keyword, defaulting to the existing
`_current_season()` behaviour for every caller that omits it (orchestrator's
`_collect_prematch_enriched` is unaffected; regression-pinned by
`test_injuries_explicit_season_overrides_current_season` in
`backend/tests/providers/test_api_football.py`). The probe script gained a
matching `1b)` step. Both ran live against the real subscribed credential.

**Result, decisive and new:**

```text
1) injuries(competition=EPL)              -> UNAVAILABLE, api_logical_error
   "Free plans do not have access to this season, try from 2022 to 2024."
1b) injuries(competition=EPL, season=2024) -> VERIFIED, 3,168 records
   quota: limit=100/day, remaining=99 (one request spent)
   sample: {player: "W. Fish", team: "Manchester United",
            fixture_id: 1208021, reason: "Ankle Injury"}
2) injuries(fixture_id=1208021)            -> VERIFIED, 6 records
   distinct_fixture_ids_returned: {1208021}
   scoped_query_actually_scoped: True
```

This is materially different from "the free tier is blocked," which was the
correct reading of the evidence available at the time §7 was written. It
splits signal 2a into two questions with two different answers:

| Question | Answer | Basis |
|---|---|---|
| Can this subscription serve **live**, current-season availability to today's upcoming-fixture surface? | **No — still `HOLD`.** | The API's own error message is unambiguous; this is a plan tier, not a code, limitation. Unblocking it is an operator subscription decision (§3's $19/mo Pro estimate), not more engineering. |
| Can this subscription supply a **historical, point-in-time-correct** injury corpus for a Phase 3/Stage 3 "does availability move out-of-sample RPS" experiment? | **Yes — Gate G1 now measured, not assumed, and passes for at least EPL/2024.** | 3,168 coherent records in one call is a rich per-competition-per-season dataset, not a thin one. |

The fixture-scoped result is the second load-bearing finding: `docs/DEBT.md`
item 65 and this report's own §3 had flagged the `fixture` query-param
behaviour as "unit tested, response semantics not [live-verified]." It is
now live-verified: querying `fixture_id=1208021` returns exactly the 6
records belonging to that match (`distinct_fixture_ids_returned == {1208021}`),
which is precisely the join key Rule 3 requires for "exactly when did this
information become knowable" reconstruction — an injury record carries a
`fixture_id`, and a fixture carries a `kickoff_utc`, so a per-fixture
availability snapshot is a real, joinable, historically reconstructable
object, not a hypothesis about one.

**What this does and does not authorize.** This is still Phase 2 evidence,
gathered to close out Phase 2's own open item — it does not, by itself,
clear Gate R2 (information qualification) or Gate R3 (forecast improvement).
Per §45/Phase 3, the legitimate next increment is bounded and specific:
acquire the 2022–2024 seasons across the 5 leagues with a real
`league_policy`-calibrated model (21 requests at most against a 100/day
quota — cheap), build the point-in-time join to historical fixtures, run the
missingness/entity-resolution audit Phase 3 requires, and only then attempt
Stage 3's incremental-information test (`incumbent` vs `incumbent + signal`,
paired, walk-forward, against the same holdout this repo already uses for
every other candidate). That is real, non-trivial research work — not
executed in this pass, so as not to spend further quota or commit to a
larger scope without a checkpoint. Sportmonks' `/sidelined` 404 is
reconfirmed unchanged; that half of the source pairing stays `HOLD` pending
a different endpoint or plan, independent of anything above.

**Revised decision:** Signal 2a is `HOLD` for live serving, **`RESEARCH`
(cleared to proceed)** for Phase 3 historical data qualification — no longer
blocked on any operator or business decision. Signals 2b (confirmed lineup)
and squad-quality-adjusted availability are unchanged at `HOLD` for the
reasons already given in §7.

---

## 9. Phase 3 executed — Gate G1/G4 measured across the real corpus, not projected from one league

**Date:** 2026-09-09 (same day, continued). §8 scoped Phase 3 as "acquire the
2022–2024 seasons across the 5 leagues... build the point-in-time join...
run the missingness/entity-resolution audit." That ran. New script:
`backend/scripts/qualify_player_availability_coverage.py`, pure resolver
logic pinned by 7 tests in
`backend/tests/unit/test_player_availability_coverage_qualification.py`.

**Method.** For each of the 5 leagues with a local historical corpus file
(`backend/data/cache/fd_*.csv` — the same 12,765-match archive the
production models train on) × seasons {2022, 2023, 2024}: fetch
`injuries(competition=league, season=year)` live, then run **two
independent checks per coherent record** — (1) does `team_name` resolve to
a real club in that league's corpus roster, using the identical
identity-key algorithm and already-audited alias tables
`services/team_identity.py` uses in production (inlined rather than
imported, since that module opens a database connection at import time —
`docs/DEBT.md` item 7 — and no database is reachable from this session);
(2) for records whose team resolved, does `fixture_date`'s calendar date
match a real match date for that team in the corpus that season. EREDIVISIE
was excluded — no 2022–2024 corpus file exists locally for it (consistent
with the already-documented single-season Eredivisie history); UCL was out
of scope from the start (§0 — no domestic-league corpus to crosswalk a
Champions League fixture against).

**A methodological correction made mid-run, not glossed over.** The first
full sweep (18 back-to-back requests, no pacing) returned `api_logical_error`
for 5 of 18 league-seasons and a suspiciously low ~65% date-match rate.
Re-querying two of the "failed" combinations in isolation immediately
returned `VERIFIED` — a burst throttle, not a genuine per-league
restriction, so the sweep was re-run with a 1-second pause between calls.
Separately, `pd.to_datetime(..., dayfirst=True)` was silently mis-parsing a
subset of rows even though the corpus's `date` column is unambiguous ISO
`YYYY-MM-DD` — switching to `dayfirst=False` alone moved the aggregate
date-match rate from ~65% to 99.9%. Both fixes were watched changing the
result, not applied speculatively.

**Result — the corrected, final sweep:**

```text
League       Seasons queried   Records   Team-resolved   Date-matched (of resolved)
EPL          2022-2024         10,077    84.7-91.3%      100.0%
LA_LIGA      2022-2024          7,913    85.6-89.8%      100.0%
SERIE_A      2022-2024          8,232    100.0%          100.0%
BUNDESLIGA   2022-2024          7,711    99.5-99.8%      99.6-99.9%
LIGUE_1      2022-2024          7,255    87.0-90.1%      99.6-100.0%

AGGREGATE (15 league-seasons, 41,188 records):
  92.2% team-resolved
  99.9% of those date-matched
  => ~92.1% of ALL records fully crosswalk to a real, dated corpus fixture
```

Full per-league-season detail, including every unresolved team name, in
`reports/research/portfolio-b-availability-coverage-manifest.json`.

**Gate assessment, measured rather than assumed:**

| Gate | Verdict | Basis |
|---|---|---|
| G1 — fixture coverage | **PASS** | 92.1% end-to-end crosswalk rate, well above the 85% bar this codebase already uses elsewhere (Portfolio D §1, the StatsBomb audit). |
| G4 — cross-league portability | **PASS** | No league collapses — the low end is LIGUE_1 team-resolution at 87.0%, not a 30+ point spread like Portfolio C's weather study found. |
| G6 — default rate | **PASS (implied)** | <8% of records would need to be treated as a genuine data gap. |

**The residual 7.8% unresolved is small, closed, and named — not
absorbed.** 13 distinct team names across 4 leagues, all real clubs the
resolver's inherited alias tables simply don't cover in this direction:
`Manchester United` (EPL corpus spells it `Man United`), `Paris Saint
Germain` (corpus: `Paris SG` — the existing `_AUDITED_ALIASES` entry maps
the *other* direction, `"paris sg" -> "paris saint germain"`, which does not
help a caller that already has the long form), `Athletic Club`, `Atletico
Madrid`, `Espanyol`, `Nottingham Forest`, `Sheffield Utd`, `Fortuna
Dusseldorf`, `Hamburger SV`, `SV Elversberg`, `Metz`, `Saint Etienne`,
`Stade Brestois 29`. **Not patched here** — `_AUDITED_ALIASES` is
production-shared, and every existing entry documents having been verified
against real match/Elo history before being asserted (per the module's own
comments); adding entries on this session's say-so without that same
verification would be exactly the kind of guessed alias this codebase's own
Wolves/Wolvesnewton and Paris FC/PSG incidents warn against. Recorded as a
precise, human-reviewable residual for whoever owns that table next.

**What this does and does not authorize.** Phase 3's data-qualification
bar is now cleared with real evidence, not merely "no longer blocked."
Still not authorized: any feature schema change, model training, or
incremental-information test — that is Phase 4 (§40 Gate R2/R3, directive
§16 Stage 1-3), which needs its own careful sequencing (descriptive →
dependence → incremental forecasting, walk-forward, paired, block-bootstrap
CI against both the incumbent and the market) rather than being appended to
an already-substantial session. No production code, feature schema, or
model artifact touched by this section.

---

## 10. Phase 4 executed in full — Stage 1, 2, and 3, ending in a real, evidence-backed `HOLD`

**Date:** 2026-09-09 (same day, continued). All three information-value
gates directive §16 requires were run in sequence, none skipped.

### Stage 1 — descriptive (`backend/scripts/analyze_player_availability_dependence.py`)

Built a fixture-level join (not the record-level view Phase 3 used):
`availability_diff = home_unavailable_count − away_unavailable_count`, one
row per fixture, distinct `player_id` deduplicated within each (team, date)
so a player re-listed across gameweeks for a long injury is counted once,
not once per record. **98.16% fixture-level coverage** (5,232 of 5,330
fixtures carry signal on at least one side) — a healthier number than the
92.1% record-level figure in §9, as expected since a fixture needs only
partial signal to register. Distribution: mean −0.123, median 0, stdev
3.10, range [−11, +12] — real variation, not degenerate.

### Stage 2 — dependence

Pooled Pearson correlation between `availability_diff` and match outcome
(home win = +1, draw = 0, away win = −1): **r = −0.0788, 95% CI [−0.1057,
−0.0518], n = 5,232** — the CI excludes zero, and the sign matches theory
(a more-depleted home side trends away from a home win). Tercile
breakdown made the size concrete: home win rate falls **47.5% → 43.1% →
40.4%** and away win rate rises **26.8% → 31.2% → 35.3%** moving from
"home less depleted" to "home more depleted."

**Robustness check, run before trusting the pooled number (§18):**
per-league correlations are genuinely heterogeneous, not uniform:

| League | r | 95% CI | Significant? |
|---|---|---|---|
| SERIE_A | −0.126 | [−0.183, −0.068] | Yes |
| LIGUE_1 | −0.163 | [−0.224, −0.101] | Yes |
| BUNDESLIGA | −0.105 | [−0.169, −0.041] | Yes |
| EPL | −0.045 | [−0.103, +0.014] | No (CI includes zero) |
| LA_LIGA | +0.013 | [−0.046, +0.072] | No — wrong sign, centered on zero |

3 of 5 leagues individually corroborate the pooled effect; EPL is
directionally consistent but underpowered; LA_LIGA shows no effect at all.
Pooling was masking real cross-league heterogeneity — reported rather than
smoothed over.

**Per §16, this is diagnostic only and does not itself authorize anything.**
It answered the question it exists to answer: the signal is not obviously
inert, so the heavier Stage 3 investment is justified.

### Stage 3 — incremental forecasting vs. the market (`backend/scripts/test_player_availability_incremental_value.py`)

The test Rule 7 actually requires: does `availability_diff` reduce
out-of-sample RPS **beyond what the market already prices in** — a raw
correlation with outcome is not evidence of independent information if the
market already accounts for the same public team news.

- **Baseline**: multinomial logistic regression on de-vigged Bet365
  `[P(home), P(draw), P(away)]` alone.
- **Candidate**: same + `availability_diff`.
- **Reference**: the raw de-vigged market probabilities themselves,
  unmodeled.
- **Split**: train on seasons 2022+2023 (n=3,578), test on season 2024
  (n=1,752) — the only genuine walk-forward split three seasons of corpus
  history allows; train strictly precedes test, no shuffling.
- **Significance**: paired per-fixture RPS difference (candidate −
  baseline), non-overlapping block-bootstrap (block size 10, 1,000
  replicates) — reused `src/models/evaluation/metrics.py`'s
  `ranked_probability_score`/`block_bootstrap_ci` rather than
  reimplementing either.

**Result:**

```text
Pooled (n=1,752): rps_raw_market=0.19463  rps_baseline=0.19488  rps_candidate=0.19445
  candidate − baseline: -0.0004, 95% CI [-0.0010, +0.0001]  <- includes zero

Per league, candidate − baseline point estimate (all five negative — same
direction as the pooled result — but every single CI also includes zero):
  EPL         -0.0005  CI [-0.0022, +0.0011]
  LA_LIGA     -0.0004  CI [-0.0012, +0.0005]
  SERIE_A     -0.0003  CI [-0.0015, +0.0010]
  BUNDESLIGA  -0.0006  CI [-0.0018, +0.0007]
  LIGUE_1     -0.0005  CI [-0.0018, +0.0007]
```

**The candidate model beats both the baseline model and the raw market on
point estimate, in every single league and pooled — but no confidence
interval, pooled or per-league, excludes zero.** This is not a contradiction
of Stage 2: Stage 2 measured raw correlation with outcome; Stage 3 measures
correlation **beyond what the market already prices**. A professional
market that already incorporates public team news would be expected to
absorb most of a raw availability signal, leaving only a small residual —
exactly the small-but-consistently-directional, not-yet-significant pattern
observed here.

### Decision (§51): `HOLD`

**Not `PROMOTE`.** The primary significance test (paired block-bootstrap CI
excluding zero) fails, pooled and in every league.

**Not `REJECT`.** A negative point estimate in all 5 leagues, in the
theoretically correct direction, is not the pattern of an inert or
noise-only signal — it is the pattern of a real but currently underpowered
effect. §51's own default applies directly: "The default decision after an
inconclusive small sample is HOLD, not PROMOTE and not forced REJECT."

**What would change this.** More seasons (the corpus has only 3 to split
temporally; a 4th+ season would allow genuine k-fold walk-forward and
narrower CIs), or pooling across a larger cross-competition sample if the
effect is genuinely homogeneous enough to justify it despite §18's own
caution about doing exactly that.

**No production code, feature schema, or model artifact changed.** Two new
scripts (Stage 1-2, Stage 3), 7 new unit tests on their pure logic (de-vig
math, RPS scoring, bootstrap wrapper — not the network fetch or model fit),
raw datasets persisted for reproducibility without needing to re-spend
`api_football`'s 100/day free-tier quota
(`portfolio-b-availability-outcome-joined.json`,
`portfolio-b-stage3-dataset.json`). This closes the information-value-testing
loop for Portfolio B's primary hypothesis (roster injury/suspension
availability) — the directive's own definition of a complete research cycle
(§48), ending in a real, evidence-backed `HOLD` rather than either an
unearned promotion or a premature rejection.
