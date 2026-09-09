# SabiScore — Data Intelligence & Prediction Improvement Executive Directive v5
### Production Data Intelligence, Information Gain & Forecast Improvement Program
**Date:** 2026-09-08  
**Supersedes:** v4  
**Governing principle:** **New trustworthy information → measurable incremental information gain → statistically defensible out-of-sample improvement → production-grade intelligence**

---

## 0. Mission

SabiScore must not pursue prediction improvement as a generic feature-engineering or model-complexity exercise.

The objective of this directive is to determine, with production-grade evidence, whether SabiScore can acquire **new information that is genuinely unavailable to its current forecasting system**, transform that information into reproducible pre-match intelligence, and demonstrate that it produces **incremental out-of-sample predictive value** beyond:

1. the current SabiScore incumbent;
2. the de-vigged market baseline;
3. established structural baselines;
4. existing information already represented by the current feature contract.

The desired chain is:

> **New information**
> → **reliable acquisition**
> → **correct temporal reconstruction**
> → **independent information**
> → **incremental predictive value**
> → **statistically significant and practically meaningful improvement**
> → **production-safe serving**
> → **continuous verification**

No component of that chain may be skipped.

The programme must therefore answer a narrower and more difficult question than:

> “What additional football features could we add?”

It must answer:

> **“What information does SabiScore not currently know, can know before prediction time, can reconstruct historically without leakage, can acquire legally and reproducibly, and can demonstrate to contain incremental information after conditioning on SabiScore and the market?”**

If no source survives that sequence, the correct outcome is a documented negative result.

---

# 1. Strategic Position

## 1.1 Current evidence

The current repository has established, across multiple independent analyses, that:

- the incumbent does not currently demonstrate an edge over the de-vigged market;
- previous feature-expansion programmes produced negligible aggregate improvement;
- the system currently has a meaningful calibration defect;
- the current uncertainty contract is incomplete;
- several apparent public “gates” are not actually part of the versioned certification policy;
- parts of the existing data stack are installed but unused;
- several supposedly promising research directions are blocked by coverage or production constraints.

These are not invitations to repeat the same experiments.

They establish the research prior:

> **Future improvement must come either from better use of information already available, better extraction of latent structure from legitimately available information, or genuinely new information unavailable to the incumbent.**

The programme must explicitly distinguish these three possibilities.

---

## 1.2 Primary strategic objectives

This directive establishes four parallel objectives:

### Objective A — Repair known forecast defects
Improve calibration and forecast integrity using the information already held.

### Objective B — Discover genuine information gaps
Identify information unavailable to the current system that has a credible causal relationship with pre-match outcomes.

### Objective C — Prove incremental value
Demonstrate that candidate information improves proper scoring rules and/or decision-relevant metrics after conditioning on incumbent SabiScore and market information.

### Objective D — Convert only surviving evidence into production intelligence
Integrate successful information sources without weakening train/serve parity, provenance, fail-closed semantics, licensing discipline, or certification.

---

# 2. Non-Negotiable Research Doctrine

## Rule 1 — Information beats feature count

One independent source with demonstrable incremental value is more important than dozens of redundant derived features.

Feature volume is not progress.

---

## Rule 2 — Data acquisition is itself an experiment

A source may not be integrated merely because:

- it is free;
- it is popular;
- it has many columns;
- it contains xG;
- it has event-level data;
- a research paper used it;
- another football analytics project uses it.

A source first requires:

> **coverage → legality → temporal reconstructability → reliability → identity resolution → redundancy analysis → incremental information test**

Only then may engineering investment be authorized.

---

## Rule 3 — Pre-match information is the unit of truth

Every candidate feature must answer:

> **Exactly when did this information become knowable?**

The canonical record must include:

- source timestamp;
- observed timestamp;
- publication timestamp where applicable;
- effective timestamp;
- fixture kickoff;
- allowed prediction cutoff;
- freshness at inference;
- whether the value changed between historical observation and post-match archival state.

A feature reconstructed from current historical webpages is not automatically valid for historical inference.

---

## Rule 4 — Historical availability must be reconstructable

A source is not historically valid merely because current data exists.

The programme must distinguish:

### A. Historical reconstructability
The value can be reproduced as it would have existed before kickoff.

### B. Historical availability with revision risk
The source exists historically but may have been corrected/revised after the match.

### C. Current-only availability
Useful for production but unsuitable for retrospective model evaluation.

### D. Post-match archival data
Useful for analysis but prohibited from pre-match forecasting.

This distinction must exist in the experiment registry.

---

## Rule 5 — No fabricated data

Unknown remains `None`.

Missing information must not become:

- `0`;
- league average;
- neutral prior;
- “not injured”;
- “normal weather”;
- “average player”;
- synthetic odds;
- placeholder confidence.

A missing value is a state of knowledge, not a measurement.

---

## Rule 6 — The market is mandatory evidence

No candidate may be described as predictive improvement merely because it beats the incumbent.

Every meaningful experiment must compare:

> candidate  
> vs. incumbent  
> vs. de-vigged market  
> vs. appropriate structural baseline

The candidate may eventually demonstrate:

- better calibration;
- better discrimination;
- better distributional forecasting;
- better conditional performance;
- better robustness;

without beating the market.

Those are valid findings.

