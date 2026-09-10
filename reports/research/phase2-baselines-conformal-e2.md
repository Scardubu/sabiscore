# Phase 2 — Structural baselines (§25), split conformal (§21), and E2 feasibility

**Date:** 2026-09-10
**Directive:** `docs/PRODUCTION_EXECUTIVE_DIRECTIVE.md` v5 §21, §25, §43 (E2)
**Ground truth:** `reports/ground_truth/GROUND_TRUTH_SNAPSHOT_2026-09-10.json` (Gate R0 PASS, 5/5 live probes)
**Registry:** `reports/research/experiment_registry.yaml` entries `S1`, `U1`, `E2`

⚠️ **Evaluation-only.** No feature contract, model artifact, calibration layer,
promotion gate or serving path is touched by any part of this work. Nothing
here is a promotion candidate.

---

## 1. Structural baselines (§25) — three reference instruments

§25 asks for evaluation-only reference models. Elo and dynamic Elo already
exist (E6 and its ablation); the de-vigged market already anchors every Stage 3
study. The three that did not exist are added here: **historical frequency**,
**league-adjusted frequency**, and **Dixon-Coles** (via `penaltyblog` 1.12.1).

### Method

Same split as Portfolio B / E / F and E6 — train seasons 2223+2324 (n=3,578),
test season 2425 (n=1,752), five leagues — so these instruments are directly
comparable to the studies they exist to anchor rather than being a fourth
incomparable frame. Scoring reuses `_incremental_value_harness`'s `devig`,
`mean_rps` and `paired_rps_diff_bootstrap` (DEBT item 67) rather than
reimplementing any of them.

**Strictly paired.** Dixon-Coles cannot predict a team it never saw in
training, so the eligible set is the intersection where *every* instrument can
predict, and all are scored on exactly those rows. 284 of 1,752 fixtures (16%)
are excluded for exactly this reason — promoted sides — and the count is
reported rather than absorbed.

### Pipeline verification

The market scores **0.19463** on the full test season under this script's own
de-vig and RPS code. Portfolio B independently reported **0.19463** for the same
slice. Reproducing an independently-produced number to five decimals is the
evidence that these instruments are scored on the same footing as the
candidates they anchor; without it a "reference instrument" is just another
number.

### Result (n = 1,468 paired-eligible)

| Instrument | RPS | Accuracy | vs market (95% CI) |
|---|---|---|---|
| De-vigged market | **0.19532** | 0.536 | — |
| Dixon-Coles | 0.20566 | 0.527 | +0.01030 [+0.00690, +0.01360] |
| League-adjusted frequency | 0.23416 | 0.424 | +0.03880 [+0.03240, +0.04510] |
| Historical frequency | 0.23371 | 0.424 | +0.03840 [+0.03230, +0.04470] |

Positive = worse than the market. **Every CI excludes zero**, so all three
structural instruments are significantly worse than the market.

### What is worth carrying forward

1. **Dixon-Coles (0.20566) is worse than the incumbent Elo system (0.20249)
   and worse than E6's best ablation cell (0.20121).** A future proposal to
   adopt a Dixon-Coles-style goal model as a *replacement* now has a measured
   number to beat, and it is not an easy one.
2. **League adjustment does not help.** League-adjusted frequency (0.23416) is
   marginally *worse* than the global rate (0.23371). Conditioning base rates
   on competition buys nothing here.
3. The market's advantage over the best structural model is ~0.010 RPS, which
   is an order of magnitude larger than every candidate effect this programme
   has measured (E1: 0.0004, E5: 0.0002, E6: 0.0013).

### No threshold

§19 forbids a hard-coded universal ΔBrier/ΔRPS gate. This study asserts no
pass/fail threshold; it reports paired CIs.

---

## 2. Split conformal coverage (§21)

### Claim scope, stated before the numbers

§21 distinguishes two claims. This study measures the first and does **not**
support the second:

> **VALID:** "The system's prediction sets achieve measured marginal coverage
> under the evaluation assumptions."
> **INVALID:** "The system now knows which predictions will be wrong."

### Method

`mapie` 1.5.0 `SplitConformalClassifier`, `conformity_score="lac"`,
`prefit=True`. LAC is the **non-adaptive** score. The adaptive scores
(`aps`/`raps`) are deliberately not evaluated: §21 prohibits adaptive conformal
until a difficulty signal is demonstrated, and DEBT item 50 records that this
system's epistemic channel fails `error_association` — the difficulty signal it
would need does not exist.

**Leakage-free by construction.** Each served artifact declares
`holdout_season: 2425` in its own metadata, so 2425 was genuinely excluded from
training. It is split temporally in half: the earlier half conformalizes, the
later half is scored. Calibration strictly precedes test.

The estimator is **what production actually serves**: the equal-weight average
of the artifact's RandomForest / XGBoost / LightGBM base learners, mirroring
`PredictionEngine._ensemble_predict_dict`.

⚠️ **The stacking head is deliberately not used**, because the request path
does not use it — `_ensemble_predict_dict` averages the base learners and
never touches `meta_model`, and serving's `_ArtifactBundle` carries no
`meta_model` field at all (CLAUDE.md vΩ.47 records the same split: the stacking
head is read by `SabiScoreEnsemble.load_model()` at *startup*, the request path
averages).

### Result (n = 867 across 5 leagues)

| Nominal | Empirical | Gap | Mean set size (of 3) |
|---|---|---|---|
| 0.80 | 0.798 | −0.002 | 2.15 |
| 0.90 | 0.896 | −0.004 | 2.56 |
| 0.95 | 0.955 | +0.005 | 2.77 |

