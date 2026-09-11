"""Guards for the E0 contamination gate and the E2 harvest checkpoint.

The contamination gate exists because the served v5_phase7 artifacts declare
`holdout_season: 2425` but score season 2526 with an in-sample signature
(RPS 0.147-0.171 against 0.216-0.234 on their one declared holdout). Fitting a
calibrator across that boundary reports a large, confident, entirely spurious
degradation. These tests pin the refusal.

No network, no database, no model artifacts.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import polars as pl
import pytest

_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from evaluate_e0_vector_scaling_multileague import (  # noqa: E402
    assess_temporal_integrity,
    evaluate_league,
    paired_block_bootstrap_ci,
)
from harvest_epl_e2_lineups import (  # noqa: E402
    HarvestState,
    _normalise_lineup,
    fixtures_to_harvest,
)

import numpy as np  # noqa: E402


def _frame(rows_per_season: dict[str, tuple[int, float]], declared: str) -> pl.DataFrame:
    """Build a prediction table whose per-season RPS is controlled.

    `conf` is the probability placed on the true class; higher conf => lower
    RPS, which is how an in-sample season looks.
    """
    rows = []
    for season, (n, conf) in rows_per_season.items():
        rest = (1.0 - conf) / 2.0
        for i in range(n):
            rows.append(
                {
                    "league": "EPL",
                    "season": season,
                    "declared_holdout_season": declared,
                    "prob_home": conf,
                    "prob_draw": rest,
                    "prob_away": rest,
                    "y": 0,
                }
            )
    return pl.DataFrame(rows)


class TestTemporalIntegrity:
    def test_a_season_scoring_far_better_than_the_holdout_is_flagged(self) -> None:
        df = _frame({"2425": (200, 0.45), "2526": (200, 0.95)}, declared="2425")
        result = assess_temporal_integrity(df, "EPL")
        assert result["seasons_with_in_sample_signature"] == ["2526"]
        assert result["per_season"]["2526"]["rps"] < result["per_season"]["2425"]["rps"]

    def test_the_declared_holdout_is_never_flagged_against_itself(self) -> None:
        df = _frame({"2425": (200, 0.45), "2526": (200, 0.95)}, declared="2425")
        assert "2425" in assess_temporal_integrity(df, "EPL")["seasons_usable_as_out_of_sample"]

    def test_comparable_seasons_are_not_flagged(self) -> None:
        """A season merely a little easier is not contamination."""
        df = _frame({"2425": (200, 0.45), "2526": (200, 0.46)}, declared="2425")
        assert assess_temporal_integrity(df, "EPL")["seasons_with_in_sample_signature"] == []


class TestEvaluationRefusesContaminatedSplits:
    def test_contaminated_test_season_blocks_before_fitting(self) -> None:
        df = _frame({"2425": (200, 0.45), "2526": (200, 0.95)}, declared="2425")
        result = evaluate_league(df, "EPL")
        assert result["status"] == "BLOCKED_CONTAMINATED_SPLIT"
        assert result["blocking_seasons"] == ["2526"]
        # The point of failing closed: no delta is reported at all.
        assert "delta_rps" not in result

    def test_a_clean_split_is_evaluated_rather_than_blocked(self) -> None:
        """The gate must not refuse everything — it has to let clean data through."""
        rng = np.random.default_rng(0)
        rows = []
        for season in ("2425", "2526"):
            for _ in range(300):
                p = rng.dirichlet([4.0, 3.0, 3.0])
                rows.append(
                    {
                        "league": "EPL", "season": season,
                        "declared_holdout_season": "2425",
                        "prob_home": float(p[0]), "prob_draw": float(p[1]),
                        "prob_away": float(p[2]), "y": int(rng.integers(0, 3)),
                    }
                )
        result = evaluate_league(pl.DataFrame(rows), "EPL")
        assert result["status"] == "EVALUATED"
        assert result["delta_rps"]["ci_lower"] is not None


class TestPairedBootstrap:
    def test_identical_arms_give_a_ci_straddling_zero(self) -> None:
        loss = np.linspace(0.1, 0.4, 300)
        ci = paired_block_bootstrap_ci(loss, loss.copy())
        assert ci["mean_delta"] == 0.0
        assert ci["ci_lower"] == 0.0 and ci["ci_upper"] == 0.0

    def test_a_uniformly_better_arm_gives_a_strictly_negative_ci(self) -> None:
        rng = np.random.default_rng(1)
        base = rng.uniform(0.1, 0.4, 400)
        ci = paired_block_bootstrap_ci(base, base - 0.05)
        assert ci["ci_upper"] < 0.0

    def test_too_few_samples_is_declared_not_silently_estimated(self) -> None:
        ci = paired_block_bootstrap_ci(np.zeros(5), np.ones(5))
        assert ci["ci_lower"] is None
        assert ci["note"] == "insufficient_samples_for_block_bootstrap"


class TestHarvestCheckpoint:
    def test_resume_skips_already_harvested_fixtures(self, tmp_path: Path) -> None:
        path = tmp_path / "harvest.jsonl"
        path.write_text(
            "\n".join(json.dumps({"fixture_id": i}) for i in (1, 2, 3)) + "\n",
            encoding="utf-8",
        )
        state = HarvestState.load(path)
        assert state.harvested == {1, 2, 3}
        assert fixtures_to_harvest(state, [1, 2, 3, 4, 5], batch=95) == [4, 5]

    def test_a_truncated_final_line_does_not_abort_the_resume(self, tmp_path: Path) -> None:
        """A process killed mid-write must not make the checkpoint unreadable."""
        path = tmp_path / "harvest.jsonl"
        path.write_text('{"fixture_id":1}\n{"fixture_id":2}\n{"fixture_i', encoding="utf-8")
        state = HarvestState.load(path)
        assert state.harvested == {1, 2}

    def test_batch_cap_is_respected(self, tmp_path: Path) -> None:
        state = HarvestState.load(tmp_path / "absent.jsonl")
        assert len(fixtures_to_harvest(state, list(range(500)), batch=95)) == 95


class TestHarvestNeverFabricatesLeadTime:
    @pytest.mark.parametrize("records", [[], [{"team_id": 33, "role": "starting", "player_id": 1}]])
    def test_announcement_fields_stay_null_and_cutoff_stays_unknown(self, records: list) -> None:
        row = _normalise_lineup(99, "2025-01-01T15:00:00Z", records)
        assert row["lineup_announced_utc"] is None
        assert row["lead_time_minutes"] is None
        assert row["servable_at_cutoff"] == "UNKNOWN"

    def test_confirmed_requires_two_complete_elevens(self) -> None:
        full = [
            {"team_id": t, "team_name": f"T{t}", "formation": "4-3-3",
             "role": "starting", "player_id": t * 100 + i}
            for t in (1, 2) for i in range(11)
        ]
        assert _normalise_lineup(1, None, full)["is_confirmed"] is True
        assert _normalise_lineup(1, None, full[:-1])["is_confirmed"] is False
