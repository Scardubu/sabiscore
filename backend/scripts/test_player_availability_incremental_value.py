"""Portfolio B Phase 4, Stage 3 — incremental forecasting test.

Directive: `docs/PRODUCTION_EXECUTIVE_DIRECTIVE.md` §16 Stage 3, §17-19. Stage
2 (`analyze_player_availability_dependence.py`) found a real, CI-excluding-
zero pooled correlation between `availability_diff` and match outcome
(r=-0.079, 95% CI [-0.106, -0.052], n=5,232), but heterogeneous across
leagues (3/5 significant and correctly signed, EPL directionally consistent
but not significant, LA_LIGA showing no effect). Stage 2 is diagnostic only
-- it says nothing about whether the signal survives once the market's own
information is already in the model (Rule 7: a source must add information
*beyond* the market, not merely correlate with an outcome the market already
prices).

This is the actual test: does `availability_diff` reduce out-of-sample RPS
when added to a market-only baseline, under a genuine temporal split, with a
paired block-bootstrap confidence interval on the difference -- not a point
estimate (Rule 9).

Method
------
* Baseline: multinomial logistic regression on de-vigged Bet365
  [P(home), P(draw), P(away)] alone. This is Rule 7's own bar -- if the
  candidate can't beat a model that already sees the market, it is not
  independent information.
* Candidate: same + `availability_diff`.
* Reference: the raw de-vigged market probabilities themselves, unmodeled --
  the more fundamental Rule 6 comparison.
* Split: train on seasons 2022+2023, test on 2024 -- the only genuine
  walk-forward split available with 3 seasons of corpus history (train
  strictly precedes test; no random shuffling, per §18).
* Scoring: mean RPS (`src.models.evaluation.metrics.ranked_probability_score`,
  reused rather than reimplemented) on the held-out 2024 season, pooled and
  per-league (heterogeneity already found in Stage 2 -- must not be hidden
  by pooling again).
* Significance: `block_bootstrap_ci` (same module) on the *paired*
  per-fixture RPS difference (candidate - baseline; negative means the
  candidate is better), non-overlapping block resampling for temporal
  dependence, 1000 replicates.

This is diagnostic evidence for a Phase 4 decision (PROMOTE / RESEARCH /
HOLD / REJECT, directive §51) -- it does NOT itself change the feature
schema, retrain a production artifact, or authorize serving. That would be
Phase 5+ and needs its own explicit authorization regardless of this
result.

Usage
-----
    cd backend
    PYTHONPATH=. python scripts/test_player_availability_incremental_value.py
"""
from __future__ import annotations

import asyncio
import glob
import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx  # noqa: E402
import numpy as np  # noqa: E402

from qualify_player_availability_coverage import (  # noqa: E402
    _LEAGUE_TO_DIVISION,
    _SEASONS,
    _CACHE_DIR,
    resolve_against_roster,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_ROOT))
from src.core.config import settings  # noqa: E402
from src.providers.api_football import APIFootballProvider  # noqa: E402
from src.models.evaluation.metrics import (  # noqa: E402
    ranked_probability_score,
    block_bootstrap_ci,
)

_REPORT_DIR = _BACKEND_ROOT.parent / "reports" / "research"
_OUTCOME_CODE = {"H": 0, "D": 1, "A": 2}  # matches ranked_probability_score's own convention
_TRAIN_SEASONS = (2022, 2023)
_TEST_SEASON = 2024


def devig(odds_home: float, odds_draw: float, odds_away: float) -> list[float]:
    """Normalize 1/odds implied probabilities to sum to 1 (remove overround)."""
    raw = np.array([1.0 / odds_home, 1.0 / odds_draw, 1.0 / odds_away])
    return (raw / raw.sum()).tolist()


