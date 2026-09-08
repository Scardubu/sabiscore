# SabiScore — Production Executive Directive (v4, 2026-09-08)

Supersedes v3 (2026-09-06). v3 is preserved at commit `74be64c`.

v3's contribution was negative and correct: it established, on four independent
measurements, that no model in this repository beats the de-vigged market, and it
forbade promising accuracy the evidence does not support. It stopped there, with
§2 reframing the mission around "transparency" without naming a measurable target.

v4 names one. Live production telemetry read **today** shows the model losing
almost as much to miscalibration as it gains from discrimination (reliability
`0.0326` against resolution `0.0412`, §3). That is a defect with a known remedy,
an existing untouched instrument in the training pipeline, and roughly **twenty
times** the headroom of the entire rejected feature-expansion programme.
Calibration is not a consolation prize for failing to beat the market. It is the
largest unclaimed quantity the platform can currently measure, and it is
claimable without new data, new features, or a market edge.

This version also audits the attached `Football Prediction Data Strategy.md`
(§1). Its modelling direction is broadly sound; three of its stated architectural
constraints are not this system's, and one is a category error that would
silently misdirect the memory-budget work it prescribes.

---

## 0. Verified ground truth — re-read live, do not restate from memory

Every row re-verified against the repository or a live endpoint on 2026-09-08.

| Fact | Verified value | Source | vs. v3 |
|---|---|---|---|
| Deployed SHA | `221a05a` — Render `/health`, Vercel `/api/health` `sha` **and** `backendSha` | live probe | **v3 said `1115d1d`; four commits stale** |
| Alembic head | `0013_push_devices` | Render boot log | **v3 said `0010_match_context_referee`** |
| Active generation | `v5_phase7-20260808`, `UNVERIFIED` / `ACTIVE_FAIL_CLOSED` | `models/active_generation.json` | unchanged |
| Served schema | `phase7_68` | same | unchanged |
| Certification policy | v1.1.1 | `certification_policy.CERTIFICATION_POLICY_VERSION` | unchanged |
| Promotion gates | 7, `PROMOTION_REQUIRES_ALL_GATES = True` | `PROMOTION_GATES` | unchanged |
| **Settled predictions** | **59** | live `/api/v1/model-performance` | **v3 said 11 — the ≥10 walk-forward floor is now cleared 5.9x** |
| **RPS** | **0.2189**, 95% CI **[0.1944, 0.2476]**, block bootstrap n=1000, block=10, n=59 | live `/model-performance/calibration` | **new: the CI straddles the displayed 0.21 gate** |
| **Brier (per-class mean)** | **0.2088** = reliability **0.0326** − resolution **0.0412** + uncertainty **0.2159** | same | **new** |
| **Multiclass ECE** | **0.1343** (per class 0.1178 / 0.1554 / 0.1297) | same | **new** |
| **CLV** | n=33, mean **+0.0252**, positive rate **0.667** | live `/model-performance` | **new: floor cleared; read §3.2 before treating it as skill** |
| `market_baseline` | FAIL — 0 of 6 leagues | DEBT 62 | unchanged |
| `serving_feature_availability` | FAIL — `training_defaulted_slots` 16, permanent gap floor 6 | DEBT 49/61 | unchanged |
| `MODEL_UNCERTAINTY_UNAVAILABLE` | CRITICAL, unconditional — `_uncertainty_from_features` returns `None` on every request | `full_analysis.py:269-293` | unchanged |
| Uncertainty gates | 5 of 6 pass; `error_association` fails, reversed and monotone, on two independent member-selection designs | `uncertainty_policy.py`, `test_uncertainty_contract.py` xfails | unchanged |
| Live staking | `stake_permitted: false` on every fixture | live | unchanged |
| mypy ceiling | 769 ≤ 784 | `scripts/check_mypy_ceiling.py` | unchanged |
| Backend unit suite | 1281 passed / 4 skipped / 2 xfailed | this session | xfails are DEBT 50 |

### 0.1 Two phantom gates — thresholds asserted publicly that the frozen policy does not contain

APEX §23 requires certification thresholds to be frozen, versioned, and hashed.
Two numbers currently presented as gates satisfy none of that:

