# Portfolio E — Market Microstructure / Information Arrival

**Directive reference:** `PRODUCTION_EXECUTIVE_DIRECTIVE.md` §9 (Portfolio E),
§16 Stage 1-3, §17-19, Rule 6 (market is mandatory evidence), Rule 7
(reconstruction of bookmaker probability is not independent signal).
**Phase:** 4 (Information-Value Testing) — reached directly, because Phase 2
qualification is trivially satisfied: the source is already on disk.
**Date:** 2026-09-09.
**Script:** `backend/scripts/study_portfolio_e_market_microstructure.py`.
**Raw output:** `reports/research/portfolio-e-market-microstructure-report.json`.

---

## 0. Why this portfolio needed no acquisition phase

Rule 2 ("look before you write") applied to sources. Portfolios B and D each
spent a full Gate R1 study establishing whether a source could be obtained
at all. Portfolio E needed none: `backend/data/cache/fd_*.csv` — the same
corpus the production models train on — already carries **both** an
early/opening quote (`bet365_home/draw/away`, `pinnacle_*`, `avg_*`, `max_*`)
and a **closing** quote (`B365CH/CD/CA`, `pinnacle_closing_*`, `AvgC*`,
`MaxC*`) for every fixture. 324 of 380 EPL 2024/25 fixtures show genuine
open→close movement, mean absolute drift 0.20 in decimal odds. The
information-arrival question was answerable today, at zero cost, and had
simply never been asked.

**Method:** train on seasons 2022+2023 (n=3,578), test on 2024 (n=1,752).
Multinomial logistic regression (§26 Level 1 — the simplest defensible
model, per Rule 8). Mean RPS via the existing
`src/models/evaluation/metrics.py` implementations, paired per-fixture
block-bootstrap CI on the difference. Shared harness:
`backend/scripts/_incremental_value_harness.py`.

---

## 1. ⚠️ Serving-window constraint — read before any result below

A closing quote is knowable only at kickoff. SabiScore's primary surface
shows fixtures hours-to-days ahead. **A model consuming closing odds, or
open→close drift (which only completes at close), is therefore not
deployable on that surface** — structurally the identical constraint
Portfolio B found for confirmed lineups (§2b of that study). Any positive
finding below is evidence about market behaviour first, and a product input
only inside a near-kickoff window that does not currently exist.

---

## 2. Q1 — Is the closing quote actually the better forecast? (descriptive, no model)

| Slice | n | RPS opening | RPS closing | closing − opening |
|---|---:|---:|---:|---:|
| **Pooled** | 1,752 | 0.19463 | **0.19378** | **−0.00085** |
| LA_LIGA | 380 | 0.18996 | 0.18778 | −0.00218 |
| LIGUE_1 | 306 | 0.20281 | 0.20148 | −0.00133 |
| EPL | 380 | 0.19724 | 0.19629 | −0.00095 |
| BUNDESLIGA | 306 | 0.20198 | 0.20175 | −0.00023 |
| SERIE_A | 380 | 0.18420 | 0.18466 | **+0.00046** |

The classic efficiency result holds in 4 of 5 leagues — the market
demonstrably learns between open and close. Serie A inverted in this single
test season, which is a one-season observation and not a claim about Serie A.

### ⭐ This is the most operationally useful finding in the study