def load_fixtures_with_odds(division: str, suffix: str) -> list[dict[str, Any]]:
    import pandas as pd

    paths = glob.glob(str(_CACHE_DIR / f"fd_{division}_{suffix}.csv"))
    if not paths:
        return []
    frame = pd.read_csv(paths[0], encoding="utf-8", on_bad_lines="skip")
    cols = {
        "home": "HomeTeam" if "HomeTeam" in frame.columns else "home_team",
        "away": "AwayTeam" if "AwayTeam" in frame.columns else "away_team",
        "date": "Date" if "Date" in frame.columns else "date",
        "result": "FTR" if "FTR" in frame.columns else "result",
        "oh": "B365H" if "B365H" in frame.columns else "bet365_home",
        "od": "B365D" if "B365D" in frame.columns else "bet365_draw",
        "oa": "B365A" if "B365A" in frame.columns else "bet365_away",
    }
    if any(c not in frame.columns for c in cols.values()):
        return []

    rows: list[dict[str, Any]] = []
    for _, row in frame.iterrows():
        parsed = pd.to_datetime(row[cols["date"]], errors="coerce", dayfirst=False)
        result = str(row[cols["result"]]).strip().upper()
        try:
            oh, od, oa = float(row[cols["oh"]]), float(row[cols["od"]]), float(row[cols["oa"]])
        except (TypeError, ValueError):
            continue
        if pd.isna(parsed) or result not in _OUTCOME_CODE or min(oh, od, oa) <= 1.0:
            continue
        rows.append(
            {
                "home_team": str(row[cols["home"]]).strip(),
                "away_team": str(row[cols["away"]]).strip(),
                "date": parsed.date(),
                "result": result,
                "market_probs": devig(oh, od, oa),
            }
        )
    return rows


async def collect_unavailable_counts(
    provider: APIFootballProvider, league: str, roster: set[str], season: int
) -> dict[tuple[str, date], set[Any]]:
    counts: dict[tuple[str, date], set[Any]] = {}
    result = await provider.injuries(competition=league, season=season)
    if result.status.name != "VERIFIED":
        return counts
    for record in result.records:
        if not record.get("coherent"):
            continue
        resolved = resolve_against_roster(record.get("team_name", ""), league, roster)
        if resolved is None:
            continue
        fixture_date_raw = record.get("fixture_date")
        if not fixture_date_raw:
            continue
        try:
            record_date = datetime.fromisoformat(str(fixture_date_raw)).date()
        except ValueError:
            continue
        player_id = record.get("player_id") or record.get("player_name")
        counts.setdefault((resolved, record_date), set()).add(player_id)
    return counts


def _fit_multinomial_logistic(X: np.ndarray, y: np.ndarray):
    from sklearn.linear_model import LogisticRegression

    # `multi_class` was removed in this sklearn version -- the default
    # ('lbfgs' solver, 3+ classes) already fits genuine multinomial (softmax)
    # probabilities without it; passing the old kwarg raises TypeError here.
    model = LogisticRegression(max_iter=2000)
    model.fit(X, y)
    return model


def _mean_rps(y_true: np.ndarray, y_proba: np.ndarray) -> float:
    return float(
        np.mean([ranked_probability_score(int(yt), list(yp)) for yt, yp in zip(y_true, y_proba)])
    )


def _paired_rps_diff_bootstrap(
    y_true: np.ndarray, proba_candidate: np.ndarray, proba_baseline: np.ndarray
) -> dict[str, Any]:
    """Block-bootstrap CI on the per-fixture RPS difference (candidate - baseline)."""
    per_fixture_diff = np.array(
        [
            ranked_probability_score(int(yt), list(pc)) - ranked_probability_score(int(yt), list(pb))
            for yt, pc, pb in zip(y_true, proba_candidate, proba_baseline)
        ]
    )
    # block_bootstrap_ci expects (y_true, y_proba, metric_fn); repurpose it to
    # bootstrap a plain 1-D series by passing the diffs as "y_proba" rows of
    # width 1 and a metric_fn that just takes the mean -- reuses the existing,
    # already-tested block-resampling machinery (including its own
    # point_estimate, computed the same way) rather than reimplementing it.
    dummy_y_true = np.zeros(len(per_fixture_diff), dtype=int)

    def _mean_metric(_yt: np.ndarray, diffs: np.ndarray) -> float:
        return float(np.mean(diffs))

    return block_bootstrap_ci(
        dummy_y_true, per_fixture_diff.reshape(-1, 1), _mean_metric, block_size=10
    )


async def build_dataset() -> list[dict[str, Any]]:
    joined: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        provider = APIFootballProvider(
            api_key=settings.api_football_key, enabled=True, live_tests=True, http_client=client
        )
        for league, division in _LEAGUE_TO_DIVISION.items():
            for season, suffix in _SEASONS.items():
                fixtures = load_fixtures_with_odds(division, suffix)
                if not fixtures:
                    continue
                roster = {f["home_team"] for f in fixtures} | {f["away_team"] for f in fixtures}
                counts = await collect_unavailable_counts(provider, league, roster, season)
                await asyncio.sleep(1.0)

                for fx in fixtures:
                    home_n = len(counts.get((fx["home_team"], fx["date"]), set()))
                    away_n = len(counts.get((fx["away_team"], fx["date"]), set()))
                    joined.append(
                        {
                            "league": league,
                            "season": season,
                            "home_team": fx["home_team"],
                            "away_team": fx["away_team"],
                            "date": str(fx["date"]),
                            "market_probs": fx["market_probs"],
                            "availability_diff": home_n - away_n,
                            "outcome": _OUTCOME_CODE[fx["result"]],
                        }
                    )
                print(f"{league:<12} {season}  fixtures={len(fixtures):>4}")
    return joined


