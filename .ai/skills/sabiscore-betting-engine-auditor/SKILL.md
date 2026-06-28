---
name: sabiscore-betting-engine-auditor
description: >
  Audits and surgically patches the SabiScore betting engine — both
  betting_intelligence.py and core_engine.py must always be treated as a pair.
  Enforces the dual-engine rule, critical_gaps PARTIAL gate, watchlist separation,
  UCL cap, Kelly/EV formulas, and the evaluation_at determinism contract.
  Triggers: "audit betting engine", "fix verdict logic", "SPECULATIVE watchlist",
  "UCL HIGH_CONVICTION", "critical_gaps PARTIAL", "Kelly formula", "EV formula",
  "betting_intelligence.py", "core_engine.py", "verdict gate", "PARTIAL gate",
  "dual engine", "both engines", "watchlist separation", "edge threshold".
argument-hint: "[target: betting_intelligence | core_engine | both | specific invariant]"
allowed-tools: Read, Grep, Bash(grep -n:*), Bash(python -m pytest:*)
user-invocable: true
---

# SabiScore Betting Engine Auditor

The betting engine has **two independent implementations** of the same verdict,
ranking, and Kelly logic — `betting_intelligence.py` and `core_engine.py`. They
share no code. A bug introduced in one is not automatically in the other, and a
fix applied to one is not automatically complete.

This skill enforces the rule: **any change to verdict gates, ranking, Kelly sizing,
or watchlist logic MUST be applied to BOTH files before the patch is complete.**

---

## STEP 1 — Locate Both Engine Files

```bash
grep -rn "VerdictEnum\|HIGH_CONVICTION\|watchlist\|_apply_verdict" \
  backend/src/services/betting_intelligence.py \
  backend/src/services/core_engine.py \
  | grep -n "def \|watchlist\|PARTIAL\|critical" | head -40
```

Confirm both files exist and have verdict gate logic before proceeding.

---

## STEP 2 — Audit All Invariants (Both Files)

Run through this checklist against each file independently. Never assume they are
in sync.

### Mathematical Invariants (non-negotiable formulas)

```python
raw_implied_i   = 1 / odds_i
overround       = sum(raw_implied)
fair_market_i   = raw_implied_i / overround
edge_i          = model_probability_i - fair_market_i
expected_value_i = model_probability_i * odds_i - 1
full_kelly_i    = max(0, expected_value_i / (odds_i - 1))
stake_i         = min(full_kelly_i * KELLY_FRACTION, MAX_KELLY_CAP)
```

Constants must match:
```python
MIN_ACTIONABLE_EDGE = 0.042
KELLY_FRACTION      = 0.125
MAX_KELLY_CAP       = 0.025
SPECULATIVE_CAP     = 0.0025
```

### Verdict Invariants

```
☐ Gate 1 PARTIAL: only critical_gaps trigger PARTIAL
     NOT: the flat data_gaps list (which includes CONFLICTING entries)
     CORRECT: _extract_critical_gaps(gaps) passed as critical_gaps parameter

☐ Gate 2 NO_BET: best_ev <= 0 OR best_edge <= 0 OR best_stake_fraction <= 0

☐ Gate 4 SPECULATIVE: best_edge < MIN_ACTIONABLE_EDGE (4.2pp)

☐ Gate 6 HIGH_CONVICTION: UCL cap enforced
     UCL fixtures → ACTIONABLE (never HIGH_CONVICTION until UCL model certified)

☐ SPECULATIVE: watchlist=True, execution_eligible=False, stake="pass"
     Must NOT appear in top_opportunities[]
     Must appear in batch_watchlist[] (BatchAnalysisResponse)

☐ PARTIAL / NO_BET / HOLD: stake="pass" (all three)

☐ evaluation_at: injected from endpoint/request, never datetime.now() inside pure verdict logic

☐ All three outcomes evaluated: HOME_ML, DRAW_ML, AWAY_ML
     Ranked by confidence_adjusted_value descending (not raw model probability)
```

### Watchlist Separation (critical — fixed 2026-06-28)

In `BatchAnalysisResponse` / the analyze-batch endpoint:
```python
# CORRECT (both engines post-fix)
top_opportunities: List[str]   # ACTIONABLE + HIGH_CONVICTION only
batch_watchlist:   List[str]   # SPECULATIVE only

# WRONG (pre-fix — leaked SPECULATIVE into top_opportunities)
top_opportunities: List[str]   # incorrectly included SPECULATIVE
```

Verify with:
```bash
grep -n "watchlist\|SPECULATIVE\|top_opportunities" \
  backend/src/services/betting_intelligence.py \
  backend/src/services/core_engine.py
```

---

## STEP 3 — ProviderStatus Naming: Use Actual Enum Values

The production brief documents preferred names. The actual `ProviderStatus` enum in
`backend/src/providers/base.py` uses different strings. Always match against the
**actual enum**, not the documented ideals:

| Preferred (docs) | Actual code | Notes |
|---|---|---|
| `DISABLED` | (absent) | Disabled → `UNAVAILABLE` + `provider_disabled` warning |
| `DEGRADED` | `PARTIAL` | ProviderStatus.PARTIAL |
| `SCHEMA_INVALID` | `INVALID` | ProviderStatus.INVALID |

When writing code that matches against provider status, check `base.py` first.

---

## STEP 4 — Run Engine Tests (Both)

```bash
cd backend

# betting_intelligence tests
python -m pytest tests/test_betting_intelligence_engine.py -q --no-cov -v

# core_engine tests
python -m pytest tests/test_core_engine.py -q --no-cov -v

# If advisory_gaps gate test exists:
python -m pytest tests/ -k "advisory_gap or critical_gap or watchlist" -q --no-cov
```

---

## STEP 5 — Patch Protocol

When fixing any invariant:

1. Read BOTH files before writing any patch.
2. Apply the same conceptual fix to both (adapting to each file's function names).
3. Update tests in BOTH corresponding test files.
4. Never assume fixing one file is complete.

```bash
# Pattern for confirming both files changed
git diff --name-only | grep -E "betting_intelligence|core_engine"
# Should show BOTH files if verdict/Kelly/watchlist logic was touched
```

## Quality Gate

Before closing any betting engine PR:

- [ ] Formulas verified against the mathematical invariants above (both files)
- [ ] SPECULATIVE → batch_watchlist only, absent from top_opportunities (both files)
- [ ] UCL cap present (both files)
- [ ] critical_gaps passed to Gate 1, NOT flat data_gaps (both files)
- [ ] evaluation_at from request, never datetime.now() in pure logic (both files)
- [ ] All three outcomes evaluated (both files)
- [ ] Tests pass for both betting_intelligence and core_engine test suites
- [ ] Advisory-only gap does NOT trigger PARTIAL (test exists in at least one suite)

## Pairs With

- `backend-systems-auditor` — production audit before any engine change
- `backend-domain-model-architect` — domain model contract for verdicts/Kelly
- `testing-strategy-architect` — test coverage for engine invariants
- `opentelemetry-observability-architect` — verdict distribution metrics

## Vertical Notes

**SabiScore only** — this skill is exclusively for `betting_intelligence.py` and
`core_engine.py`. Do not use for TaxBridge/SwarmX/Hashablanca.
