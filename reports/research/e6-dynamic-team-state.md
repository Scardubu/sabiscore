# Experiment E6 — Dynamic Team State

**Directive:** `docs/PRODUCTION_EXECUTIVE_DIRECTIVE.md` §43 E6, §16 Stage 1–3, §18, Rules 6/7/8/9.
**Date:** 2026-09-10
**Verdict (§51):** ~~`HOLD` beyond the incumbent~~ → **`REJECT`, reattributed** · `REJECT` for the uncertainty channel · `REJECT` beyond the market
**Artifacts:** `reports/research/e6-dynamic-team-state.json`, `backend/src/features/dynamic_team_state.py`, `backend/scripts/study_e6_dynamic_team_state.py`

> ⚠️ **AMENDED 2026-09-10 — H1's HOLD has been reattributed and no longer stands
> as written.** The 2×2 ablation §8 of this document called for was run:
> `reports/research/e6-ablation-2x2.md`. It shows the −0.0012 below came
> **entirely from dropping Elo's season-carryover regression**, not from the
> state-space gain, which is neutral-to-slightly-harmful in *both* carryover
> conditions (+0.00024 and +0.00014). Plain incumbent Elo with the carryover
> rule switched off scores 0.20121 — better than this study's own candidate,
> with no state-space machinery at all. **Read §7's H1 verdict together with
> that amendment.** The rest of this document — the design, the Stage 1
> cadence finding, the Stage 2 redundancy, H2 and H3 — is unaffected.

---

## 1. The question

> "Hypothesis: latent team strength changes faster than current Elo/rating
> representation. Candidate: lightweight state-space model." — §43 E6

The incumbent is `features/elo_replay.py::FastEloReplay`: Elo with a **fixed**
K. A fixed K encodes one assumption — every result carries the same
information about current strength, however stale the prior estimate. A club
returning from a 90-day summer break and a club playing its third match in
eight days both move by exactly `K·(actual − expected)`.

## 2. The candidate, and the control that makes this a fair test

`src/features/dynamic_team_state.py` is a local-level (random-walk)
state-space rating in the Glicko/Kalman family — said plainly rather than
dressed up as novel; Glickman's rating deviation is the same `P`, grown by
elapsed time and shrunk by observation.

```
time update      P ← P + q·Δt_days
measurement      g  = ∂p/∂θ = p(1−p)·ln(10)/400
                 S  = g²(P_h + P_a) + p(1−p)·r
                 K_i = P_i·g / S
                 θ_h += K_h·(y − p) ;  θ_a −= K_a·(y − p)
                 P_i ← (1 − K_i·g)·P_i
```

⚠️ **The control is the methodological core of this study.** A state-space
model that simply moves ratings further per match would beat or lose to Elo
for reasons having nothing to do with E6's hypothesis. So the two arms are
matched on everything except adaptivity:

* **Identical expectation function** — byte-for-byte Elo's
  `1/(1 + 10^((θ_a − θ_h − h)/400))`, pinned by a parametrised test.
* **Identical steady-state gain** — `calibrate_observation_noise_scale()`
  solves, *in closed form and touching no data*, for the observation noise `r`
  that makes the steady-state gain equal the incumbent's `settings.elo_k_base`
  at `p = 0.5` on a 7-day cadence. It lands exactly on 20.0 points/unit-error.
  Because it is analytic, it cannot be the test-set-informed selection
  `docs/DEBT.md` item 64 had to fix.

The resulting noise inflation is ≈10.8× the naive Bernoulli variance — a
physically sensible reading, not a fudge: one football match is about an order
of magnitude less informative about latent strength than a clean coin flip.

Two deliberate departures from `FastEloReplay`, both under test rather than
oversights: **no 50 % season-carryover regression** (the summer gap is already
~90 days of process noise; applying both would double-count) and **no
per-league K multiplier** (a second hand-set knob would confound which
mechanism produced any difference).

## 3. Pre-declared before any result was computed (§18)

