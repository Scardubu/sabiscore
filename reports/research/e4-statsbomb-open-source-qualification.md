# Experiment E4 — StatsBomb Open Data: Source Qualification (Gate R1)

**Directive:** v5 §15 (Coverage Gates G1–G6), §23 (Event Data Research Programme,
gates D1–D5), §40 (Gate R1), §41 (Kill Criteria), §42 (Reopening), §47 Action 6.
**Date:** 2026-09-11.
**Portfolios gated by this result:** C (Event-Derived Team State), D (Tactical
Matchup Interaction).
**Machine-readable artifact:** `backend/reports/evaluation/e4-statsbomb-source-qualification.json`
**Reproduce:** `cd backend && PYTHONPATH=. python scripts/audit_statsbomb_e4_coverage.py`

**Decision: REJECT for production integration. RESEARCH-ONLY retained.**
**Phases 2 (SPADL) and 3 (xT/VAEP) are NOT authorized and were not built.**

---

## 0. Why this audit was run at all, when a StatsBomb number already existed

`reports/research/experiment_registry.yaml` records E4 as `SOURCE_QUALIFIED /
HOLD`, blocked at Gate G1. Its own `decision_detail` states the grounds:

> "Blocked at Gate G1 by a coverage ceiling this codebase had already measured
> for a **different feature** (COVERAGE_THRESHOLD_PCT = 85.0). **No new audit
> was run** because the existing measurement already answers it."

That borrowed number is **23.58%**, from
`backend/reports/evaluation/statsbomb-coverage-audit-2026.json`. It measures
StatsBomb against the **Understat parquet corpus** in order to decide Path A/B
for two `PHASE7_FEATURES_ALWAYS_DATA_GAP` slots. It is a correct answer to that
question and remains untouched.

It is the wrong denominator for E4. E4 asks about the corpus SabiScore actually
trains and serves on — `backend/data/cache/fd_*.csv`, 12,765 fixtures across
2019/2020–2025/2026 — and about **Gate G5, prediction-time availability, which
no StatsBomb audit in this repository has ever measured.** §42 clause 6
("corrected methodological defect") is the grounds for measuring it properly.

Measured against the right denominator, coverage is not 23.58%. It is **1.15%**.

---

## 1. Gate results

| Gate | Measure | Result | Bar | Verdict |
|---|---|---|---|---|
| **G1** Fixture coverage | 147 of 12,765 corpus fixtures | **1.15%** | ≥85% | **FAIL** |
| **G2** Historical depth | 3 of 6 leagues have **zero** in-window seasons | — | contiguous | **FAIL** |
| **G3** Cross-season stability | 5 league-seasons, max 32 fixtures each | — | stable | **FAIL** |
| **G4** Cross-league portability | 0 of 6 leagues clear the bar; 3 at zero | — | all leagues | **FAIL** |
| **G5** Prediction-time availability | **0 of 2,058** servable 2025/2026 fixtures | **0.00%** | ≥85% | **FAIL** |
| **G6** Production default rate | implied | **100.0%** | ≤15% | **FAIL** |
| **D1** Identity crosswalk | 103 of 157 StatsBomb team keys resolved | 65.61% | — | measured |
| **D2** Event completeness | 12 sampled, 0 malformed, 3,917 events/match | — | — | **PASS** |

### G1 — per league

| League | Corpus fixtures | StatsBomb in window | Matched | Coverage |
|---|---:|---:|---:|---:|
| EPL | 2,660 | 0 | 0 | 0.00% |
| LA_LIGA | 2,660 | 68 | 59 | 2.22% |
| SERIE_A | 2,660 | 0 | 0 | 0.00% |
| BUNDESLIGA | 2,142 | 34 | 32 | 1.49% |
| LIGUE_1 | 2,337 | 58 | 56 | 2.40% |
| EREDIVISIE | 306 | 0 | 0 | 0.00% |

### G2 — what StatsBomb actually publishes for SabiScore's leagues

Read live from `competitions.json` (80 competition-season rows, 24 competitions),
not from memory:

| League | StatsBomb seasons, all time | Inside corpus window (2019/20–2025/26) |
|---|---|---|
| EPL | 2003/2004, 2015/2016 | **none** |
| LA_LIGA | 1973/74, 2004/05 … 2020/21 | 2019/2020, 2020/2021 |
| SERIE_A | 1986/1987, 2015/2016 | **none** |
| BUNDESLIGA | 2015/2016, 2023/2024 | 2023/2024 |
| LIGUE_1 | 2015/2016, 2021/22, 2022/23 | 2021/2022, 2022/2023 |
| EREDIVISIE | — | **never published at all** |

### G3 — the in-window seasons are curated subsets, not seasons

| League-season | Matched fixtures | A full season is |
|---|---:|---:|
| LA_LIGA 2019/2020 | 28 | 380 |
| LA_LIGA 2020/2021 | 31 | 380 |
| LIGUE_1 2021/2022 | 24 | 380 |
| LIGUE_1 2022/2023 | 32 | 306 |
| BUNDESLIGA 2023/2024 | 32 | 306 |

These are the curated free releases (a single club's fixtures per season), not
domestic-league feeds. StatsBomb's full-season open releases — EPL 2015/16,
Serie A 2015/16, Ligue 1 2015/16, La Liga 2015/16, each ~380 matches — all sit
**outside** SabiScore's training window.

### G5 — the decisive gate, and the one never previously measured

The newest domestic-league season StatsBomb Open publishes for **any** SabiScore
league is **2023/2024** (Bundesliga). SabiScore serves **2025/2026**.

**0 of 2,058 servable fixtures have StatsBomb event data. Not few — zero.**

This is structural, not statistical. No sample size, model, or representation
changes it, and no improvement to the crosswalk can move it: the data does not
exist for the season being predicted.

---

## 2. D2 — the source is excellent where it exists

This matters for the honesty of the verdict. Twelve in-window matches sampled
end to end:

| Measure | Result |
|---|---|
| Fetch failures | 0 / 12 |
| Mean events per match | 3,916.9 |
| Malformed events | **0** |
| Matches with `Pressure` events | 12 / 12 |
| Matches with `Carry` events | 12 / 12 |
| Matches not reporting exactly two teams | 0 / 12 |

**StatsBomb Open is not a low-quality source. It is a high-quality source that is
almost entirely absent for the fixtures SabiScore predicts.** The kill is §41
*Data failure — insufficient coverage*, not a data-quality failure. Recording the
distinction matters, because it determines what would reopen the branch (§4).

---

## 3. D1 — the crosswalk, and a bug found by building it

Gate D1 required a real identity crosswalk that **fails closed on unknown
entities without silently substituting**. Building it surfaced a defect in the
first implementation, which is recorded here because it is a known repeating
class in this codebase and it produced a *plausible wrong answer*, not an error.

The first draft resolved StatsBomb names to corpus names by bare token-subset.
The corpus (football-data.co.uk abbreviations) and StatsBomb (full legal names)
are two different vocabularies, and:

```
StatsBomb "Paris Saint-Germain"  ->  key {paris, saint, germain}
corpus    "Paris SG"  (PSG)      ->  key {paris, sg}     NOT a subset
corpus    "Paris"     (Paris FC) ->  key {paris}         IS  a subset
```

So PSG's fixtures were silently assigned to **Paris FC**, and Ligue 1 reported
**0 matched fixtures out of 58** — a plausible-looking zero that would have been
read as "StatsBomb has no usable Ligue 1 data."

This is the same collision `backend/src/services/team_identity.py` already
guards on the market-matching side, reintroduced in a new file. The fix replaces
the subset test with a containment **score** (how much of the StatsBomb name a
corpus key accounts for) requiring a unique strict maximum: `paris sg` scores 3,
`paris` scores 1, PSG wins outright. A tie is left unresolved.

Effect of the fix: G1 0.70% → **1.15%**, zero-coverage leagues 4 → 3, D1
resolution 61.78% → **65.61%**. **G5 stayed at 0.00%**, as it must.

Pinned by `backend/tests/unit/test_statsbomb_e4_crosswalk.py` (9 tests). The
guard was **watched failing** against the reverted rule before being trusted —
the old rule was restored in-process and confirmed to resolve PSG to `paris`.

Residual unresolved names are left unresolved rather than aliased: `Saint-Étienne`
(`st` ↔ `saint` is a contraction, not a prefix) and `Inter Milan` (ambiguous
against corpus keys `inter` and `milan`). Both appear only in seasons outside the
corpus window, so neither affects any gate. Adding aliases for them would be
speculative work on data that changes nothing.

---

## 4. Decision, and what was deliberately not built

### Phase 1 — acquisition, crosswalk, coverage audit: **executed**

Delivered: `backend/scripts/audit_statsbomb_e4_coverage.py`,
`backend/reports/evaluation/e4-statsbomb-source-qualification.json`,
`backend/tests/unit/test_statsbomb_e4_crosswalk.py`.

No production code path, feature contract, or model artifact was touched.

### Phases 2 (SPADL) and 3 (xT/VAEP): **not authorized, not built**

`kloppy`, `socceraction`, and `duckdb` were **not installed**. The directive
blocks this escalation on the evidence above, in four independent places:

- **§23 D5** — "Only after simple aggregates survive may the programme
  investigate xT, VAEP, possession chains, graph representations, spatial
  encoders." The simple aggregates did not survive: `home_pressing_intensity`
  and `progressive_carry_diff` are already permanently relegated to
  `PHASE7_FEATURES_ALWAYS_DATA_GAP` on this same source.
- **§47 Action 6** — "Do not authorize VAEP/xT merely because the libraries are
  available."
- **§15 G6** — "Any candidate with a high production default rate must be
  rejected unless the missingness itself is separately modeled and demonstrably
  informative." The default rate is **100%**.
- **§44** — "automatic integration of StatsBomb simply because the dataset is
  rich" is explicitly prohibited.

A VAEP pipeline built now would produce features present for 1.15% of training
fixtures and **0%** of served fixtures. Under §34 that is State C/D on every
live request — the feature could never be anything but a default. Per §53, *the
information has not earned the model.*

### §51 decision

**REJECT for production integration.** Not HOLD: §51's HOLD default applies to
an *inconclusive small sample*, and G5 = 0% is neither small-sample nor
inconclusive — it is a structural absence of the data for the season being
predicted.

**RESEARCH-ONLY retained.** D2 shows the source is sound. The 147 matched
fixtures remain legitimate material for offline representation research that
makes no production claim.

### Reopening conditions (§42)

Materially different evidence, any one of which reopens this:

1. StatsBomb Open publishes a **current-season** domestic feed for a SabiScore
   league (moves G5 off zero — the only gate that matters).
2. A commercial StatsBomb licence is authorized, changing the coverage question
   entirely.
3. A **different** L0/L1 event-data source clears G1 **and** G5.

Re-running the same audit against the same archive is not one of them. The
reproduction command in the header answers condition 1 in one run.

---

## 5. What this narrows (§10 — negative evidence compounds)

The prior is now sharper than "event data is blocked on coverage":

- **Event-derived team state (Portfolio C) and tactical interaction (Portfolio D)
  are blocked on the same single fact** — no open event source covers the served
  season. They are not two independent research directions with two independent
  chances; they share one upstream dependency, and it is empty at prediction time.
- **The blocker is availability, not quality or legality.** StatsBomb is L0 and
  D2-clean. That rules out the two failure modes a *different* open event
  provider might fix, and points any future search at one requirement only:
  **current-season coverage**. A richer archive is worth nothing here.
- Combined with `D1` (FBref, killed L3) and the `E3` Understat REJECT, all three
  open event-data avenues this programme has qualified now fail — on legal
  grounds, information grounds, and availability grounds respectively. Portfolio
  C/D should not be re-entered through another archive-shaped source.