They must not be translated into “market edge” without separate evidence.

---

## Rule 7 — Redundant market reconstruction is not independent signal

A source that primarily reconstructs bookmaker probability is not an independent football-information source.

Market-derived features may still be useful, but they must be classified as:

> **market intelligence**

rather than:

> **independent football intelligence**

The research must explicitly estimate the degree to which a candidate source adds information beyond the market.

---

## Rule 8 — No model shopping

A failed information source cannot be repeatedly passed through increasingly sophisticated models until one produces an apparent improvement.

The information layer must demonstrate value before architectural escalation.

Required sequence:

> source → data quality → information value → representation → simple model → advanced model

not:

> source → transformer → ensemble → HPO → report improvement

---

## Rule 9 — Statistical uncertainty is mandatory

No decision may rest on a point estimate.

Every candidate result must include:

- sample size;
- temporal test window;
- metric convention;
- confidence interval;
- paired comparison;
- effect size;
- statistical test;
- multiple-testing context;
- practical significance;
- robustness across folds or periods.

---

## Rule 10 — Negative evidence compounds

A failed experiment narrows the research space.

The experiment registry and `docs/DEBT.md` are therefore research assets, not administrative records.

Each negative result must improve the prior.

---

# 3. Current Ground Truth — Mandatory Re-verification

Before any new research branch is authorized, re-verify the current repository and deployment state.

Do not rely on this document for stale values.

Required verification includes:

### Repository
- current SHA;
- branch;
- dirty state;
- active generation;
- model artifact identity;
- feature schema;
- model registry;
- certification policy;
- certification hash;
- active thresholds;
- training configuration.

### Deployment
- Render SHA;
- Vercel SHA;
- backend SHA;
- local SHA;
- backend/web divergence;
- deployment timestamp.

### Database
- PostgreSQL version;
- Alembic head;
- schema inventory;
- active prediction tables;
- feature/data provenance tables;
- model-generation tables.

### Runtime
- Python version;
- production dependency tree;
- research dependency tree;
- memory limits;
- inference latency;
- feature resolution latency;
- external provider latency.

### Evidence
- settled prediction count;
- calibration metrics;
- RPS;
- Brier;
- log loss;
- ECE;
- market baseline;
- CLV diagnostic;
- uncertainty status;
- staking status;
- promotion gates.

The output must be:

> `GROUND_TRUTH_SNAPSHOT_<date>.json`

and must be immutable for the duration of the experiment cycle.

---

# 4. The SabiScore Information Model

The system must formally distinguish five layers.

## Layer 1 — Raw information

What the external world says.

Examples:

- shot;
- player availability;
- lineup announcement;
- injury;
- referee;
- weather;
- market quote;
- manager appointment.

---

## Layer 2 — Validated observation

The raw information after:

- schema validation;
- timestamp validation;
- identity resolution;
- duplication checks;
- provenance assignment;
- source confidence classification.

---

## Layer 3 — Prediction-time state

The subset of validated information legally and temporally available at a specific prediction cutoff.

This is the authoritative training/serving object.

---

## Layer 4 — Derived representation

Examples:

- rolling xG;
- expected minutes;
- player replacement strength;
- tactical compatibility;
- pressing mismatch;
- dynamic team state.

---

## Layer 5 — Forecast

The output:

- `P(Home)`;
- `P(Draw)`;
- `P(Away)`;
- score distribution;
- confidence interval;
- conformal set where authorized.

This separation prevents post-match or revised data from silently entering the feature space.

---

# 5. Research Portfolio

The programme is divided into six distinct research portfolios.

## Portfolio A — Calibration

Question:

> Can SabiScore materially improve the statistical quality of its probabilities without acquiring additional information?

Candidates:

- temperature scaling;
- vector scaling;
- isotonic regression;
- beta calibration;
- hierarchical calibration;
- horizon-conditional calibration;
- probability shrinkage;
- class-specific calibration.

Primary target:

> reduce reliability while preserving or improving resolution.

Secondary targets:

- ECE;
- log loss;
- RPS;
- Brier.

Calibration does **not** constitute a market-edge claim.

---

# 6. Portfolio B — Player Availability Intelligence

This becomes the highest-priority new-information research branch.

The reason is not that “players are important.”

The research hypothesis is more specific:

> **The current match-level system may know team strength but fail to observe last-minute changes in the composition and expected quality of the team actually available to play.**

Investigate:

- injuries;
- suspensions;
- probable XI;
- confirmed XI;
- expected minutes;
- replacement quality;
- bench depth;
- role importance;
- positional scarcity;
- lineup continuity;
- player return timing;
- minutes restrictions;
- manager selection patterns.

The representation should not initially be player-name-heavy.

Start with measurable latent quantities:

### Availability delta

`expected_available_strength − baseline_team_strength`

### Replacement cost

`starter_strength − expected_replacement_strength`

### Positional disruption

`importance-weighted missing strength by role`

### Continuity

`expected XI overlap with recent XI`

### Depth resilience

`quality retained after removing unavailable players`

Only after these aggregate hypotheses survive should player embeddings or lineup graphs be considered.

---

# 7. Portfolio C — Event-Derived Team State

Do not begin with a universal StatsBomb/VAEP implementation.

First determine where sufficient coverage exists.

Candidate information families:

- shots;
- shot locations;
- xG;
- passes;
- progressive actions;
- possession chains;
- pressures;
- turnovers;
- defensive actions;
- set pieces;
- transition frequency;
- final-third entries.

The central question is not:

> “Can we calculate xT?”

It is:

> **“Does event-derived team state contain information that the current SabiScore + market representation does not already contain?”**

Candidate representations:

- rolling opponent-adjusted xG;
- shot-quality profile;
- shot-location distribution;
- build-up directness;
- progression intensity;
- pressing intensity;
- transition propensity;
- set-piece strength;
- defensive concession profile.

---

# 8. Portfolio D — Tactical Matchup Intelligence

This is the highest-value “unknown unknown” branch.

The objective is not to classify teams as:

- possession team;
- pressing team;
- defensive team.

Those are usually too coarse.

The research target is:

> **interaction**

Examples:

- pressing vulnerability × opponent build-up quality;
- low-block attack quality × opponent low-block defense;
- transition creation × opponent transition concession;
- aerial/set-piece strength × opponent set-piece weakness;
- progressive carrying × opponent defensive channel exposure;
- defensive line height × opponent runner threat.

The key representation becomes:

> **Team A behavior × Team B susceptibility**

rather than independent team statistics.

No tactical feature may be promoted unless historical out-of-sample evidence demonstrates that the interaction adds more than the corresponding independent components.

---

# 9. Portfolio E — Information Arrival / Market Microstructure

This portfolio explicitly investigates whether useful information enters the public forecasting ecosystem over time.

Required timestamps where available:

- opening quote;
- subsequent quote;
- lineup publication;
- injury update;
- manager announcement;
- weather revision;
- closing quote.

Research questions:

1. When does meaningful probability movement occur?
2. What observable external event coincides with that movement?
3. Does a non-market source provide the same information earlier?
4. Does SabiScore gain anything by observing the source directly?
5. Is the effect independent of final market state?

Candidates:

- opening → intermediate movement;
- cross-book dispersion;
- market disagreement;
- quote volatility;
- pre-lineup vs post-lineup movement;
- injury/news shocks;
- weather shocks;
- market convergence velocity.

A model that simply reproduces the final market is not considered an independent-information success.

---

# 10. Portfolio F — Contextual State

Investigate:

- rest;
- fixture congestion;
- travel distance;
- travel time;
- time-zone displacement;
- weather;
- altitude;
- stadium conditions;
- referee characteristics;
- scheduling asymmetry.

These are intentionally lower priority.

They must prove information value before engineering investment.

The default prior is:

> potentially useful, but likely weaker than player availability, team state, tactical interaction, and information-arrival signals.

---

# 11. Data Source Qualification Framework

Every external source receives a formal source score.

## Required dimensions

| Dimension | Requirement |
|---|---|
| Coverage | Relevant fixtures represented |
| Historical depth | Adequate retrospective window |
| Temporal fidelity | Historical values reconstructable |
| Freshness | Appropriate for serving |
| Identity quality | Stable entity mapping |
| Reliability | Measured source consistency |
| Missingness | Quantified, not assumed |
| Independence | Incremental information potential |
| Legal status | Explicitly classified |
| Access stability | API/scrape/download reliability |
| Cost | Free/freemium/paid |
| Rate limits | Measured |
| Integration cost | Engineering estimate |
| Compute cost | Processing estimate |
| Operational fragility | Failure likelihood |
| Provenance | Raw-data retention possible |

---

# 12. Source Legal/Access Classification

Every candidate source must be placed into one of these classes:

### L0 — Explicitly reusable
Open licence / explicit public-data terms permitting intended use.

### L1 — Research-use constrained
Potentially usable for research but requiring legal review before production.

### L2 — Publicly visible but rights unclear
May not enter production without explicit approval.

### L3 — Terms hostile to automated production access
Research-only unless legal status changes.

### L4 — Prohibited
Do not ingest.

The roadmap must never describe “publicly scrapeable” as equivalent to “legally reusable.”

---

# 13. Data Opportunity Matrix

Every candidate source receives:

| Opportunity | Source | Signal | Current Gap | Coverage | History | Temporal fidelity | Independence | Cost | Legal class | Integration | Leakage risk | Expected information gain | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Priority is determined by:

> **Expected information gain × coverage × temporal reliability × legal viability ÷ implementation cost**

Not by source popularity.

---

# 14. Tier Definitions

## Tier 0 — Immediate Research

Must be investigated first because:

- the information is plausibly high-value;
- current system lacks it;
- historical testing is feasible;
- integration cost is bounded.

Likely candidates:

1. calibration;
2. player availability;
3. lineup/expected-minutes state;
4. historical event-derived team state where coverage clears;
5. information-arrival/market timing.

---

## Tier 1 — High-value conditional

Examples:

- tactical matchup;
- replacement quality;
- squad depth;
- dynamic team state;
- set-piece matchup;
- manager-change state.

---

## Tier 2 — Research

Examples:

- richer network representations;
- graph-based lineup representations;
- state-space team models;
- temporal embeddings.

---

## Tier 3 — Experimental

Examples:

- transformers;
- deep spatial encoders;
- GNNs;
- neural point processes.

No Tier-3 architecture may be built merely because it appears in the literature.

---

## Reject

Examples:

- redundant feature expansion;
- repeated league carve-outs;
- repeated HPO campaigns without new information;
- market-copying features;
- low-coverage data sources;
- legally unsuitable scraping;
- features that depend on post-match revisions;
- features that become defaults on an unacceptable share of served fixtures;
- architectures that add complexity without information gain.

---

# 15. Coverage Gate

For every external source:

### Gate G1 — Fixture coverage

Measure percentage of SabiScore fixtures with usable records.

### Gate G2 — Historical depth

Measure contiguous seasons and gaps.

### Gate G3 — Cross-season stability

Measure whether coverage collapses outside the source's strongest seasons.

### Gate G4 — Cross-league portability

Measure whether the signal generalizes beyond one competition.

### Gate G5 — Prediction-time availability

Measure percentage available at the intended prediction cutoff.

### Gate G6 — Default rate

Any candidate with a high production default rate must be rejected unless the missingness itself is separately modeled and demonstrably informative.

---

# 16. Information Value Testing

The information-testing stack must be changed from “correlation first” to a hierarchical evidence system.

## Stage 1 — Descriptive

Measure:

- distributions;
- variance;
- missingness;
- season drift;
- league drift;
- entity coverage.

---

## Stage 2 — Dependence

Measure:

- mutual information;
- conditional mutual information;
- residual association;
- monotonicity;
- redundancy;
- feature-feature dependence.

These are diagnostic tools, not promotion criteria.

---

## Stage 3 — Incremental forecasting

Fit the smallest defensible temporal baseline.

Compare:

`incumbent`

against

`incumbent + candidate information`

and separately:

`market`

against

`market + candidate information`

This isolates whether the information contributes:

- to SabiScore;
- to the market;
- to neither.

---

## Stage 4 — Conditional value

Measure performance across:

- probability bands;
- leagues;
- team-strength bands;
- home/away;
- congestion;
- data completeness;
- lineup disruption;
- prediction horizon.

A feature that only performs in one fragile slice is not globally validated.

---

# 17. Primary Statistical Test

The principal research question is:

> Does candidate information reduce expected proper scoring loss out-of-sample?

Primary metrics:

1. RPS;
2. multiclass Brier;
3. log loss.

Secondary:

- ECE;
- Murphy reliability;
- Murphy resolution;
- calibration slope/intercept;
- sharpness;
- CLV only under a proper economic definition;
- economic utility only after the underlying forecast is certified.

---

# 18. Statistical Validation Protocol

Every serious experiment must use:

### Temporal integrity
No random train/test split for forecasting claims.

### Walk-forward evaluation
Rolling-origin evaluation across multiple periods.

### Final untouched holdout
A final period remains sealed until the model/data hypothesis is frozen.

### Paired evaluation
Each candidate produces predictions on exactly the same eligible test fixtures as its baseline.

### Confidence intervals
Use block bootstrap appropriate to temporal dependence.

### Hypothesis correction
If multiple candidate signals are tested, apply a pre-declared multiple-testing protocol such as FDR control or family-wise correction where appropriate.

### Effect size
Report absolute and relative improvement.

### Practical significance
A statistically detectable but operationally negligible result must not be promoted.

### Robustness
A successful result should not depend on one season, one league, one seed, or one narrow parameter choice.

---

# 19. No Arbitrary `ΔBrier` Gate

The existing research strategy must not hard-code a universal threshold such as:

> `ΔBrier ≥ 0.01`

unless a power analysis demonstrates that the threshold is appropriate for the available sample and business objective.

Instead define:

### Statistical criterion

Confidence interval for paired improvement excludes zero.

### Practical criterion

Improvement exceeds a pre-registered minimum effect size.

### Robustness criterion

Improvement survives multiple temporal folds.

### Market criterion

Candidate does not merely reproduce the market.

### Operational criterion

Source remains sufficiently available and reliable in production.

---

# 20. Calibration Workstream

## B1 — Establish immutable baseline

Persist:

- RPS;
- Brier;
- reliability;
- resolution;
- uncertainty;
- ECE;
- log loss;
- reliability plots;
- sample count;
- calibration window.

---

## B2 — Candidate recalibration

Evaluate:

1. temperature scaling;
2. vector scaling;
3. isotonic regression;
4. beta calibration where justified.

Use the existing independent calibration holdout.

---

## B3 — Promotion test

Candidate succeeds only if:

- calibration error materially improves;
- discrimination does not materially degrade;
- proper scoring does not degrade;
- improvement survives paired uncertainty analysis;
- calibration behavior persists on untouched data;
- candidate passes the existing promotion gates.

---

# 21. Uncertainty Workstream

Conformal prediction may be investigated, but the claim must be explicit.

## Valid claim

> “The system's prediction sets achieve measured marginal coverage under the evaluation assumptions.”

## Invalid claim

> “The system now knows which predictions will be wrong.”

These are different properties.

Non-adaptive split conformal may be evaluated first.

Adaptive conformal methods are prohibited until an appropriate difficulty signal has been demonstrated.

Acceptance criteria must include:

- empirical coverage;
- nominal coverage;
- set size;
- failure concentration;
- stability across temporal windows.

Coverage alone is not sufficient.

---

# 22. Player Availability Research Programme

This becomes the first major new-information experiment.

## Hypothesis