- **`RPS ≤ 0.21`** is `RPS_PROMOTION_GATE` in `apps/web/src/lib/model-gates.ts:16`
  — a **frontend TypeScript constant**. `certification_policy.py` contains no
  absolute RPS threshold; its only RPS gate is
  `primary_metric_improvement: {min_mean_rps_improvement: 0.0, strict: True}`,
  which is *relative to the incumbent*. The live `/performance` page renders
  "promotion gate ≤ 0.21" beside the RPS tile as though it were policy.
- **`Brier ≤ 0.220`** is cited in v3 §2 and in `PRODUCTION_FINISHING_DIRECTIVE.md:389`
  as "the platform's own BNN certification gate". It does not exist in
  `certification_policy.py`, where `brier_decomposition` appears only as a
  `min_records: 10` data-sufficiency floor. v3's fourth pillar additionally
  compares the market's `0.5787` (sum-over-classes) against `0.220`
  (per-class-mean); `reports/evaluation/metric-contract.json:22` already records
  that these conventions differ by **exactly 3.0000x for C=3** and must not be
  compared. **v3 §2 pillar 4 is withdrawn.** Its other three pillars stand, and
  converting properly (model ≈0.626 vs market 0.5787 on the authoritative
  convention) still favours the market — the conclusion survives, the stated
  evidence for it did not.

**Action (Phase A):** either promote both thresholds into `certification_policy.py`
under a version bump, or delete them from every consumer surface. A gate that
lives in a frontend constant is unversioned, unhashed, and invisible to
`policy_sha256()`.

---

## 1. Audit of `Football Prediction Data Strategy.md`

### 1.1 Endorsed

- **Conformal prediction as a distinct, certifiable uncertainty claim** (§D, §H).
  The strategy's strongest contribution. §5 adopts it, for a reason the strategy
  does not state.
- **Proper scoring rules and paired significance testing** (§K). Already partly
  built: `metrics.py` ships `ranked_probability_score`, `brier_score_decomposition`,
  `log_loss_multiclass`, `expected_brier_score`, and `block_bootstrap_ci`; DEBT 62
  already rejected a candidate on a paired bootstrap CI. Diebold-Mariano is a
  reasonable addition to that stack, not a replacement for it.
- **Rolling-origin walk-forward with enforced feature-availability timestamps**
  (§K). Matches the existing bidirectional parity contract
  (`test_feature_vector_parity.py`, `feature_contract.json`).
- **Kill criteria** (§N). Compatible with existing DEBT ledger discipline.

### 1.2 Not this system's constraints — corrected

| Strategy claim | Repository reality | Disposition |
|---|---|---|
| "PostgreSQL 15 enforcing Row Level Security" (§B) | PostgreSQL 16+; **zero RLS statements in any Alembic revision** | Not a constraint here. Do not design around it. |
| "sub-150ms inference latency requirement" (§B, §L, Phase 8) | `<150ms` appears only as **docstring targets** (`predictions.py:120`, `schemas/prediction.py:267`, `data_processing.py` module docstring). No gate, no test, no alert. Measured `/full-analysis`: **1–2.5 s cold, ~1 s warm** | Aspiration, not a budget. Re-specified in §4.1. |
| "3072 MB `js/ts.maxTsServerMemory` threshold" governing SPADL/VAEP computation (§L, §N kill criterion 2) | **Category error.** `maxTsServerMemory` caps the **TypeScript language server** in the editor. It has no relationship to Python heap, Polars, DuckDB, or any training process. It is also not checked into this repo — it is a user-level VS Code setting, sourced from citation 13, a Google Drive `settings (1).json` | Replaced by a real Python-side budget in §4.3. **A kill criterion keyed to it could never fire.** |

§B's "Current Capability Audit" — the source of all three — cites
`settings (1).json` (13), `CONVICTION_ENGINE_v6_0 (1).md` (14), and
`oscar-ndugbu-cv.docx` (15). **A CV is not a system specification.** The
"sub-150ms @ 10k CCU" figure traces to citation 15.

### 1.3 Section C's negative-evidence table does not match this repository's ledger

