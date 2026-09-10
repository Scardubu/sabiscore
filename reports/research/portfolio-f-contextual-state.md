# Portfolio F — Contextual State (rest, congestion, referee)

**Directive reference:** `PRODUCTION_EXECUTIVE_DIRECTIVE.md` §10 (Portfolio F),
§16 Stage 1-3, Rule 6, Rule 7.
**Phase:** 4 (Information-Value Testing) — no acquisition phase needed; every
feature derives from `backend/data/cache/fd_*.csv`, already on disk.
**Date:** 2026-09-09.
**Script:** `backend/scripts/study_portfolio_f_contextual_state.py`.
**Raw output:** `reports/research/portfolio-f-contextual-state-report.json`.
**Tests:** `backend/tests/unit/test_portfolio_f_contextual.py` (6).

§10 sets an explicit prior for this portfolio: *"intentionally lower
priority... must prove information value before engineering investment...
likely weaker than player availability, team state, tactical interaction,
and information-arrival signals."* This study tests that prior rather than
assuming it.

---

## 1. Two real defects found mid-study — both changed the answer

Neither was caught by a test. Both were caught by **reading the Stage 1
descriptive output before looking at the headline result**, which is the
entire argument for computing descriptives first.

### Defect 1 — rest days leaked across the summer break

`rest_diff` came back with a range of **[−357, +357] days** and stdev 17.75.
Impossible for "days since previous fixture." Cause: the rest/congestion
state was keyed `(league, team)` with no season component, so at every season
opener a team's "previous fixture" was its last match of the *prior* season.

Fixed by keying `(league, season, team)`. **This materially changed the
result**: the rest+congestion test moved from **+0.0007** (candidate worse)
to **−0.0001** (indistinguishable from zero). Pinned by
`test_rest_days_reset_across_seasons`.

### Defect 2 — referee data exists for one league, diluted across five

Referee history covered only 21.46% of test fixtures. Cause: **only 7 of 36
corpus files carry a `Referee` column, and all 7 are `E0` (EPL).** Running
the referee study pooled across five leagues meant four of them contributed
a constant zero, diluting a genuine single-league signal into a fake null.

Fixed by scoping the referee studies to EPL, where coverage is **98.9%**, and
reporting per-league coverage explicitly so the limitation is visible rather
than buried:

```text
referee_coverage_by_league: EPL 98.9%  |  BUNDESLIGA 0.0%  LA_LIGA 0.0%
                            LIGUE_1 0.0%  SERIE_A 0.0%
```

---

## 2. ⚠️ Leakage guard — the real risk in this study

A referee's home-win rate computed over the whole corpus would include the
very fixtures being predicted: a textbook target leak that would manufacture
a spectacular and entirely fake result.

`enrich_contextual()` makes a single chronological pass. Every statistic for
a fixture is computed from state accumulated by **strictly earlier**
fixtures; that fixture then updates the state. A fixture can never see
itself or its own future. Small-sample referees are shrunk toward the
contemporaneous league base rate (empirical-Bayes prior of 20 matches), so a
referee with three prior matches is not treated as carrying signal.

**The guard was watched failing before being trusted.** Deliberately moving
the state update *before* the feature computation — i.e. letting a fixture
see its own outcome — makes exactly the two leakage tests
(`test_first_fixture_for_a_referee_has_no_prior_history`,
`test_referee_bias_never_includes_the_fixture_being_scored`) go red, and
restoring makes them green. Rest and congestion carry no equivalent risk:
both depend only on the dates of that team's own earlier fixtures.

---

## 3. Results — Stage 3, incremental value beyond the market

Train 2022+2023, test 2024. Baseline is de-vigged Bet365
`[P(home), P(draw), P(away)]`; the candidate adds the contextual features.
Negative difference = candidate better.

| Study | Slice | n | baseline RPS | candidate RPS | diff | 95% CI |
|---|---|---:|---:|---:|---:|---|
| F1 — rest + congestion | pooled | 1,752 | 0.19488 | 0.19481 | −0.0001 | [−0.0005, +0.0003] |
| F2 — referee | EPL only | 380 | 0.19988 | 0.20002 | +0.0001 | [−0.0003, +0.0006] |
| F3 — all three | EPL only | 380 | 0.19988 | 0.19998 | +0.0001 | [−0.0017, +0.0018] |

**Every result is a tight null.** Not one confidence interval excludes zero,
and the point estimates are at or below the fourth decimal place in both
directions. F2 and F3 are even marginally *positive* — the contextual
features made the model very slightly worse, which is the ordinary
consequence of spending model capacity on a feature carrying no information.

### Stage 1 descriptive (post-fix, sane)

```text
rest_diff:  mean -0.021  stdev 1.907  range [-23, +17]
congestion_diff nonzero on 24.8% of fixtures
referee history: EPL 98.9%, all other leagues 0.0%
```

The features are not degenerate — rest and congestion genuinely vary across
fixtures. The null is not "we measured nothing"; it is "we measured real
variation and it carried no information the market had not already priced."

---

## 4. Decision (§51): `REJECT`

**`REJECT`, not `HOLD`** — and the distinction is the point.

Portfolio B's null was *wide*: a small effect that the available sample could
not resolve, with a consistently-signed point estimate across all five
leagues. That earns `HOLD`, because absence of evidence was not evidence of
absence.

Portfolio F's nulls are *tight and unsigned*: narrow CIs, centred on zero,
with point estimates that flip sign between studies. That is positive
evidence the effect is absent at any magnitude worth engineering for — not a
statement about sample size.

**This confirms the directive's own stated prior** (§10: contextual state is
"likely weaker than player availability, team state, tactical interaction,
and information-arrival signals"). The prior was correct, and it is now
measured rather than assumed.

### What would reopen this (§42)

Only genuinely different information, not a different model:

- **Travel distance / time-zone displacement**, which §10 lists and this
  corpus cannot supply — it has no venue coordinates. That is this same
  portfolio's unresolved venue-location work (`docs/DEBT.md` item 44, `HOLD`
  at 68.9% derivable), so this reopening is blocked behind that same review.
- **Referee data for the other four leagues**, which would make F2 a real
  five-league test rather than an EPL-only one.
- A **materially longer congestion window or cup-inclusive fixture list** —
  this corpus is domestic-league only, so a team's midweek European or cup
  fixtures are invisible to the congestion count. That is a genuine
  measurement limitation, not a modelling choice, and it plausibly attenuates
  the true congestion effect toward zero.

That last point is the honest caveat on this rejection: **congestion is
measured against domestic fixtures only.** A club playing Thursday Europa
League fixtures registers as fully rested here. The rejection is therefore
sound for *domestic-schedule* congestion and understated for true fixture
load.

**No production code, feature schema, or model artifact changed.**
