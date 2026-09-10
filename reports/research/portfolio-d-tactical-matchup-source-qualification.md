# Portfolio D — Tactical Matchup Intelligence: Source Qualification Study

**Directive reference:** `PRODUCTION_EXECUTIVE_DIRECTIVE.md` §8 (Portfolio D),
§23 (Event Data Research Programme, gates D1–D5), §40 (Gate R1 — Source
Qualification), §47 Action 6 ("Re-run all event-data coverage audits... Do
not authorize VAEP/xT merely because the libraries are available").
**Phase:** 2 (Missing Information Discovery) → gates the decision to proceed
to Phase 3 (Data Qualification). **No production code was written or changed
to produce this document** — per §45, "No production integration yet" until
a source clears qualification.
**Date:** 2026-09-09. **Author:** this session, via direct code inspection
of `backend/src/models/feature_registry.py`, `backend/scripts/audit_statsbomb_coverage.py`,
and `backend/src/connectors/understat_source.py`. No new external network
call was needed to reach the decision below — see §0.
**Prior art:** none under the name "Portfolio D" or "tactical". The
data-source question it depends on, however, has already been asked and
answered for a different portfolio — see §0.

---

## 0. Why this is not starting from zero — and why no new audit was run

Rule 2 ("look before you write") and §23's D1 gate ("the StatsBomb/Understat
identity crosswalk must be measured") both require checking existing
evidence before qualifying a new source. §42 separately forbids re-running a
closed question without new information, a corrected methodological defect,
or previously unavailable statistical power.

Portfolio D's §8 hypothesis is built entirely on **team-behaviour ×
opponent-susceptibility interaction terms**, and every named example
requires StatsBomb-grade event/spatial data as its raw ingredient:

| §8 example interaction | Raw ingredient it needs |
|---|---|
| pressing vulnerability × opponent build-up quality | pressure events, pass network under pressure |
| low-block attack quality × opponent low-block defense | possession-chain / block-height events |
| transition creation × opponent transition concession | turnover-to-shot sequences |
| aerial/set-piece strength × opponent set-piece weakness | shot-by-situation tagging, set-piece event tagging |
| progressive carrying × opponent defensive channel exposure | carry events with start/end coordinates |
| defensive line height × opponent runner threat | player/ball spatial tracking or line-height proxy |

**That exact raw ingredient — StatsBomb Open Data event coverage against the
five-league, seven-season corpus SabiScore actually trains on — was already
measured on 2026-09-04** (`scripts/audit_statsbomb_coverage.py`, report:
`reports/evaluation/statsbomb-coverage-audit-2026.json`, referenced in
`docs/DEBT.md` Finding 9 and `feature_registry.py`'s own inline commentary).
Running a second, differently-named audit against the identical source and
the identical corpus would violate §42, not satisfy it — there is no new
information, no corrected defect, and no new statistical power to justify
reopening a measured question. This report reuses that result directly, per
Rule 2's instruction to check what already flows through the platform before
evaluating anything as new.

---

## 1. The decisive existing evidence

**StatsBomb Open Data / Understat identity-crosswalk coverage: 23.58%**,
against an 85% threshold this codebase already established as its bar for
this exact source (`COVERAGE_THRESHOLD_PCT = 85.0` in
`audit_statsbomb_coverage.py`). Consequence, already live in
`feature_registry.py` since 2026-09-04:

```python
PHASE7_FEATURES_ALWAYS_DATA_GAP: List[str] = [
    "shot_quality_diff",
    # Formally relegated 2026-09-04 per StatsBomb coverage audit (23.58% < 85%):
    "home_pressing_intensity",
    "progressive_carry_diff",
    ...
]
```

These two features are the closest things this codebase has ever built to a
Portfolio-D-shaped signal — team-level *pressing intensity* and
*progressive-carry* aggregates, one derivational step short of the
interaction terms §8 actually wants. Both are permanently forced to their
registry default value in every live prediction; the audit's own unblock
condition is explicit: **"re-evaluate if StatsBomb publishes event data
covering ≥85% of the Understat corpus date range."**

Portfolio D's interaction terms sit **strictly downstream** of these two
features in data-requirement terms — an interaction needs the same
event-level source at the same coverage, for *both* sides of a fixture, plus
additional derived structure (pressure sequences, carry vectors) beyond what
the already-relegated single-team aggregates needed. If the raw ingredient
fails coverage for a simple team-level aggregate, it cannot pass coverage
for a more demanding pairwise interaction built from the same ingredient.

**Per-league detail** (from the same audit, `reports/evaluation/statsbomb-coverage-audit-2026.json`):
StatsBomb Open Data's free tier is a curated set of specific competitions
and seasons, not a rolling domestic-league feed — it does not cover five
top-flight European leagues across seven seasons at all, which is the
structural reason coverage lands at 23.58% rather than merely "low."

---

## 2. One narrower thread checked, and closed for now

Before accepting the StatsBomb ceiling as the final word, this session
checked whether Understat — already fully ingested (12,560 real matches,
zero StatsBomb dependency) — could supply a narrower proxy for just one
interaction: **set-piece threat**, via a shot-level "situation" tag
(open-play / set-piece / penalty), which Understat's own website does carry
per shot.

`backend/src/connectors/understat_source.py`'s `UnderstatTeamXGSource` does
**not** plumb this. `team_match_xg()` calls `soccerdata`'s
`read_schedule()`, which returns one row per **match** (`home_team`,
`away_team`, `home_xg`, `away_xg`) — there is no shot-level reader wired in
anywhere in this codebase (`read_shot_events()` or equivalent is never
called). Building this would be new data-acquisition engineering, not
something "look before you write" finds already flowing through the
platform — it would need its own Rule 2 chain (coverage, legality,
temporal fidelity, missingness, redundancy) before any engineering time is
justified, exactly per §11.

**Not pursued this session.** Recorded as a distinct, smaller, still-open
Tier 2 thread — narrower than Portfolio D's full §8 scope, plausible, and
unqualified — rather than folded into the HOLD verdict below by omission.

---

## 3. A caution the directive's own Rule 7 already anticipates

Even setting coverage aside, it is worth naming explicitly why Portfolio D's
value is *not* "take two features already in the model and multiply them."
`home_pressing_intensity` and `progressive_carry_diff` are 2 of the 68
features already in the canonical schema (registry-defaulted, per §1, but
structurally present). A hand-crafted multiplicative or ratio interaction
between two features already visible to a tree-based ensemble
(`StackingClassifier` over gradient-boosted base learners, per this
platform's model family) has low expected marginal value — tree splits
already discover conditional structure between existing inputs without
being told the interaction in advance. Rule 7 ("redundant reconstruction is
not independent signal") and §44's ban on "blind feature-density expansion"
both point the same direction: Portfolio D's genuine research value is
strictly in the **new granularity** (pressure sequences, carry vectors,
transition tagging) that no existing feature encodes at all — which is
exactly the ingredient §1 shows is coverage-blocked. There is no cheaper
version of Portfolio D available by recombining what the model already has.

---

## 4. Gate assessment (§15, reusing the 2026-09-04 measurement)

| Gate | Verdict | Basis |
|---|---|---|
| G1 — fixture coverage | **FAIL** | 23.58% of the Understat-identified corpus has a StatsBomb event-data match, against an 85% bar this codebase already set for the same source. |
| G2 — historical depth | Not separately measurable | StatsBomb Open Data's free tier is a curated competition/season selection, not a contiguous domestic-league archive — "historical depth" is not the limiting dimension; breadth of competition coverage is. |
| G3 — cross-season stability | **FAIL (by construction)** | The free tier's competition list does not grow with the calendar; coverage will not improve by waiting for more seasons to pass. |
| G4 — cross-league portability | **FAIL** | Per-league breakdown in the 2026-09-04 audit shows uneven, generally low coverage across the five scoreable leagues — the same failure shape Portfolio F's weather study found for a different reason. |
| G5 — prediction-time availability | Not reached | Blocked upstream by G1; a source that cannot supply historical training coverage cannot be evaluated for live serving timing. |
| G6 — default rate | **FAIL** | A ~76% default/gap rate on the raw team-level ingredient is already what forced `home_pressing_intensity`/`progressive_carry_diff` into `PHASE7_FEATURES_ALWAYS_DATA_GAP`; an interaction built from two such ingredients would default at least as often, and Rule 5 forbids filling that gap with a neutral value. |

---

## 5. Decision (§51)

**`HOLD`.** Not `REJECT` — nothing here says tactical interaction data lacks
predictive information; the question cannot yet be asked at adequate
coverage, and rejecting on that basis would record a negative result this
study did not produce (the same reasoning Portfolio F's weather study
applied to its own G1 failure). Not `RESEARCH` — the next step is not more
analysis of the current source; it is the same external precondition
already on record for the two StatsBomb features this portfolio would have
built on: **StatsBomb Open Data publishing event coverage ≥85% of the
Understat corpus date range.** That is not achievable through further
engineering in this repository today.

**Unblock condition — identical to, not merely similar to, the one already
recorded for `home_pressing_intensity`/`progressive_carry_diff`.** Re-run
`scripts/audit_statsbomb_coverage.py` if StatsBomb's published competition
list changes; if and only if coverage clears 85%, Portfolio D's Gate R1
becomes newly answerable and this document should be revised, not
duplicated (§42).

**The narrower set-piece/Understat-situation thread (§2) is separately
`HOLD`**, pending its own Rule 2/§11 qualification chain if ever
prioritised — it does not inherit the StatsBomb ceiling, but it also has not
yet been qualified on its own terms.

No production code, feature schema, or model artifact is affected by this
document. No `feature_schema_version` was created. This is a Gate R1
deliverable only.