The ledger repeatedly records that SabiScore's candidates fail
`market_baseline` — "0 of 6 leagues beat the market" (`docs/DEBT.md` items
62, 64). **That claim is incomplete without naming which quote.** The
open→close gap is **0.00085 RPS pooled**, which is the *same order of
magnitude as the candidate effects those gates evaluate* (Portfolio B's
best candidate moved RPS by −0.0004; Portfolio E's Q3 by −0.0002). A model
measured against the opening quote is being held to a materially weaker bar
than one measured against the close.

**Recommended follow-up (not done here, out of this study's scope):** audit
which quote `market_baseline` actually uses in
`compare_candidate_vs_incumbent.py` / `promotion_evidence.py`, and state it
explicitly in the gate's own output. If it is the closing quote, the bar is
honest and the 0/6 record stands as recorded. If it is an earlier quote,
every "did not beat the market" conclusion is measured against a weaker
reference than a bettor actually faces at kickoff.

---

## 3. Q2 — Does open→close drift add information beyond the closing quote?

**No. Tight null, every league.**

| Slice | candidate − baseline | 95% CI |
|---|---:|---|
| Pooled (n=1,752) | 0.0000 | [−0.0001, +0.0002] |
| EPL | −0.0001 | [−0.0003, +0.0001] |
| LA_LIGA | +0.0002 | [−0.0001, +0.0006] |
| SERIE_A | +0.0001 | [−0.0001, +0.0004] |
| BUNDESLIGA | +0.0001 | [−0.0002, +0.0004] |
| LIGUE_1 | −0.0001 | [−0.0004, +0.0001] |

This is a **decisive negative result, and it earns `REJECT` rather than
`HOLD`** — the distinction matters. Portfolio B's null was *wide* (an effect
too small to detect at the available sample). This null is *tight*: the
confidence intervals are narrow and centred on zero, which is positive
evidence that the effect is absent, not merely undetected. Exactly what
market efficiency predicts — the movement's information is, by construction,
already inside the price it moved to.

---

## 4. Q3 — Does cross-book dispersion at close add information?

Dispersion measured as best-available price over cross-book average, per
outcome (`MaxC*/AvgC* − 1`) — a market-disagreement proxy.

| Slice | candidate − baseline | 95% CI | Individually significant? |
|---|---:|---|---|
| Pooled (n=1,752) | −0.0002 | [−0.0004, −0.0000] | marginal |
| BUNDESLIGA | −0.0007 | [−0.0009, −0.0002] | yes |
| EPL | −0.0003 | [−0.0007, +0.0001] | no |
| LIGUE_1 | −0.0002 | [−0.0007, +0.0001] | no |
| LA_LIGA | −0.0000 | [−0.0003, +0.0003] | no |
| SERIE_A | +0.0001 | [−0.0002, +0.0004] | no |

**⚠️ Do not read this as a positive finding.** Three reasons, stated
plainly:

1. **Multiplicity.** This study ran 3 hypotheses × (1 pooled + 5 leagues) =
   **18 uncorrected comparisons**. At α=0.05 roughly one false positive is
   expected by chance alone. A single marginally-significant league is
   precisely that expected artifact.
2. **No pre-declared correction.** §18 requires "a pre-declared
   multiple-testing protocol such as FDR control." None was declared before
   this run. Retrofitting one now would itself be post-hoc. The honest
   statement is that this family of tests was uncorrected, and a future run
   must pre-register the protocol.
3. **Fails robustness (§18).** 1 of 5 leagues, with the pooled CI touching
   zero at the rounding boundary, is the definition of a result that
   "depends on one league."

**Verdict: `HOLD`, explicitly flagged as probable multiple-testing noise.**
It would need a pre-registered replication on a fresh season to be worth
anything.

---

## 5. Q4 — Does drift add information beyond the *opening* quote?

| Slice | candidate − baseline | 95% CI |
|---|---:|---|
| Pooled (n=1,752) | −0.0008 | [−0.0015, +0.0001] |
| LA_LIGA | −0.0016 | [−0.0031, −0.0003] |
| LIGUE_1 | −0.0012 | [−0.0031, +0.0012] |
| EPL | −0.0010 | [−0.0029, +0.0009] |
| BUNDESLIGA | −0.0003 | [−0.0022, +0.0018] |
| SERIE_A | +0.0002 | [−0.0011, +0.0017] |

Directionally positive in 4 of 5 leagues, pooled CI narrowly includes zero,
one league individually significant (subject to the same multiplicity
caveat as §4).

**This is theoretically expected and internally coherent with Q1 and Q2**,
which is the study's strongest internal-validity signal: the close beats the
open (Q1), drift adds nothing beyond the close (Q2), and drift adds
something beyond the open (Q4) — because drift *is* precisely the
information the opening quote lacks and the closing quote contains. All
three results agree with efficient-market theory, which is good evidence the
study measures what it claims to.

**But it is not actionable.** Drift is unknowable until kickoff (§1), so
"opening quote + drift" describes no deployable prediction time. It is a
description of when information arrives, not a feature.

---

## 6. Decisions (§51)

| Hypothesis | Verdict | Basis |
|---|---|---|
| Drift beyond closing quote (Q2) | **`REJECT`** | Tight null, all 5 leagues + pooled. Positive evidence of absence, not underpowered ambiguity. |
| Cross-book dispersion beyond close (Q3) | **`HOLD`** | Marginal pooled CI, 1/5 leagues, 18 uncorrected comparisons. Probable multiplicity artifact; needs pre-registered replication. |
| Drift beyond opening quote (Q4) | **`HOLD` (non-deployable)** | Directionally consistent and theoretically expected, but describes no achievable prediction time on the current serving surface. |
| Q1 open-vs-close gap | **Finding, not a hypothesis** | Actionable: the `market_baseline` gate should state which quote it measures against. |

**Rule 10 ("negative evidence compounds") applies directly.** Q2's clean
rejection removes a plausible-sounding research direction from the space
permanently, at the cost of one afternoon and zero data acquisition. That is
the cheapest possible way to learn something real.

**No production code, feature schema, or model artifact changed.**