Pre-match player availability and expected lineup quality contain incremental information not already represented by SabiScore team-state features and market probabilities.

## Data candidates

Research, rather than prematurely integrate:

- injury feeds;
- suspension information;
- lineup announcements;
- expected lineups;
- player appearances;
- minutes;
- role;
- squad depth.

## Derived representations

Start with:

- unavailable starting-strength;
- replacement cost;
- positional disruption;
- expected-XI continuity;
- expected available strength;
- bench resilience.

## Baseline

`incumbent`

vs.

`incumbent + availability`

and

`market`

vs.

`market + availability`

## Promotion requirement

The signal must demonstrate incremental value independently of final market probability.

---

# 23. Event Data Research Programme

Before implementing `socceraction`, VAEP, xT, or GNN infrastructure:

### D1 — Coverage audit

The StatsBomb/Understat identity crosswalk must be measured.

### D2 — Event completeness

Measure:

- event completeness;
- missing matches;
- malformed events;
- team identity consistency;
- shot coverage;
- player identity coverage.

### D3 — Prediction-time aggregation

Build only pre-match rolling state.

### D4 — Information test

Demonstrate incremental predictive value.

### D5 — Representation escalation

Only after simple aggregates survive may the programme investigate:

- xT;
- VAEP;
- possession chains;
- graph representations;
- spatial encoders.

This prevents a high-complexity implementation from masking a low-information dataset.

---

# 24. Tactical Interaction Research

The first tactical model should be explicit and interpretable.

Example:

```text
home_pressing_intensity
×
away_build_up_vulnerability
```

rather than immediately building a GNN.

Candidate interactions:

- press × buildup;
- transition × defensive concession;
- set-piece attack × set-piece defense;
- crossing × aerial vulnerability;
- carry × defensive containment;
- line-height × depth-runner threat.

The research question is whether these interaction terms improve the conditional forecast after accounting for their constituent signals.

---

# 25. Structural Baselines

Add evaluation-only reference models:

1. historical frequency;
2. league-adjusted frequency;
3. Elo;
4. dynamic Elo;
5. Poisson;
6. Dixon-Coles;
7. market implied probability;
8. current SabiScore;
9. simple blend;
10. candidate model.

These are reference instruments.

They are not automatically production candidates.

---

# 26. Model Escalation Ladder

The system must follow:

### Level 0
Simple statistical baseline.

### Level 1
Regularized logistic / linear model.

### Level 2
Existing tree ensemble.

### Level 3
Calibrated ensemble.

### Level 4
Dynamic state-space / Bayesian model.

### Level 5
Sequence model.

### Level 6
Graph/spatial model.

A model may advance only if the preceding level demonstrates that the information warrants greater representational complexity.

---

# 27. Auxiliary Targets

Secondary targets may include:

- goals scored;
- goals conceded;
- expected goals;
- shot volume;
- chance quality;
- first goal;
- scoreline distribution;
- latent team strength.

But auxiliary prediction is not automatically useful.

Before introducing multi-task learning, test:

> Does the auxiliary task improve the primary 1X2 distribution?

If not, it remains research-only.

---

# 28. Market Intelligence Rules

Market data must be separated into:

### Market baseline

Used to evaluate the model.

### Market information

Used as a feature.

### Economic execution data

Used only after certified forecasting.

No metric may be labelled “CLV” unless it measures actual price movement relative to an obtainable reference price.

A model-belief-minus-closing-probability diagnostic must have a different name.

---

# 29. Error-Driven Research Engine

The research backlog must be generated from observed failures.

For every failed prediction record:

- league;
- team-strength band;
- market probability;
- model probability;
- calibration residual;
- prediction horizon;
- lineup state;
- availability state;
- congestion state;
- tactical state where available;
- source completeness;
- market movement.

Aggregate errors into failure clusters.

The next data-acquisition hypothesis should be selected partly from:

> **largest reproducible error cluster × plausible missing information × acquisition feasibility**

---

# 30. Unknown-Unknowns Programme

Every research cycle must contain a structured unknown-unknown exercise.

Researchers must ask:

> What materially relevant match information exists in the real world that is absent from our data model because we have never represented it?

Candidate families include:

- expected starting XI;
- player role changes;
- lineup chemistry;
- replacement quality;
- manager tactical adaptation;
- opponent-specific tactical mismatch;
- set-piece matchup;
- schedule fatigue;
- information arrival timing;
- squad rotation;
- manager-change regime shifts;
- latent tactical state;
- market-news lag.

Every hypothesis must be classified:

### H1 — Observable and testable
Proceed.

### H2 — Observable but difficult
Research feasibility.

### H3 — Latent but inferable
Representation research.

### H4 — Speculative
Document, but do not engineer before a testable proxy exists.

---

# 31. Data Architecture

The production architecture remains:

```text
External Source
      ↓
Acquisition Adapter
      ↓
Raw Immutable Store
      ↓
Validation
      ↓
Entity Resolution
      ↓
Temporal Alignment
      ↓
Prediction-Time State
      ↓
Feature Generation
      ↓
Feature Contract
      ↓
Training Dataset / Serving
      ↓
Model
      ↓
Calibration
      ↓
FastAPI
      ↓
Production Observability
```

PostgreSQL remains durable application truth.

Alembic remains schema authority.

