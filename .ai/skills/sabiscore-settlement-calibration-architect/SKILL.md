---
name: sabiscore-settlement-calibration-architect
description: >
  Wires SabiScore's built-but-uncalled prediction-accuracy subsystems into
  production: get_settled_predictions(), walk_forward_validate(),
  ScrapedTeamFormStore, and monitoring/drift.py (Benjamini-Hochberg FDR via
  Evidently). Enforces built ≠ wired ≠ called ≠ running — every status claim
  needs fresh grep/read evidence against HEAD, never changelogs or prior
  prompts. Governs the promotion ladder (UNVERIFIED → OFFLINE_VALIDATED →
  SHADOW → FORECAST_ONLY → ACTIONABLE_CERTIFIED) and the Phase-2 gate: no
  intelligence-depth work until one prediction settles against a real result.
  Enforces Brier score calibration, walk-forward backtesting,
  zero-fabrication on accuracy claims. Triggers: "wire up settlement",
  "walk_forward_validate", "get_settled_predictions", "ScrapedTeamFormStore",
  "drift detection", "monitoring/drift.py", "Brier score", "calibration",
  "backtest", "prediction accuracy", "Phase 2 gate", "promotion ladder",
  "built but uncalled", "FDR correction", "Evidently drift".
argument-hint: "[target: settlement | walk_forward | scraped_team_form | drift_monitoring | promotion_ladder | all]"
allowed-tools: Read, Grep, Bash(grep -n:*), Bash(python -m pytest:*)
user-invocable: true
---

# SabiScore Settlement & Calibration Architect

## Purpose

SabiScore's core promise — a probability for every fixture, checked against
what actually happened — has repeatedly been blocked not by missing code but
by **built code nobody calls**. This skill closes that specific gap class:
subsystems that are engineered, tested, and dead. It does not design new ML
methodology from scratch; it wires what exists into the production path and
holds the wiring to the same evidence standard the rest of SabiScore uses.

Use this skill whenever the task is "make a prediction accuracy subsystem
actually run in production" rather than "invent a new one."

## Non-negotiable: evidence discipline

Before making any claim about a subsystem's status, run the check — don't
recall it from a prior session, a docstring, or a CHANGELOG entry claiming a
work package shipped.

| Claim | Required evidence |
|---|---|
| "X is built" | `grep -n "def X"` / file exists, has a test file |
| "X is wired" | `grep -rn "X(" --include=*.py` finds a call site outside its own module/tests |
| "X is called in production" | The call site is reachable from a scheduled job, API route, or startup hook — not just a script under `scripts/` or a notebook |
| "X is running" | Logs, a DB row, or a metric shows it executed against real data, not synthetic fixtures |

Four different words, four different evidence bars. Collapsing them (e.g.
treating "has a test" as "is running") is the exact failure mode that let
three subsystems ship engineered-but-inert. State which bar a claim clears
every time you make one.

Never trust a persona brief, advisory doc, or prior prompt version's
description of the stack over `grep` against current HEAD. If they conflict,
HEAD wins, and the conflict gets recorded (see Adjudications below) rather
than silently resolved.

## Subsystem inventory (verify before trusting)

As of the last verified audit, these carried zero production callers. **Re-run
the grep before treating any line below as still true** — the whole point of
this skill is closing these gaps, so a stale "still uncalled" claim is exactly
the mistake it exists to prevent.

- `get_settled_predictions()` — reconciles predictions against real results.
  Built, tested, no caller.
- `walk_forward_validate()` — out-of-sample backtest over time-ordered splits.
  Built, tested, no caller.
- `ScrapedTeamFormStore` — bridges scraped match/form artifacts into model
  features. Built, tested-shaped, no caller anywhere in the repo.
- `monitoring/drift.py` — Benjamini-Hochberg FDR correction via Evidently.
  Built, materially more capable than what most prompts scope it as, unwired.

**Naming hazard:** "drift" refers to at least three distinct quantities across
this codebase (feature drift, prediction drift, and calibration drift are
common candidates — confirm the actual set via grep, do not assume). Before
touching any drift-related code, `grep -rn "drift" --include=*.py -i` and
partition the hits by which quantity each one means. Do not write code that
conflates them.

## Promotion ladder + Phase-2 gate

```
UNVERIFIED → OFFLINE_VALIDATED → SHADOW → FORECAST_ONLY → ACTIONABLE_CERTIFIED
```

A prediction (or the pipeline producing it) only advances a rung when the
evidence for the *previous* rung is checkable, not asserted. `SHADOW` requires
logged predictions with no stake; `FORECAST_ONLY` requires calibration
metrics computed against settled outcomes; `ACTIONABLE_CERTIFIED` requires
both calibration and a live settlement loop.

**Hard gate:** Phase-2 intelligence-depth work (ensemble tuning, new feature
sources, model architecture changes) does not proceed until at least one
prediction has settled against a real result end-to-end. If asked to do
Phase-2 work, check this gate first. If it hasn't been cleared, say so and
redirect to closing the settlement loop instead of starting new modeling work
— this is a recurring temptation to short-circuit and it should be refused
the same way each time, not re-litigated per request.

## Workflow: closing a built-but-uncalled gap

1. **Locate.** `grep -n "def <subsystem>"` to find the definition; `grep -rn
   "<subsystem>("` to find (the absence of) call sites.
2. **Read the test file**, if one exists, to understand the intended contract
   (inputs, outputs, side effects) before wiring — do not infer the contract
   from the function name.
3. **Identify the correct call site.** This is almost always one of: a
   scheduled job (cron/worker), a post-fixture-result webhook or poller, or a
   startup/lifespan hook. It is almost never a one-off script — a script
   callsite satisfies "called" but not "called in production," and shipping
   that as the fix reintroduces the same defect class under a different name.
4. **Wire it**, preserving the dual-engine rule and Alembic-only schema
   discipline from the rest of the platform (do not bypass either to make
   wiring easier).
5. **Verify it ran against real data**, not a fixture/mock, before claiming
   the gap closed. A passing unit test does not clear this bar.
6. **Update the promotion ladder status** for the affected prediction path
   only as far as the evidence actually supports.

## Calibration specifics

- **Brier score** is the calibration metric of record. Report it per-league
  and pooled — a pooled score can hide a badly miscalibrated league.
- **Walk-forward validation**, not k-fold — fixtures are time-ordered and
  k-fold leaks future information into past predictions. If you find k-fold
  anywhere in the accuracy pipeline, flag it as a defect, don't preserve it.
- Do not report or accept an accuracy/hit-rate percentage that isn't derived
  from `get_settled_predictions()` output. Numbers from advisory docs,
  third-party benchmarks, or "typical for this market" framing are
  inadmissible — this mirrors the standing rejection of unsourced accuracy
  claims (e.g. an unverified "68–75%" figure) from prior sessions.

## Zero-fabrication constraint

This skill inherits SabiScore's zero-fabrication invariant at full strength.
Concretely, for this domain:
- Never invent a Brier score, calibration curve, or settlement count.
- Never claim a subsystem is "production-ready" from reading its code alone
  — production-ready requires the running-against-real-data evidence bar.
- If the evidence needed to answer a question isn't available in-session
  (no repo access, no logs), say that plainly instead of estimating.

## Output contract

A response from this skill should state, per subsystem touched: (a) which
evidence bar it cleared before and after the change, (b) the exact call site
added or the exact reason none was added yet, (c) whether the Phase-2 gate
status changed as a result, and (d) any drift-namespace ambiguity encountered
and how it was resolved. Skip subsystems not in scope for the request rather
than padding the response with unrelated status.