| | Baseline | Candidate |
|---|---|---|
| **H1** | `elo_diff` | `elo_diff + dynamic_diff` |
| **H2** | `elo_diff` | `elo_diff + dynamic_diff + dynamic_uncertainty` |
| **H3** | de-vigged market | `market + dynamic_diff` |

Three tests, one family. **A finding counts as positive only if its 95 % paired
block-bootstrap CI excludes zero AND the Bonferroni-adjusted CI for a family of
three (98.33 %) also excludes zero.** Both are computed and reported for every
test regardless of outcome, so the rule cannot be chosen after the fact.

Ratings are replayed over the **entire** corpus (7 seasons, 12,765 matches) but
scored only on the 2223/2324 → 2425 window Portfolios B, E and F used. Both
arms therefore enter the evaluation window with mature state, and the number
stays comparable with the other three studies. Scoring a rating system during
its own burn-in would measure convergence speed, not information.

## 4. Stage 1 — descriptives (read before the headline)

| | |
|---|---|
| Corpus matches | 12,765 |
| Scored rows (parseable odds) | 12,761 |
| Seasons | 1920 → 2526 |
| Leagues | EPL, LA_LIGA, SERIE_A, BUNDESLIGA, LIGUE_1, EREDIVISIE |
| Mean \|Δrating\| — incumbent Elo | **8.016** |
| Mean \|Δrating\| — state-space | **9.989** |

**Days since a team last played** — the variable the entire mechanism keys on:

| median | p90 | p99 | max | share > 30 days |
|---|---|---|---|---|
| 7 | 14 | 86 | 1,183 | **2.85 %** |

⭐ **This is the study's real finding, and it is visible before Stage 3.**
League football runs on a metronome. The median gap is exactly one week, 90 %
of gaps are two weeks or less, and only **2.85 %** of matches follow a gap long
enough (> 30 days) for a staleness-driven gain to differ materially from a
fixed one. **A staleness-adaptive gain is, in this competition structure,
nearly a constant gain.** The hypothesis is not wrong so much as it has almost
no surface to act on.

## 5. Stage 2 — redundancy against the incumbent

| | |
|---|---|
| Pearson(`elo_diff`, `dynamic_diff`) | **0.9748** |
| stdev `elo_diff` | 95.25 |
| stdev `dynamic_diff` | 146.10 |
| mean `dynamic_uncertainty` | 340.70 |

The candidate is largely a re-encoding of the incumbent — expected, given the
same link, same data and same base rate, differing only in gain. It spreads
wider (146 vs 95 points) because it runs slightly hotter. Any Stage-3 null must
be read in this light: the two arms are carrying nearly the same information.

## 6. Stage 3 — incremental value (n = 1,752, test season 2425)

| Test | Baseline RPS | Candidate RPS | Δ | 95 % CI | 98.33 % CI |
|---|---|---|---|---|---|
| H1 beyond Elo | 0.20249 | 0.20132 | **−0.0012** | [−0.0028, +0.0002] | [−0.0032, +0.0006] |
| H2 + uncertainty | 0.20249 | 0.20132 | −0.0012 | [−0.0028, +0.0002] | [−0.0032, +0.0006] |
| H3 beyond market | 0.19488 | 0.19498 | **+0.0001** | [0.0000, +0.0002] | [−0.0000, +0.0002] |

De-vigged market reference, scored directly: **0.19463**.

**Per-league, H1:**

| League | n | Δ | 95 % CI |
|---|---|---|---|
| BUNDESLIGA | 306 | −0.00220 | [−0.00550, +0.00130] |
| EPL | 380 | +0.00020 | [−0.00410, +0.00460] |
| LA_LIGA | 380 | −0.00160 | [−0.00500, +0.00170] |
| LIGUE_1 | 306 | −0.00230 | [−0.00470, +0.00030] |
| SERIE_A | 380 | −0.00040 | [−0.00470, +0.00340] |