Redis remains hot operational state.

FastAPI remains backend authority.

No second queue.

No second team-name normalizer.

No hidden feature service.

No client-side prediction computation.

---

# 32. Raw Data Rules

Every new source requires:

- raw payload retention;
- source URL/API identifier;
- acquisition timestamp;
- source timestamp;
- schema version;
- content hash where feasible;
- parser version;
- transformation version;
- licence/access classification.

A derived feature must always be traceable back to its raw observation.

---

# 33. Feature Lineage

Every production feature must have:

```text
feature_id
source_id
source_timestamp
effective_timestamp
prediction_cutoff
transformation_version
availability_status
missingness_semantics
training_eligibility
serving_eligibility
provenance
```

This becomes part of certification.

---

# 34. Production Failure Semantics

External data failure must not silently produce a fabricated feature.

Permitted outcomes:

### State A
Feature available and valid.

### State B
Feature unavailable and omitted.

### State C
Feature dependency makes prediction ineligible.

### State D
System fails closed.

No fallback to arbitrary neutral values.

---

# 35. Memory and Compute Policy

Development target:

- approximately 8 GB RAM;
- CPU-first;
- remote GPU only when justified.

Preferred tools:

- DuckDB;
- Polars;
- PyArrow where actually required;
- memory-mapped data;
- Parquet;
- streaming aggregation;
- incremental processing.

Production dependencies must remain minimal.

A research dependency belongs in the ML environment unless runtime serving genuinely requires it.

The experiment registry must record:

- peak RSS;
- runtime;
- CPU usage;
- disk consumption;
- dataset size;
- model artifact size.

---

# 36. Tooling Evaluation

Candidate tools must be scored against:

> capability × reliability × license × coverage × maintainability × integration cost × compute cost

Possible components:

- DuckDB;
- Polars;
- scikit-learn;
- XGBoost;
- LightGBM;
- CatBoost;
- PyTorch;
- Optuna;
- MLflow;
- Evidently;
- DVC;
- Great Expectations;
- Apache Arrow.

No tool enters the production architecture solely because it is free or fashionable.

---

# 37. Agentic Research Architecture

Agents may accelerate:

### Research Agent
Searches literature, repositories and source documentation.

### Data Agent
Profiles source schemas and coverage.

### Feature Scientist
Generates hypotheses from known information gaps.

### Experiment Agent
Constructs registered experiment specifications.

### Statistical Reviewer
Runs pre-declared significance and robustness tests.

### Production Reviewer
Checks lineage, dependencies, legal status, failure behavior and parity.

### Certification Agent
Produces evidence packets but cannot certify autonomously.

Agents may never:

- invent evidence;
- rewrite test outcomes;
- modify promotion thresholds after seeing results;
- promote a model;
- activate staking;
- alter certification policy;
- suppress negative results.

Human authorization remains mandatory.

---

# 38. Experiment Registry

Each experiment must contain:

```yaml
experiment_id:
hypothesis:
information_source:
source_version:
source_license_class:
source_coverage:
historical_window:
prediction_cutoff:
dataset_version:
feature_version:
representation_version:
model_version:
parameters:
seed:
training_window:
validation_windows:
final_holdout:
baseline_models:
market_baseline:
primary_metrics:
secondary_metrics:
bootstrap_method:
statistical_test:
multiple_testing_family:
effect_size:
confidence_interval:
sample_size:
result:
robustness:
failure_modes:
compute:
peak_rss:
runtime:
decision:
artifact_location:
provenance:
reviewer:
certification_status:
```

The registry must be machine-readable.

---

# 39. Experiment State Machine

Every experiment follows:

```text
PROPOSED
↓
SOURCE QUALIFIED
↓
DATA VALIDATED
↓
TEMPORAL VALIDATED
↓
INFORMATION TEST
↓
MODEL CANDIDATE
↓
OUT-OF-SAMPLE EVALUATION
↓
STATISTICAL REVIEW
↓
ROBUSTNESS REVIEW
↓
PRODUCTION REVIEW
↓
SHADOW
↓
CERTIFICATION
↓
PROMOTION
```

The system must never jump from:

`PROPOSED → PRODUCTION`

or

`FEATURE → MODEL`

without intermediate evidence.

---

# 40. Research Gates

## Gate R0 — Ground truth

Current repository and deployment state verified.

## Gate R1 — Source qualification

Coverage, legality, temporal reproducibility and provenance pass.

## Gate R2 — Information qualification

Signal demonstrates non-trivial incremental information.

## Gate R3 — Forecast improvement

Candidate improves appropriate proper scores under temporal validation.

## Gate R4 — Statistical robustness

Confidence intervals, paired testing and multiple-testing controls pass.

## Gate R5 — Production viability

Runtime, freshness, failure behavior and dependency budget pass.

## Gate R6 — Shadow production

Live data proves operational integrity.

## Gate R7 — Certification

Existing promotion policy passes without modification.

---

# 41. Kill Criteria

A branch is killed when:

### Data failure
- insufficient coverage;
- unacceptable missingness;
- unreliable historical reconstruction;
- unstable source;
- unresolved identity mapping.

### Legal failure
- unclear or incompatible production rights;
- prohibited automation;
- unresolvable licensing risk.

