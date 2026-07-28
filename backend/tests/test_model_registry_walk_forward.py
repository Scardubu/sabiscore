"""Regression guard for the walk-forward RPS validation call path.

model_registry.walk_forward_validate() used to pass a one-hot list to
ranked_probability_score(), which expects a plain int outcome. That raised a
TypeError on every scored record, silently swallowed by a bare except, so the
function always returned {"skipped": True, "reason": "no_valid_folds"} no
matter how much data was supplied. These tests pin the fixed call convention.
"""
from __future__ import annotations

import os

os.environ["ALLOW_SQLITE_FALLBACK"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_ENABLED"] = "false"

from src.models.evaluation.metrics import ranked_probability_score
from src.models.model_registry import ModelRegistry


def test_ranked_probability_score_perfect_prediction_is_zero() -> None:
    assert ranked_probability_score(0, [1.0, 0.0, 0.0]) == 0.0


def test_ranked_probability_score_worst_prediction_is_one() -> None:
    assert ranked_probability_score(2, [1.0, 0.0, 0.0]) == 1.0


def _synthetic_records(n: int = 20) -> list[dict]:
    outcomes = [0, 1, 2]
    return [
        {
            "date": f"2026-01-{(i % 28) + 1:02d}",
            "outcome": outcomes[i % 3],
            "probs": [0.5, 0.3, 0.2],
        }
        for i in range(n)
    ]


def test_walk_forward_validate_skips_when_too_few_records(tmp_path) -> None:
    registry = ModelRegistry(registry_path=str(tmp_path))
    result = registry.walk_forward_validate(_synthetic_records(4), n_splits=5)
    assert result["skipped"] is True


def test_walk_forward_validate_produces_folds_for_real_data(tmp_path) -> None:
    """Regression guard: this must not fall back to no_valid_folds/skipped."""
    registry = ModelRegistry(registry_path=str(tmp_path))
    result = registry.walk_forward_validate(_synthetic_records(20), n_splits=5)

    assert result["skipped"] is False
    assert result["n_splits"] == 5
    assert len(result["folds"]) == 5
    assert 0.0 <= result["rps_overall"] <= 1.0
    for fold in result["folds"]:
        assert 0.0 <= fold["rps_mean"] <= 1.0


def test_walk_forward_validate_skips_invalid_records_without_changing_shape(tmp_path) -> None:
    records = _synthetic_records(20)
    records[4]["outcome"] = 3
    records[7]["outcome"] = "invalid"
    records[10]["probs"] = [0.8, 0.8, -0.6]
    records[13]["probs"] = [float("nan"), 0.5, 0.5]

    registry = ModelRegistry(registry_path=str(tmp_path))
    result = registry.walk_forward_validate(records, n_splits=5)

    assert set(result) == {
        "skipped",
        "n_splits",
        "total_records",
        "rps_overall",
        "rps_std",
        "folds",
        "validated_at",
    }
    assert result["skipped"] is False
    assert result["total_records"] == 20
    assert all(fold["test_size"] <= 3 for fold in result["folds"])


def test_walk_forward_validate_reports_no_valid_folds_for_invalid_records(tmp_path) -> None:
    records = _synthetic_records(20)
    for record in records:
        record["probs"] = [0.6, 0.6, -0.2]

    registry = ModelRegistry(registry_path=str(tmp_path))

    assert registry.walk_forward_validate(records, n_splits=5) == {
        "skipped": True,
        "reason": "no_valid_folds",
    }