**H2 is not a duplicate row.** Adding the uncertainty channel changes
out-of-sample RPS by 3 × 10⁻⁶ (0.201319 → 0.201322) and the fitted
coefficients on it are ~1 × 10⁻⁴; the two agree to four decimal places, which
is what the table shows. Verified directly rather than inferred: the feature is
*not* degenerate — 652 distinct values in the test window, stdev 24.2,
CV 7.2 % — the model simply finds no use for it.

## 7. Verdict (§51)

**H1 — `HOLD`.** The point estimate favours the candidate and the sign is
consistent in 4 of 5 leagues, but no CI excludes zero at either level. This is
the *wide* null of item 65, not the tight null of items 68/69 — and §51's own
default for an inconclusive sample is HOLD, not a forced REJECT.

**H2 — `REJECT`.** The uncertainty channel is measurable, varies, and carries
no usable information: 3 × 10⁻⁶ RPS, ~1 × 10⁻⁴ weight. Measured, not assumed.

**H3 — `REJECT`.** A tight null on the *wrong side*: the candidate is
0.0001 RPS **worse** than the market alone, with a CI of width 0.0002. There is
no market edge here, and the study makes no such claim.

⚠️ **Scale check that governs all three.** The market scores 0.19463; the best
model here scores 0.20132. The market's advantage over the candidate is
**0.0067 — about 5.7× the size of the candidate's own improvement over Elo.**
Whatever H1 eventually turns out to be, it does not close that gap.

## 8. Limitations, stated rather than buried

* **The learning-rate control is exact in the regime it was solved for and
  ~25 % off in realised average** (Elo 8.016 vs state-space 9.989 mean
  |Δrating|). The closed form targets `p = 0.5` at a 7-day cadence; the corpus
  includes burn-in, international breaks and asymmetric matchups. The residual
  runs in the candidate's favour — it moves *more* per match — so the null is
  the conservative reading, not a flattering one. Recalibrating to match the
  realised mean would mean tuning on the evaluation corpus, which is precisely
  the defect item 64 exists to prevent.
* **One test season, 1,752 rows.** The same power ceiling every study in this
  programme has hit.
* ~~**Elo's season-carryover regression was removed, not ablated.** The study
  does not separate "state-space gain helped" from "dropping the 50 % summer
  regression helped". A 2×2 ablation would, and was not run.~~
  ✅ **CLOSED 2026-09-10 — the ablation was run, and it answered against this
  study.** `reports/research/e6-ablation-2x2.md`: the effect is entirely the
  carryover factor (−0.00128 / −0.00138 across both gain settings); the
  state-space gain is +0.00024 / +0.00014 — neutral-to-harmful in both
  carryover conditions. Interaction ≈ 0. This limitation was not a footnote;
  it was load-bearing, and naming it is what got it tested.

## 9. Reopening (§42)

A re-run of the identical mechanism would not qualify. What would:

1. **More evaluation seasons** — the only fix for the power ceiling.
2. **Process noise driven by something that actually varies.** §4 is the
   pointer: elapsed days is nearly constant, so a gain keyed on it is nearly
   constant. Squad churn, manager change, or transfer-window turnover are
   candidates that move when the calendar does not — and are genuinely
   different information, not a reparameterisation. ⚠️ Post-ablation this bar
   is **higher**, not lower: a reopening now also has to explain why the gain
   was inert in *both* carryover conditions, not merely that it was
   underpowered.
3. ~~**The 2×2 ablation** separating gain adaptivity from carryover removal.~~
   ✅ Run — `reports/research/e6-ablation-2x2.md`.
4. **New:** the ablation surfaced a *separate, cheaper* candidate this study
   never proposed — **removing the carryover regression from the incumbent**,
   with no state-space machinery at all. Not significant, and a second look at
   an already-used holdout, so it has earned a pre-registered test on fresh
   seasons and nothing more.

## 10. What did not change

No feature schema, no model artifact, no promotion gate, no production code
path. `src/features/dynamic_team_state.py` is imported only by its own tests
and this study — the same standing as `elo_replay.py` had before the M2 work
wired it in, and it stays that way unless E6 earns promotion.
