# SabiScore Debt Ledger

Format per entry: **Tier** (`FIX-NOW` / `NEXT` — named trigger / `ARCH-DEBT` — needs an
ADR / `ACCEPTED` — rationale + review date), owner, blast radius, engineering cost,
user impact, priority. An entry without a trigger is not `NEXT`, it's `ACCEPTED` in
disguise — say so honestly.

---

## 1. Base-58 feature block is silently defaulted on every live prediction

**Tier:** `NEXT` — trigger: operator go/no-go on the remap below (R4/INV-14 — approval
required, not autonomous).
**Owner:** unassigned.
**Found:** 2026-08-04, verifying the WP-0/WP-1/WP-2 identity + gap-detection campaign.
**Updated:** 2026-08-05 — WP-10.1 shipped (caller wired), WP-10.2 semantics pinned
(evidence below). WP-10.3 (the actual remap) is still **not done** — see below.

`_get_team_stats()` (`backend/src/services/upcoming_match_feature_service.py:705-805`)
computes ~12 stats (`home_form_5`, `home_win_rate_5`, `home_goals_per_match_5`, …) that
share no name with any `CANONICAL_FEATURES_58` entry
(`backend/src/models/feature_registry.py:6-65` — e.g. the canonical name is
`home_form_last5_home`). The WP-2 gap-detection fix already flags this honestly as an
advisory gap rather than fabricating a value (`data_gaps` computed via
`_CALLER_RESOLVED_FEATURES` set-membership, not a value check) — this is **not** a
zero-fabrication violation. It is a prediction-*quality* gap: the model receives real
signal for at most ~28 of 86 features (Elo/StatsBomb/Phase8 block) on every request.

**Second, independent bug in the same function**: `_get_team_stats()` hardcodes the
`"home_"` prefix on every key it returns, regardless of which team it's called for —
`project_match_features()` calls it once for the home team and once for the away team
with identical output-key shapes (`upcoming_match_feature_service.py:140-141`), so
`away_stats` silently overwrites `home_stats` under the same dict keys before
`features_dict.update(...)`. Currently inert (neither key is canonical, so the
collision has no live effect), but a real remap must add an `is_home`/prefix parameter
or it will trade "honestly defaulted" for "silently swapped between home and away."

**WP-10.1 shipped (2026-08-05):** `ScrapedTeamFormStore` (D12 — was a zero-caller class)
now has a real caller: `UpcomingMatchFeatureProjector._apply_scraped_fallback()`
consults it only when `_get_team_stats()` returns `None` (zero DB history for that
side), and only tags the result via `data_quality["scraped_fallback"]` — never folded
into `is_synthetic` (the zero-fab publish gate in
`upcoming_match_service.py:265`, `publishable = not is_fallback and not is_synthetic`;
flipping it on a fallback whose keys are still non-canonical would have re-opened
exactly the vΩ.32 fabrication class this campaign already closed once). Still fully
inert on the canonical feature vector, deliberately — that's WP-10.3, below. Tests:
`backend/tests/test_feature_gap_detection.py`
(`test_scraped_fallback_used_when_db_has_no_history_but_stays_inert`,
`test_scraped_fallback_absent_leaves_prior_behaviour_unchanged`).

**WP-10.2 semantics pinned (2026-08-05, no assumption):** the canonical remap this item
needs is not undiscovered — it already exists, live, in a *sibling* pipeline.
`backend/src/data/transformers.py`'s `FeatureTransformer.engineer_features()`
(lines 328–339) computes the exact canonical names from the *exact same* non-canonical
keys `_get_team_stats()`/`ScrapedTeamFormStore.to_projection_stats()` both already
produce:

```text
home_form_last5_home   = home_form_5 * 3.0                      # → points/game over last 5, 0–3 scale
away_form_last5_away   = away_form_5 * 3.0
home_wins_last5_home   = round(home_win_rate_5 * 5.0)            # win RATE → win COUNT (0–5)
away_wins_last5_away   = round(away_win_rate_5 * 5.0)
home_draws_last5_home  = max(0, 5 - wins - 2)                    # ⚠ algebraic estimate, NOT a
away_draws_last5_away  = max(0, 5 - wins - 2)                    #   real draw count — assumes a
home_losses_last5_home = max(0, 5 - wins - draws)                #   fixed "2 losses" baseline
away_losses_last5_away = max(0, 5 - wins - draws)
home_goals_for_avg     = home_goals_per_match_5   (direct passthrough)
away_goals_for_avg     = away_goals_per_match_5
home_goals_against_avg = home_goals_conceded_per_match_5
away_goals_against_avg = away_goals_conceded_per_match_5
```

This is confirmed as the *training-time* semantics, not a guess: `models/training.py`
and `models/enhanced_training.py` both import `FeatureTransformer` from this exact
module, and `backend/models/training_report.json` → `data.feature_names[0:5]` starts
`["home_form_last5_home", "home_wins_last5_home", "home_draws_last5_home",
"home_losses_last5_home", "away_form_last5_away", …]` — the real trained artifact's own
feature order. **The draws/losses estimate is itself a latent precision loss**:
`ScrapedTeamFormStore`'s `ScrapedTeamForm` already carries real `wins`/`draws`/`losses`
integers from the scraped CSV (`to_projection_stats()` currently discards them down to
the same lossy `home_`-prefixed shape as `_get_team_stats()`, matching its bug
intentionally) — a real remap has a strictly-better option than reproducing
`transformers.py`'s algebraic estimate when the scraped source is what's in play.