Per league at nominal 0.90: LA_LIGA 0.916, LIGUE_1 0.915, SERIE_A 0.910,
EPL 0.894, BUNDESLIGA 0.838. EREDIVISIE has no rows in the holdout season and
is skipped.

### Faithfulness — the wrapper is provably the served path

On each artifact's own declared holdout, with row counts matching exactly, this
wrapper reproduces every recorded metric **to the last decimal**:

| League | RPS here | artifact recorded |
|---|---|---|
| BUNDESLIGA | 0.23347 | 0.23347 |
| EPL | 0.23036 | 0.23036 |
| LA_LIGA | 0.21937 | 0.21937 |
| LIGUE_1 | 0.22905 | 0.22905 |
| SERIE_A | 0.21611 | 0.21611 |

That exactness is the evidence the conformalized object is the served model,
not a plausible look-alike.

### Reading

**Coverage is essentially nominal.** Gaps of −0.002, −0.004 and +0.005 across
867 fixtures mean split conformal delivers its marginal guarantee on this data,
despite football fixtures not being strictly exchangeable across a season.

**The sharpness cost is the finding.** Meeting that coverage requires sets
containing **2.56 of 3 possible outcomes at 90%**, and 2.77 at 95%. A set
holding all of {home, draw, away} asserts only that the match will have a
result. §21's warning that "coverage alone is not sufficient" is exactly right
here: coverage is *met*, and the sets are still close to operationally vacuous.

### ⚠️ Correction — an earlier revision measured the wrong model

The first version of this study wrapped the **stacking head**
(`meta_model.predict_proba`), on the assumption that
`ensemble.py::predict`'s stacking flow was the served one. It is not.

That error produced two wrong conclusions, both now retracted:

1. It reported **undercoverage at every level** (0.760 / 0.881 / 0.932). The
   corrected served path is at nominal.
2. It reported that the artifacts' recorded metrics **could not be reproduced
   from the artifacts**, and inferred a dropped training-time calibrator. That
   inference was wrong. The stacking head simply scores ~0.008 RPS better than
   the averaged base learners, and the recorded metrics were the averaged ones
   all along — they reproduce exactly, as the table above shows.

There is no missing calibrator. The served `v5_phase7` artifacts were trained
**2026-08-08**, and `_select_calibrator` did not land until **2026-09-10**, so
no calibrator existed to persist when they were built. When one is selected
today it replaces `meta_model` with a wrapped calibrated object that is then
serialized — so it is carried inside `meta_model`, not dropped.

The genuinely open question is separate and already in the ledger as item 71:
serving can read an optional `calibrator` key that this training pipeline never
writes, and since the request path ignores `meta_model` entirely, a calibrator
baked into the head would not reach serving. That is an artifact-format
question, not a lost object, and it is not resolved here.

---

## 3. Experiment E2 — expected XI / lineup continuity

### What was already known

Portfolio B (DEBT item 65 §2b) established the **serving** answer: confirmed
lineups publish 20–40 minutes before kickoff, which fails Gate G5 for this
platform's browse-fixtures-days-ahead surface. It did not establish whether a
**historical** corpus could be acquired for a retrospective study.

### What this probe adds

One live request, read-only.

`lineups(fixture_id=1208021)` → **`VERIFIED`, 40 records.** The historical data
exists and is reachable on the current free plan, and the payload carries
exactly what §22's representations need:

```json
{"fixture_id": 1208021, "team_id": 33, "team_name": "Manchester United",
 "formation": "4-2-3-1", "player_id": 526, "player_name": "A. Onana",
 "role": "starting", "coherent": true}
```

`player_id` supports expected-XI overlap, `role` supports starter-absence
counts, `formation` supports positional disruption. **Content sufficiency is
confirmed, not assumed.**

### The blocker, costed

`/fixtures/lineups` accepts only a `fixture` parameter — verified at
`src/providers/api_football.py:224`. There is no league-season bulk form,
unlike `/injuries`, which returned 3,168 records for a whole league-season in a
single call.

| | |
|---|---|
| Requests per season, 5 leagues | 1,752 |
| Free-tier daily quota | 100 |
| **Days of uninterrupted full quota** | **17.5** |

Continuity metrics need consecutive fixtures per team, so sampling does not
reduce the requirement — a usable study needs essentially the whole season.

### Decision (§51): `HOLD`, on two independent gates

| Gate | Status | Unblocks with |
|---|---|---|
| Serving (G5) | Fails structurally — 20–40 min pre-kickoff | a near-kickoff product surface |
| Acquisition | 17.5 days of full quota | a paid api_football tier |

These are independent: a paid tier alone enables the *research*; a
near-kickoff surface alone enables *serving*; promotion needs both. This is a
costed operational gate, not a §41 kill — the same class as E1's plan-tier
wall, resolvable by the same subscription decision.

E2's state advances from "unknown whether historical data exists" to "it
exists, it is sufficient, and here is exactly what it costs."

---

## 4. Artifacts

| Artifact | Path |
|---|---|
| Structural baselines report | `reports/research/structural-baselines-report.json` |
| Structural baselines script | `backend/scripts/evaluate_structural_baselines.py` |
| Conformal report | `reports/research/split-conformal-report.json` |
| Conformal script | `backend/scripts/evaluate_split_conformal.py` |
| E2 probe result | `reports/research/e2-lineup-availability-probe.json` |
| E2 probe script | `backend/scripts/probe_lineup_availability.py` |
| Registry entries | `reports/research/experiment_registry.yaml` (`S1`, `U1`, `E2`) |

Research dependencies (`penaltyblog`, `mapie`) are offline-only and belong to
the research environment per §35. They are not in `requirements.runtime.txt`
and no serving path imports them.
