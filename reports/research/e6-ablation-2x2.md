# Experiment E6 — 2×2 ablation

**Directive:** `docs/PRODUCTION_EXECUTIVE_DIRECTIVE.md` §43 E6, §18, §51.
**Date:** 2026-09-10
**Closes:** the limitation `reports/research/e6-dynamic-team-state.md` §8 recorded against itself.
**Verdict (§51):** state-space **gain** → `REJECT` (reattributed from E6's HOLD) · carryover **removal** → `HOLD`, as a new and separable hypothesis
**Artifacts:** `reports/research/e6-ablation-2x2.json`, `backend/scripts/study_e6_ablation_2x2.py`

---

## 1. Why this exists

E6 recorded its own gap plainly:

> "Elo's season-carryover regression was removed, not ablated. The study does
> not separate 'state-space gain helped' from 'dropping the 50 % summer
> regression helped'. A 2×2 ablation would, and was not run." — E6 §8

E6 compared cell A against cell D, changing two things at once:

| | fixed-K gain | adaptive (Kalman) gain |
|---|---|---|
| **carryover ON** | **A** — incumbent Elo | **B** — never tested |
| **carryover OFF** | **C** | **D** — E6's candidate |

## 2. Design

All four cells come from the **two replays that already exist**, each given a
`season_carryover` flag — not a third or fourth copy of the rating math. Cell A
is `FastEloReplay` in its default configuration, the actual incumbent, still
cross-verified against `EloEngine` by its own test, so the baseline is the
production rating system rather than a look-alike. One chronological pass
drives all four side by side; four separate loops would let an ordering
difference become part of the result.

⚠️ **Substitution, not increment — these numbers are not comparable to E6's H1.**
E6's H1 asked `[elo]` vs `[elo, dynamic]`. Here each cell is fitted as the
*same model class on a single rating input*, so the contrast is between rating
systems. That is the right frame for attributing a system's quality to its
parts, and all four cells sit in it consistently — but it is a different
question from E6's, and the deltas must not be read against E6's.

⚠️ **Statistical standing, declared before the run.** E6 already spent a
pre-declared family of three on this holdout. This is a **second pass over the
same test season**, so its purpose is to *attribute* an already-null result,
not to search again for significance. Any CI excluding zero is reported as
**requiring confirmation on fresh data**, never as a finding.

## 3. Results (n = 1,752, test season 2425)

| Cell | Configuration | RPS | Δ vs A | 95 % CI | 98.33 % CI |
|---|---|---|---|---|---|
| A | fixed + carryover (**incumbent**) | 0.20249 | — | — | — |
| B | adaptive + carryover | 0.20273 | +0.0002 | [−0.0003, +0.0008] | [−0.0005, +0.0010] |
| C | fixed + **no** carryover | **0.20121** | −0.0013 | [−0.0028, +0.0002] | [−0.0032, +0.0005] |
| D | adaptive + no carryover (E6) | 0.20135 | −0.0011 | [−0.0025, 0.0000] | [−0.0028, +0.0004] |

**Main effects, read off the 2×2 structure** (point estimates derived from the
cells above, not fresh pre-declared tests — the consistency across both
conditions is the evidence, not a new CI):

| Effect | at carryover ON | at carryover OFF |
|---|---|---|
| **Adaptive gain** (adaptive − fixed) | **+0.00024** | **+0.00014** |
| **Dropping carryover** (off − on) | **−0.00128** | **−0.00138** |

Interaction `(D−A) − (B−A) − (C−A)` ≈ **0.0** — the two factors are additive.

Correlation with the incumbent: B 0.9903, C 0.9666, D 0.9748.
Mean |Δrating|: A 8.016, B 10.009, C 7.804, D 9.989.

## 4. ⭐ What this changes

**E6's improvement was not the state-space model. It was dropping the summer
regression.**

The adaptive gain — the entire subject of Experiment E6 — is **neutral to
slightly harmful, consistently, in both carryover conditions** (+0.00024 and
+0.00014). Two independent looks, same sign, same order of magnitude. That is
not an underpowered null; it is a replicated absence of benefit.

Everything that moved E6's number came from the other factor: removing Elo's
blanket 50 % pull toward the league mean at each season boundary (−0.00128 and
−0.00138, again consistent across both gain settings). Cell C — **plain
incumbent Elo with one rule switched off, and no state-space machinery at
all** — is the best of the four, and marginally better than E6's own candidate.

Read plainly: E6's HOLD would naturally have been taken as "the state-space
model shows promise, needs more power." The ablation says the opposite —
**the state-space model shows nothing, and a one-line deletion in the
incumbent shows the same promise more cheaply.**

## 5. Verdict (§51)

**State-space gain — `REJECT`**, reattributed from E6's H1 `HOLD`. The HOLD was
real, but it belonged to the other factor. Two conditions, both showing the
gain is neutral-to-slightly-worse, is positive evidence of absence for the
mechanism E6 proposed. Reopening (§42) still needs what E6's §9 already
named — process noise driven by something that varies when the calendar does
not — and now also needs to explain why the gain was inert here.

**Carryover removal — `HOLD`, as a new and separable hypothesis.** Direction
favourable and consistent (both gain conditions, 4 of 5 leagues), cheaper than
anything E6 proposed, and **not significant**: C − A = −0.0013 with a 95 % CI
of [−0.0028, +0.0002] that comfortably includes zero.

⚠️ **Do not change the incumbent on this evidence.** `FastEloReplay`'s
carryover is live in the training pipeline. The point estimate is not
significant, it comes from a second look at an already-used holdout, and one
league (EPL, +0.0009) runs the other way. What it has earned is a
**pre-registered test on fresh seasons** — nothing more.

⚠️ **Scale check, unchanged.** The de-vigged market scores 0.19463. The best
cell here is 0.20121 — still **+0.0066 behind**, roughly five times the size of
the largest effect in this table. No configuration in this 2×2 closes that gap,
and none is claimed to.

## 6. Per-league, cell C vs A (the factor that moved)

| League | n | Δ | 95 % CI |
|---|---|---|---|
| BUNDESLIGA | 306 | −0.00170 | [−0.00590, +0.00240] |
| EPL | 380 | **+0.00090** | [−0.00340, +0.00510] |
| LA_LIGA | 380 | −0.00160 | [−0.00470, +0.00140] |
| LIGUE_1 | 306 | −0.00280 | [−0.00600, +0.00070] |
| SERIE_A | 380 | −0.00160 | [−0.00590, +0.00200] |

Same 4-of-5 pattern E6's H1 showed, with EPL again the exception — consistent
with both studies having measured the same underlying effect.

## 7. What did not change

No feature schema, no model artifact, no promotion gate, no production code
path. `FastEloReplay` and `DynamicTeamStateReplay` each gained one defaulted
`season_carryover` keyword; both defaults preserve existing behaviour exactly,
and the Elo↔`EloEngine` cross-verification test still passes unmodified.