def evaluate(joined: list[dict[str, Any]]) -> dict[str, Any]:
    train = [r for r in joined if r["season"] in _TRAIN_SEASONS]
    test = [r for r in joined if r["season"] == _TEST_SEASON]
    if len(train) < 50 or len(test) < 50:
        return {"error": "insufficient_train_or_test_rows", "train_n": len(train), "test_n": len(test)}

    X_train_baseline = np.array([r["market_probs"] for r in train])
    X_train_candidate = np.array(
        [r["market_probs"] + [r["availability_diff"]] for r in train]
    )
    y_train = np.array([r["outcome"] for r in train])

    baseline_model = _fit_multinomial_logistic(X_train_baseline, y_train)
    candidate_model = _fit_multinomial_logistic(X_train_candidate, y_train)

    def _score_slice(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
        if len(rows) < 30:
            return None
        X_baseline = np.array([r["market_probs"] for r in rows])
        X_candidate = np.array([r["market_probs"] + [r["availability_diff"]] for r in rows])
        y_true = np.array([r["outcome"] for r in rows])
        raw_market = X_baseline  # unmodeled de-vigged probabilities themselves

        # Align each model's own class ordering to [home, draw, away] --
        # LogisticRegression's classes_ is sorted ascending, which already
        # matches 0/1/2, but asserted rather than assumed.
        assert list(baseline_model.classes_) == [0, 1, 2]
        assert list(candidate_model.classes_) == [0, 1, 2]

        proba_baseline = baseline_model.predict_proba(X_baseline)
        proba_candidate = candidate_model.predict_proba(X_candidate)

        return {
            "n": len(rows),
            "rps_raw_market": round(_mean_rps(y_true, raw_market), 5),
            "rps_baseline_model": round(_mean_rps(y_true, proba_baseline), 5),
            "rps_candidate_model": round(_mean_rps(y_true, proba_candidate), 5),
            "candidate_minus_baseline_bootstrap": _paired_rps_diff_bootstrap(
                y_true, proba_candidate, proba_baseline
            ),
        }

    result: dict[str, Any] = {
        "train_seasons": list(_TRAIN_SEASONS),
        "test_season": _TEST_SEASON,
        "train_n": len(train),
        "test_n": len(test),
        "pooled": _score_slice(test),
        "per_league": {},
    }
    for league in _LEAGUE_TO_DIVISION:
        league_test = [r for r in test if r["league"] == league]
        scored = _score_slice(league_test)
        result["per_league"][league] = scored if scored is not None else {"n": len(league_test), "note": "insufficient_test_sample"}
    return result


async def main() -> int:
    raw_out = _REPORT_DIR / "portfolio-b-stage3-dataset.json"

    # Re-use an already-fetched dataset when present -- the evaluation step
    # below is local/no-network; re-fetching to debug it would spend live
    # api_football quota (100/day free tier) for identical data.
    if "--refetch" not in sys.argv and raw_out.exists():
        print(f"Loading cached dataset from {raw_out} (pass --refetch to re-query live).")
        joined = json.loads(raw_out.read_text())
    else:
        if not settings.api_football_key:
            print("No api_football credential configured — nothing to test.")
            return 1
        joined = await build_dataset()
        raw_out.write_text(json.dumps(joined, indent=2, default=str))

    result = evaluate(joined)
    result["not_a_promotion"] = (
        "This is Stage 3 evidence for a directive §51 decision (PROMOTE/RESEARCH/"
        "HOLD/REJECT). It does not itself change the feature schema, retrain a "
        "production artifact, or authorize serving."
    )

    out = _REPORT_DIR / "portfolio-b-stage3-incremental-value-report.json"
    out.write_text(json.dumps(result, indent=2, default=str))

    print("\n" + "=" * 70)
    print(json.dumps(result, indent=2, default=str))
    print("=" * 70)
    print(f"\nReport written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