**Why WP-10.3 (wiring this remap into `upcoming_match_feature_service.py`) is still not
done:** it is explicitly R4 under INV-14 ("remapping `_get_team_stats()` output onto
canonical feature names is a feature-schema change... even though no new feature is
added — the meaning bound to each name changes") — proposal-only, approval required,
never execute-then-ask. Confidence the semantics above are correct is now high (cited to
the live training artifact, not assumed), but R4 gates on *evidence quality*, not
*confidence* — the operator must still sign off, because it changes what every live
model actually sees and requires the D8b prefix fix to land atomically (see above) plus
a `feature_defaulted_ratio` before/after capture per the campaign's own GATE-10 §3.

**Blast radius:** every live prediction, matchup and DB-fixture paths alike (unchanged
until WP-10.3 ships).
**Cost:** now low for WP-10.3 itself — the semantics research (the expensive, blind-risk
part) is done. Remaining cost is the approval round-trip + the D8b atomic fix + the
re-certification/`feature_defaulted_ratio` proof GATE-10 requires.
**Impact:** predictions are directionally usable but running on a small fraction of
trained signal — unchanged by WP-10.1 alone, as designed.
**Priority:** high value; ready for a go/no-go decision, no longer blocked on research.

---

## 2. Settlement-join infrastructure built and tested, wired to nothing that runs

**Tier:** `NEXT` — trigger: before trusting any walk-forward accuracy/RPS number, and
before the campaign's own Phase-1 exit gate ("one settled prediction") can close.
**Owner:** unassigned.

`get_settled_predictions()` (`backend/src/repositories/fixtures.py:113-206`) and
`walk_forward_validate()` (`backend/src/models/model_registry.py:311`) are both correct
and unit-tested (`backend/tests/test_settled_predictions_join.py`,
`test_model_registry_walk_forward.py`) but have **zero production callers** — grepped,
confirmed. Nothing in the live process transitions `Match.status` to `"finished"` with
real scores: the only code that does
(`DataIngestionService._update_match_score`, `backend/src/services/data_ingestion.py`)
is reachable only via a standalone CLI (`cli/start_ingestion.py`) or via
`ProductionOrchestrator.start()`, which itself has zero callers anywhere in the
codebase.

**Blast radius:** `/model-performance` and any accuracy/RPS surface — currently stubs
honestly (`503 bet_history_aggregation_not_yet_integrated`) rather than lying, per
earlier session notes; this entry just consolidates why.
**Cost:** needs a decision on where a periodic job can run on a single free-tier Render
dyno (no separate worker/cron service exists today) before it's worth wiring the join.
**Impact:** no real accuracy telemetry exists yet even though the season is about to
generate settleable matches (Eredivisie opens 2026-08-07, EPL 2026-08-21 — see
`backend/src/core/season_calendar.py` for the provider-verified table).
**Priority:** high — this is the literal Phase-1→Phase-2 gate.

---

## 3. OTel telemetry entirely unregistered; fixture-sync failures are invisible

**Tier:** `ARCH-DEBT` — needs an ADR (exporter target, sampling policy, cost on a
free-tier dyno) before implementation, not just a code drop.
**Owner:** unassigned.

No `TracerProvider`, `FastAPIInstrumentor.instrument_app()`, or OTLP exporter exists
anywhere in the tree (repo-wide grep, zero hits) despite
`opentelemetry-instrumentation-fastapi`/`opentelemetry-sdk` being in
`backend/requirements.txt`. The tracer/meter handles obtained in
`models/prediction.py:54-55` and `monitoring/drift.py:21` are therefore always the
no-op default. Separately: `_background_fixture_sync`
(`backend/src/api/main.py:132`) and `run_fixture_sync()`
(`backend/src/services/fixture_sync_service.py:110-123`) both wrap their entire body in
`try/except Exception: logger.exception(...)` — a total sync failure is visible only by
tailing logs, no metric or alert fires.

**Blast radius:** every request (no tracing); fixture ingestion (no failure signal).
**Cost:** moderate for the FastAPI instrumentation itself; the fixture-sync-failure
signal is small in isolation (one counter/metric) but is currently the closest thing to
a fix for this specific blind spot and could ship independently of full OTel.
**Impact:** an ingestion outage would currently be silent until someone notices empty
fixtures.
**Priority:** medium — real risk, but lower urgency than items 1–2 given the season
opener is days away and this doesn't block correctness, only observability.

---

## 4. Duplicate season-string writer

**Tier:** `FIX-NOW` — trivial, ~1 line, no behavior change today.
**Owner:** unassigned.

`backend/src/data/loaders/football_data.py:315` builds
`season=f"20{season[:2]}/20{season[2:]}"` independently instead of calling the
`canonical_season()` helper added 2026-08-04
(`backend/src/utils/season.py`) that `fixture_sync_service.py` and
`upcoming_match_feature_service.py` both already use. Produces the identical
`"YYYY/YYYY"` output today — this is not a live bug — but it is exactly the
un-unified-duplicate shape that caused the original season-namespace defect (two
writers silently drifting apart). Swap the call site next time this file is touched.

**Blast radius:** none today.
**Cost:** trivial.
**Impact:** none today; latent drift risk.
**Priority:** low, but cheap enough to fold into any unrelated touch of this file.