### Information failure
- no incremental value conditional on incumbent;
- no incremental value conditional on market;
- candidate is demonstrably redundant.

### Statistical failure
- improvement indistinguishable from noise;
- benefit disappears across folds;
- effect depends on one narrow period;
- benefit disappears after proper multiplicity correction.

### Operational failure
- excessive latency;
- excessive memory;
- unreliable source;
- unacceptable maintenance burden.

### Complexity failure
A more complex representation cannot demonstrate material improvement over the simpler representation using the same information.

---

# 42. Reopening a Rejected Idea

A closed branch may be reopened only if at least one of the following is materially different:

1. new information;
2. new historical coverage;
3. new prediction cutoff;
4. new causal hypothesis;
5. new representation that encodes genuinely different information;
6. corrected methodological defect;
7. previously unavailable statistical power.

“Try it again with XGBoost instead of LightGBM” is not sufficient.

---

# 43. Priority Experiment Backlog

## Experiment E0 — Calibration Repair

**Hypothesis:** current probabilities are materially miscalibrated.

**Information:** no new source.

**Method:** temperature, vector and isotonic candidates.

**Baseline:** current serving probabilities.

**Success:** meaningful reduction in reliability/ECE without degradation in discrimination.

**Importance:** immediate.

---

## Experiment E1 — Player Availability Delta

**Hypothesis:** expected available team strength contains incremental information.

**Source:** legally viable availability/lineup source.

**Representation:** availability delta, replacement cost, positional disruption.

**Baseline:** incumbent + market.

**Success:** statistically defensible improvement across multiple temporal windows.

**Importance:** highest-priority new information candidate.

---

## Experiment E2 — Expected XI / Continuity

**Hypothesis:** lineup continuity and expected XI state contribute incremental signal.

**Representation:**

- expected XI overlap;
- positional changes;
- starter absence count;
- role disruption.

---

## Experiment E3 — Event-Derived Team State

**Hypothesis:** historical event-derived performance contains information not represented by current aggregate features.

**Prerequisite:** coverage gate.

---

## Experiment E4 — Tactical Interaction

**Hypothesis:** opponent-specific interaction contains information beyond independent team strength.

**Representation:** interaction terms first; graph model only if warranted.

---

## Experiment E5 — Market Information Arrival

**Hypothesis:** timing and structure of market movement reveal information arrival not captured by opening prices.

**Important:** must distinguish market intelligence from independent football intelligence.

---

## Experiment E6 — Dynamic Team State

**Hypothesis:** latent team strength changes faster than current Elo/rating representation.

**Candidate:** lightweight state-space model.

---

## Experiment E7 — Distributional Goal Model

**Hypothesis:** modelling score distributions directly improves 1X2 probability quality.

**Candidate:** Poisson/Dixon-Coles baseline, followed only if justified by evidence.

---

# 44. What Not to Do

The following are explicitly prohibited during this directive unless reopened under a materially different hypothesis:

- broad feature-density expansion;
- blind addition of dozens of statistics;
- repeated HPO campaigns;
- repeated ensemble expansion;
- league-specific carving without causal justification;
- generic weather-feature dumping;
- indiscriminate bookmaker-source aggregation;
- GNN/Transformer implementation before information qualification;
- automatic integration of StatsBomb simply because the dataset is rich;
- scraping every available website;
- replacing missing values with neutral measurements;
- marketing claims based on model-market disagreement;
- treating calibration as evidence of market superiority.

---

# 45. Immediate Production Hygiene

Before new research acquisition:

### A1
Resolve phantom certification thresholds.

### A2
Correct the CLV terminology.

### A3
Move research-only dependencies out of runtime.

### A4
Correct latency definitions.

### A5
Resolve authorized feature-availability instrumentation.

### A6
Resolve duplicated/malformed historical corpus issues before using it as a calibration or modelling source.

These are prerequisites for trustworthy experimentation.

---

# 46. Phase Plan

## Phase 0 — Ground Truth

Deliverables:

- repository snapshot;
- source inventory;
- feature inventory;
- model inventory;
- market inventory;
- certification inventory;
- debt inventory.

---

## Phase 1 — Calibration

Deliverables:

- baseline series;
- recalibration candidates;
- statistical comparison;
- candidate artifact;
- certification packet.

---

## Phase 2 — Missing Information Discovery

Deliverables:

- information opportunity matrix;
- source qualification table;
- legal/access assessment;
- coverage map;
- historical reconstructability map.

---

## Phase 3 — Data Qualification

Deliverables:

- source adapters;
- raw snapshots;
- entity-resolution audit;
- temporal audit;
- missingness audit;
- provenance records.

No production integration yet.

---

## Phase 4 — Information-Value Testing

For every surviving source:

> data → simple representation → incremental test → kill/promote

This is the principal research gate.

---

## Phase 5 — Representation Research

Only surviving information proceeds into:

- dynamic state;
- interactions;
- embeddings;
- graphs;
- spatial models.

---

## Phase 6 — Controlled Model Experiments

Models are compared using frozen experiment configurations.

---

## Phase 7 — Statistical Validation

Use:

- temporal folds;
- block bootstrap;
- paired tests;
- multiple-testing correction;
- holdout confirmation.

---

## Phase 8 — Shadow Production

Evaluate:

- data freshness;
- feature availability;
- serving parity;
- latency;
- failures;
- operational completeness.

---

## Phase 9 — Certification

All existing gates remain authoritative.

Research may not modify policy in order to pass a candidate.

---

## Phase 10 — Production Integration

Only after certification:

- schema migration;
- feature activation;
- model promotion;
- telemetry activation;
- post-deploy verification.

---

# 47. Top Ten Immediate Actions

## 1. Freeze the current evidence baseline

Persist every current metric and active artifact under a versioned baseline.

## 2. Complete calibration repair experiments

Use the existing temporal calibration holdout before acquiring new data.

## 3. Build the canonical Information Opportunity Matrix

Map:

> what SabiScore knows  
> what the market knows  
> what potentially exists outside both.

## 4. Run a formal player-availability source study

Do not integrate yet.

First determine:

- legality;
- historical depth;
- expected lineup availability;
- timestamp fidelity;
- coverage.

## 5. Build a prediction-time source contract

Every external observation gets:

> `observed_at`, `effective_at`, `available_at`, `cutoff`, `source_version`.

## 6. Re-run all event-data coverage audits

Especially the StatsBomb/Understat identity crosswalk.

Do not authorize VAEP/xT merely because the libraries are available.

## 7. Build lightweight incremental-information test harnesses

The harness must compare:

> incumbent  
> incumbent + source  
> market  
> market + source

using identical temporal folds.

## 8. Establish structural evaluation baselines

Add:

- Poisson;
- Dixon-Coles;
- dynamic rating baseline.

Evaluation-only.

## 9. Establish the machine-readable experiment registry

No research result exists unless it is reproducible from the registry.

## 10. Start the first three bounded experiments

Run:

1. calibration;
2. player availability;
3. event-derived team state where coverage qualifies.

Do not start GNN/Transformer research before those results exist.

---

# 48. Definition of Success

This programme does **not** succeed merely because:

- more data was acquired;
- more features were created;
- a neural network was trained;
- an RPS point estimate improved;
- a paper was reproduced;
- the market was beaten on one fold;
- an accuracy number increased;
- a dashboard became more sophisticated.

The programme succeeds when it produces at least one chain of evidence:

```text
NEW INFORMATION
      ↓
RELIABLY ACQUIRED
      ↓
LEGALLY USABLE
      ↓
HISTORICALLY RECONSTRUCTABLE
      ↓
TEMPORALLY VALID
      ↓
INDEPENDENT OF CURRENT FEATURES
      ↓
INCREMENTAL INFORMATION DEMONSTRATED
      ↓
OUT-OF-SAMPLE FORECAST IMPROVEMENT
      ↓
STATISTICALLY ROBUST
      ↓
PRACTICALLY MATERIAL
      ↓
PRODUCTIONALLY RELIABLE
      ↓
CERTIFIED
```

Anything short of that remains research.

---

# 49. Definition of Failure

The programme must explicitly conclude:

> **No sufficiently independent, economically practical, legally usable source was demonstrated to improve SabiScore out-of-sample under the specified validation regime.**

That is a successful scientific conclusion if the evidence supports it.

The system must never manufacture a roadmap merely because the roadmap is expected to contain positive findings.

---

# 50. Standing Product Position

SabiScore must continue to represent its forecasting capability accurately.

The product may claim:

- probabilistic forecasting;
- calibration measurement;
- uncertainty research;
- transparent evidence;
- model diagnostics;
- market comparison.

It must not claim:

- superior accuracy;
- market-beating performance;
- profitable betting performance;
- closing-line value;
- predictive superiority;

unless the corresponding evidence passes the platform's actual certification requirements.

---

# 51. Final Decision Framework

Every research branch ends with one of four decisions.

### PROMOTE

Evidence demonstrates:

- information value;
- forecast value;
- statistical robustness;
- operational viability;
- certification readiness.

### RESEARCH

Signal is promising but evidence or production readiness is incomplete.

### HOLD

Signal is plausible but insufficiently powered or historically reconstructable.

### REJECT

Evidence indicates the source/representation does not justify further investment.

The default decision after an inconclusive small sample is **HOLD**, not PROMOTE and not forced REJECT.

---

# 52. Core Research Question

The entire programme ultimately answers one question:

> **What new, trustworthy, legally usable, temporally available information can SabiScore acquire and transform into genuinely independent predictive signal, and what is the smallest rigorous experimental sequence capable of proving whether that information improves out-of-sample forecasting?**

The answer must be expressed as:

```text
Source
→ Coverage
→ Legal Status
→ Temporal Fidelity
→ Missingness
→ Entity Resolution
→ Independent Information
→ Representation
→ Baseline
→ Out-of-Sample Result
→ Confidence Interval
→ Statistical Decision
→ Production Decision
```

No step may be inferred from another.

---

# 53. Executive Principle

The programme is therefore governed by:

> **Do not build the feature until the information earns the feature.**
>
> **Do not build the model until the information earns the model.**
>
> **Do not build the infrastructure until the model earns production.**
>
> **Do not claim the result until the evidence earns the claim.**

SabiScore does not need more data for its own sake.

It needs **better information, better temporal truth, better calibration, better representations of genuinely missing state, and better evidence about whether any of those things actually improve forecasting.**

That is the standard for every subsequent data, modelling, and intelligence decision.