The strategy's rejected-approach table reports specifics — "latency increased by
140ms", "test RPS degraded by 3.2%", "five-year retrospective using log-loss",
"confidence intervals overlapped the baseline entirely" — that appear nowhere in
`docs/DEBT.md`. This repository's actual measured rejections are: DEBT 58 (xG,
mean RPS **−0.00159**, market_baseline 0/5), DEBT 59 (heterogeneous ensemble, 3
seed blocks, RF-only skill negative), the `apex_v3_68` h2h/venue campaign (3 wins
/ 3 losses, a statistical wash, 0/6 vs market), and DEBT 62 (`apex_v5_66` HPO,
`no_league_regression` 4/6 → 3/6).

The directions are right; the numbers are not ours. **Cite `docs/DEBT.md`, never
the strategy table, when justifying a closed branch.**

---

## 2. Capability audit — repository against strategy mandates

| Strategy mandate | Present | Evidence |
|---|---|---|
| `soccerdata` ingestion | **YES** | `soccerdata==1.9.1`; Understat corpus 12,560 matches / 35 league-seasons (PR #140) |
| Information-value testing (ATE / mutual information) before adoption | **YES, and already discriminating** | `causal_selector.py`; `xg_differential` ATE 0.2464 p=0.0000 CAUSAL_DRIVER vs `finishing_efficiency_gap` 0.0082 p=0.385 INDEPENDENT |
| Walk-forward validation, block bootstrap CIs | **YES** | `walk_forward_validate()`, `block_bootstrap_ci()`, live n=59 |
| Calibration measurement | **YES** | Murphy decomposition and ECE both live |
| **Calibration holdout, temporally independent** | **YES — built, currently used only for temperature scaling** | `train_on_real_matches.py:1027-1038`: `calibration_season = pretest_seasons[-1]`, `X_calibration`, ≥50 rows enforced by `certification_policy` |
| `polars` | **installed in production, zero importers** | `requirements.runtime.txt:84`; no `import polars` in `backend/src` |
| `pyarrow` | **installed in production, zero importers** | `requirements.runtime.txt:86` |
| `duckdb` | **ABSENT** | not in any requirements file |
| **MAPIE / conformal prediction** | **ABSENT** | zero source references |
| **`socceraction` (VAEP), `kloppy` (SPADL)** | **ABSENT** | `kloppy` appears only as a prose mention in `connectors/statsbomb_open.py`; no import, no SPADL, no VAEP, no xT |
| `penaltyblog` / Dixon-Coles structural baseline | **ABSENT** | zero references to `dixon` or `penaltyblog` |
| Glicko-2 | **ABSENT** | Elo only (`elo_state_service`, 25,782 durable snapshots) |
| `torch` / BNN | **ABSENT from requirements**; no trained artifact | DEBT 42 |

### 2.1 The spatial-value gap is a coverage problem, not a representation problem

This is the audit's most consequential finding and it inverts the strategy's
premise.

`PHASE7_FEATURES_ALWAYS_DATA_GAP` contains `home_pressing_intensity` and
`progressive_carry_diff` — a pressing metric and a ball-progression metric.
Those are precisely the two quantities the strategy proposes to acquire via xT
and VAEP (§E, §G).

They are not absent because the repository lacks a sophisticated representation.
They were **formally relegated on 2026-09-04** by
`scripts/audit_statsbomb_coverage.py`, which measured the StatsBomb ↔ Understat
identity crosswalk at **23.58% against an 85% threshold**
(`certification_policy.py:41-48`). `ENABLE_STATSBOMB_ENRICHMENT` is `False` by
policy and must remain so.

`socceraction` and `kloppy` compute richer values **from whatever events exist**.
They do not create coverage. Computing VAEP over a 23.58% crosswalk yields a
feature that is the registry default on roughly three of every four fixtures —
and DEBT 56 already measured what such a column does: zero variance on the
constant-filled rows, no tree splits, **inert**. Adopting the toolchain without
first moving coverage would reproduce a closed negative result at higher
engineering cost.

**Therefore:** xT/VAEP is gated behind a coverage precondition, not scheduled as
a build (§6, Phase D). The precondition is falsifiable and cheap to re-run.

---

## 3. The central finding — miscalibration is the largest measurable unclaimed quantity

### 3.1 The decomposition

Murphy: `Brier = Reliability − Resolution + Uncertainty`. Live, n=59, per-class
mean convention:

```text
Brier        0.2088
Reliability  0.0326   <- miscalibration, lower is better, 0 is perfect
Resolution   0.0412   <- discrimination, higher is better
Uncertainty  0.2159   <- irreducible, a property of football
```

**Reliability (0.0326) is 79% the magnitude of resolution (0.0412).** The model
forfeits to miscalibration nearly as much as its entire discriminative skill
earns. Driving reliability toward 0 with resolution held constant takes Brier to
approximately **0.1762 — a 15.6% reduction** — and requires no new feature, no
new corpus, and no market edge.

Set against the alternative: three completed feature-expansion campaigns (xG,
h2h/venue, HPO) moved mean RPS by **≤0.0015** in total, and none cleared
`market_baseline`. **Available calibration headroom exceeds the entire delivered
result of the feature programme by roughly a factor of twenty.**

⚠️ n=59, so point estimates are noisy. The relevant robustness check is the ECE
interval: **[11.07%, 26.83%]** at 95%. The lower bound is an order of magnitude
from zero. Miscalibration is real at every point in the interval; only its
magnitude is uncertain.

⚠️ This is a **Brier/reliability** claim, not a market claim. A perfectly
calibrated model that does not out-discriminate the market still does not beat
the market. v3 §2 stands unamended: nothing here promises an edge.

### 3.2 The `+2.5pp` CLV tile is most likely a miscalibration artifact, and is mislabelled

`clv_service.compute_clv_summary` computes
`model_probs[argmax] − closing_probs[argmax]`. Its docstring is scrupulous:
*"compares model belief to market close, independent of the result… a read-only
diagnostic surface, not a verdict."*

The frontend renders it as a headline KPI: **`CLOSING LINE VALUE +2.5pp`**,
captioned "Mean vs. market close across 33 joined predictions."

"Closing line value" is a term of art meaning *a price was taken and the market
subsequently moved in the bettor's favour*. This quantity involves no taken price
and no market movement. It measures **how much more confident the model is than
the market on its own favourite** — and a uniformly overconfident model scores
positive on it **by construction**.

The platform independently measures that the model *is* overconfident: ECE
0.1343, reliability 0.0326, and a live reliability curve running above the
diagonal through the low-probability region. `positive_rate 0.667` is what
systematic argmax inflation looks like.

**The platform's most favourable-looking public number is, on its own evidence,
most plausibly a readout of its worst-calibrated property.** This is the same
defect family as DEBT 63 (fixed 2026-09-08: a flat prior differenced against a
real price and published as a `+29.8pp` edge) — arithmetically real, semantically
mislabelled, on a consumer surface. Rename in Phase A; §5's conformal work is
what would eventually make a genuine version of this measurable.

---

## 4. Constraint enforcement — corrected and made enforceable

An unenforced constraint is a comment. Each of the following gets a measurement
point or is struck.

### 4.1 Latency — separate inference from request

The strategy's single "sub-150ms" figure conflates two budgets that differ by
four orders of magnitude.

| Budget | Scope | Current | Target | Enforcement |
|---|---|---|---|---|
| **Model inference** | `predict_proba` over a 68-vector, tree ensemble | sub-millisecond, uninstrumented | **≤150 ms p95** | new `metrics_collector` timer around the ensemble call; assert in CI against a fixture |
| **End-to-end `/full-analysis`** | provider I/O + DB + odds + projection + synthesis | **1–2.5 s cold, ~1 s warm** | **≤2.5 s p95**, no regression | `metrics.py` already computes `p95_latency_ms`; wire an alert threshold |

A conformal wrapper adds one sorted-quantile lookup per request — **O(log n) on a
calibration array of ≤10³, microseconds.** Conformal prediction does not threaten
either budget, and the strategy's Phase 8 latency concern is unfounded for this
method.

Strike the bare `<150ms` docstrings in `predictions.py:120`,
`schemas/prediction.py:267`, and `data_processing.py`, or qualify them as
inference-only. As written they describe a budget the primary user path misses by
7–17x.

### 4.2 Zero fabrication — unchanged, and the live risk surface

Unobserved is `None`, never `0.0`, never a neutral prior rendered as a
measurement. Extended, per v3 §3 and reinforced by DEBT 63 and §3.2 above:
**a label is fabrication when it asserts a property the underlying quantity does
not have**, even when the arithmetic is correct. Six recorded instances of the
neutral-default-as-measurement family; §3.2 is the first recorded instance of the
term-of-art-as-label family.

Every new stat tile requires, before merge: (a) what does the backend emit for
this when evidence is absent, and (b) does the label name what the arithmetic
computes.

### 4.3 Memory — a real budget, replacing the category error

`js/ts.maxTsServerMemory ≤ 3072` is an **editor** setting governing the
TypeScript language server. It constrains no Python process and must not be cited
in any data-pipeline or kill-criterion context (§1.2).

Actual budgets:

| Boundary | Limit | Enforcement |
|---|---|---|
| TypeScript language server | ≤3072 MB (half of an 8 GB dev box) | VS Code setting; editor only |
| ML/research processing | must not exhaust an 8 GB dev box; runs in `.venv-ml` | out-of-core; record peak RSS in the experiment registry |
| **Production serving image** | **must not grow** | §4.4 |

Where the strategy is right: aggregating event streams belongs in a lazy,
memory-mapped engine rather than materialised DataFrames. Where it is wrong about
this repository: **Polars is already installed — in the wrong place.**

### 4.4 Production image — remove dead weight before adding any

`requirements.runtime.txt` ships `polars` (28.5 MB) and `pyarrow` (38 MB) into the
**production serving image**, and `backend/src` imports **neither**. The Render
build log shows both downloading on every deploy, alongside `xgboost` (297.1 MB).

Polars and DuckDB belong in `.venv-ml`, where aggregation actually runs, not in
the container that serves requests. **Phase A moves them and drops `pyarrow`.**
This shortens every redeploy window and is a precondition for adding anything:
the runtime image is not a research environment.

### 4.5 Unchanged

FastAPI is the sole backend authority. PostgreSQL is durable truth; Alembic is the
only schema authority. `apps/web` computes no EV, stake, edge, or de-vigging.
**No second job queue** (DEBT 54). No second team-name normalizer beside
`team_identity._identity_key`. Train/serve parity is bidirectional and tested.
Fail-closed: no gate is relaxed to unblock a result, and no threshold is changed
after observing the result it would admit (APEX §23).

---

## 5. Conformal prediction — what it can and cannot do here

The strategy proposes MAPIE without stating why this repository specifically
needs it. The reason is precise, and it is the strongest argument in the document.

### 5.1 It makes a claim `error_association` does not require

`MODEL_UNCERTAINTY_UNAVAILABLE` is CRITICAL on 100% of requests because
`_uncertainty_from_features` returns `None` unconditionally. Five of six
`UNCERTAINTY_GATES` pass on the real corpus. The sixth, `error_association`,
fails: the **highest**-epistemic quartile scores **better** RPS than the lowest
(EPL 0.1905 vs 0.2134), monotonically across all four buckets, reproduced on a
second independent member-selection design, and failing in **all five** scored
leagues (`test_uncertainty_contract.py` xfails).

`error_association` demands an **adaptive** property: the uncertainty score must
rank realized error. Conformal prediction's guarantee is **marginal coverage** —
`P(Y ∈ C(X)) ≥ 1 − α` over the exchangeable calibration distribution. It does
**not** require the score to rank errors. Split-conformal with a fixed
nonconformity score is valid even when `ensemble_dispersion` is anti-correlated
with error, because validity and adaptivity are different claims.

**So conformal prediction offers a certifiable uncertainty statement that the
current failure does not block.** That is a different thing from repairing
`error_association`, and this directive must not conflate them.

### 5.2 What it does not fix — state this plainly

- It does **not** repair `error_association`. **Adaptive** conformal variants
  (Mondrian, class-conditional, difficulty-stratified) *do* depend on a score
  that tracks difficulty and would inherit the same reversal. **Only the
  non-adaptive split-conformal variant is defensible here today.**
- It does **not** produce an edge. Coverage guarantees are not sharpness.
  v3 §2 stands.
- Valid-but-wide sets are the honest failure mode. If a 90% set is
  `{Home, Draw, Away}` on most fixtures, the correct response is to report set
  size, not to lower α.

### 5.3 Prerequisite: ADR 0009 must be superseded, not amended

`ADR 0009` names `ensemble_dispersion` as the **only** authorised uncertainty
method, and `FORBIDDEN_EPISTEMIC_SOURCES` forbids probability-derived proxies. A
conformal score is a new method and, depending on the score function, may be
probability-derived. **Adding it requires a superseding ADR with an explicit
authorization**, exactly as v3 §4.2 anticipated. It is not a library import.

### 5.4 The instrument already exists

`train_on_real_matches.py:1027-1038` already carves a temporally-independent
calibration season (`calibration_season = pretest_seasons[-1]`, `X_calibration`,
`y_calibration`, ≥50 rows enforced by `certification_policy.training_split`),
currently consumed only by `_fit_temperature`. That is precisely the exchangeable,
leakage-safe holdout split-conformal requires.

This work reuses a built, gate-enforced, temporally clean split. It does not build
one. Whether MAPIE is worth a production dependency at all, given that
split-conformal is roughly thirty lines against an existing holdout, is an
explicit Phase C decision — not a foregone conclusion.

---

## 6. Execution order

### Phase A — Truthfulness and hygiene (bounded, days)

Nothing here needs a model or new data.

1. **Resolve both phantom gates** (§0.1): promote `RPS ≤ 0.21` and any Brier
   threshold into `certification_policy.py` under a version bump, or delete them
   from every consumer surface. **Success:** no threshold is displayed as a gate
   that `policy_sha256()` does not cover.
2. **Relabel the CLV tile** (§3.2). It is a model-vs-close belief differential,
   not closing line value. **Success:** the label names what
   `compute_clv_summary` computes; a copy-contract test bans the term of art on
   this quantity.
3. **Move `polars` to `.venv-ml`, drop `pyarrow` from runtime** (§4.4).
   **Success:** production image shrinks; Render install time drops; no import
   breaks.
4. **Qualify or strike the `<150ms` docstrings** (§4.1).
5. Land or explicitly decline DEBT 49's authorized one-line measurement fix — do
   not leave it standing a fourth time.
6. Resolve DEBT 57 (Understat corpus: 1,826 duplicated matches, 2021/22 missing)
   **before** any recalibration reads that corpus.

### Phase B — Instrument calibration as a first-class target (the core of v4)

1. **Wire the two latency budgets** (§4.1) so later claims are measurable.
2. **Persist the calibration baseline as a tracked series.** Reliability,
   resolution, ECE, and Brier are already computed live; store them per
   generation so recalibration is measured against a fixed prior reading rather
   than re-derived after the fact.
3. **Recalibrate the serving generation against the existing calibration holdout**
   (§5.4), with isotonic regression and vector/temperature scaling as candidates.
   **This is the highest-expected-value work in this directive.**
   - **Success:** reliability strictly decreases with resolution not decreasing,
     on a paired block-bootstrap CI excluding zero (the DEBT 62 standard). Target
     reliability **≤0.010** (from 0.0326).
   - **Kill:** any candidate that reduces reliability by degrading resolution is
     rejected — that is repackaging skill as calibration.
   - ⚠️ Recalibration changes served probabilities. It therefore requires a
     candidate generation and passes through the **same seven promotion gates**.
     It does not bypass certification, and it will not by itself clear
     `market_baseline`.

### Phase C — Distribution-free uncertainty (authorization-gated)

1. **Decision required before code:** supersede ADR 0009 to admit non-adaptive
    split-conformal (§5.3), or decline and accept `MODEL_UNCERTAINTY_UNAVAILABLE`
    as terminal. **Do not start C2 before C1.**
2. If authorized: implement split-conformal against the existing calibration
    holdout. Evaluate MAPIE against a direct implementation on dependency cost,
    not library prestige.
    - **Success:** empirical coverage within ±2pp of nominal at α ∈ {0.1, 0.2} on
      the holdout, **and** median set size < 3 (a set that always contains every
      outcome is valid and useless).
    - **Kill:** coverage outside tolerance, or median set size = 3.
3. Only on success: define a new uncertainty gate for coverage and surface
    prediction sets. Coverage is **not** `error_association` and must never be
    reported as clearing it.

### Phase D — Spatial value, gated on coverage (do not start speculatively)

1. **Precondition, re-runnable today:** `scripts/audit_statsbomb_coverage.py`
    must report a crosswalk **≥85%** (currently **23.58%**). Until then
    `ENABLE_STATSBOMB_ENRICHMENT` stays `False` and no xT/VAEP work is authorized
    (§2.1).
2. If and only if coverage clears: ingest via `kloppy` → SPADL, compute VAEP/xT
    via `socceraction` in `.venv-ml`, aggregate out-of-core, and **submit the
    resulting features to the existing ATE / mutual-information screen before any
    training run.** The screen already discriminates (§2); trust it.
    - **Kill:** ATE indistinguishable from zero, or the feature is a registry
      default on >15% of served fixtures.

### Phase E — Structural baseline (small, high leverage, independent)

1. Add a Dixon-Coles / bivariate-Poisson reference implementation as an
    **evaluation baseline only**, never a serving path. The platform currently
    measures itself against the incumbent and the market; a structural floor is a
    third, cheap, informative reference. `penaltyblog` is a candidate; a direct
    implementation is ~100 lines. **Serving is out of scope.**

Items are numbered within their phase; cite them as A1..A6, B1..B3, C1..C3,
D1..D2, E1. Phases B, C, D, E are independent. B does not wait on the ADR 0009 decision, and
D waits on nothing but a coverage number.

---

## 7. Verification

```bash
# backend/
ruff check src --select E4,E7,E9,F        # CI scope: not scripts/, not tests/
python scripts/check_mypy_ceiling.py      # ceiling 784; never raise it
PYTHONPATH=. python -m pytest tests/unit -q
PYTHONPATH=. python -m pytest tests/integration -q
python scripts/verify_active_artifacts.py

# apps/web/
pnpm exec tsc --noEmit
pnpm exec next lint --dir src
pnpm build

# repo root
make verify                                # no step bypassed with `|| true`
```

**Deploy parity** is a three-way match — Render `/health` `sha`, Vercel
`/api/health` `sha` **and** `backendSha`, and local `git rev-parse --short=7 HEAD`
— checked after every push. A backend SHA legitimately lags after a web-only
commit (`render.yaml` `rootDir: backend`); confirm with
`git diff --name-only <sha>..HEAD -- backend/` before calling it an incident.

**Evidential standards.**

- No candidate is "better" on a point estimate. A paired bootstrap CI excluding
  zero is the minimum (`scripts/bootstrap_market_edge_ci.py`, DEBT 62).
- Brier and RPS must state their aggregation convention. `metric-contract.json`
  records that the two Brier conventions differ by exactly 3.0000x for C=3.
- Any calibration claim must report n. At n=59 the RPS 95% CI is
  [0.1944, 0.2476] — wide enough to straddle the displayed gate.

---

## 8. Definition of done

A phase is done when **all** hold:

1. Merged with tests proportional to risk; all required checks green — verify with
   `gh pr checks`, and re-verify after any post-open commit, including ones pushed
   by automated review agents.
2. A measured result recorded under `backend/reports/` or `docs/DEBT.md`,
   **especially a negative one**.
3. `CHANGELOG.md`, `docs/DEBT.md`, and the model card updated where a candidate
   was evaluated.
4. No gate threshold changed to admit a result. No promotion without all seven
   `certification_policy` gates passing on their own evidence. No consumer-facing
   claim without a number behind it and a label that names what that number
   measures.
5. Production state re-verified and reported **including when unchanged** —
   three-way SHA parity, not assumed from a prior session.

---

## 9. Standing position

The platform fails closed correctly and can state precisely how far from
staking-ready it is. It does not beat the market; four independent measurements
say so and v4 does not reopen that question.

What v4 adds is that "calibrated and transparent" is no longer a fallback posture
— it is a **quantified target with 15.6% of Brier available on the reliability
term alone**, roughly twenty times the delivered result of the entire
feature-expansion programme, reachable with data already held and an instrument
already built.

Build the best-calibrated forecast in the category, prove it with proper scoring
rules and interval estimates, and label every number on the surface with what it
actually measures. Do not promise accuracy. Promise — and then verify —
calibration.
