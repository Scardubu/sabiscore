"""Unit tests for src/features/form.py — EWMA form features."""

from __future__ import annotations

import pytest

from src.features.form import weighted_form_features


def test_empty_results_returns_defaults():
    result = weighted_form_features([])
    assert result == {
        "weighted_win_rate": 0.50,
        "weighted_draw_rate": 0.333,
        "weighted_ppg": 1.0,
    }


def test_all_wins():
    result = weighted_form_features([1, 1, 1, 1, 1])
    assert result["weighted_win_rate"] == pytest.approx(1.0, abs=0.001)
    assert result["weighted_draw_rate"] == pytest.approx(0.0, abs=0.001)
    assert result["weighted_ppg"] == pytest.approx(3.0, abs=0.001)


def test_all_losses():
    result = weighted_form_features([-1, -1, -1, -1, -1])
    assert result["weighted_win_rate"] == pytest.approx(0.0, abs=0.001)
    assert result["weighted_draw_rate"] == pytest.approx(0.0, abs=0.001)
    assert result["weighted_ppg"] == pytest.approx(0.0, abs=0.001)


def test_all_draws():
    result = weighted_form_features([0, 0, 0, 0])
    assert result["weighted_win_rate"] == pytest.approx(0.0, abs=0.001)
    assert result["weighted_draw_rate"] == pytest.approx(1.0, abs=0.001)
    assert result["weighted_ppg"] == pytest.approx(1.0, abs=0.001)


def test_single_win():
    result = weighted_form_features([1])
    assert result["weighted_win_rate"] == pytest.approx(1.0, abs=0.001)
    assert result["weighted_ppg"] == pytest.approx(3.0, abs=0.001)


def test_single_loss():
    result = weighted_form_features([-1])
    assert result["weighted_win_rate"] == pytest.approx(0.0, abs=0.001)
    assert result["weighted_ppg"] == pytest.approx(0.0, abs=0.001)


def test_recent_results_weighted_more_heavily():
    # Win at end (most recent) should yield higher win_rate than win at start
    recent_win = weighted_form_features([-1, -1, -1, 1])
    old_win = weighted_form_features([1, -1, -1, -1])
    assert recent_win["weighted_win_rate"] > old_win["weighted_win_rate"]


def test_keys_always_present():
    for results in [[], [1], [0], [-1], [1, 0, -1, 1]]:
        r = weighted_form_features(results)
        assert "weighted_win_rate" in r
        assert "weighted_draw_rate" in r
        assert "weighted_ppg" in r


def test_ppg_in_valid_range():
    result = weighted_form_features([1, 0, -1, 1, 1])
    assert 0.0 <= result["weighted_ppg"] <= 3.0


def test_custom_alpha():
    # alpha=0.01 puts almost all weight on the last match (index n-1 gets weight 0.01^0=1.0)
    result = weighted_form_features([0, -1, -1, 1], alpha=0.01)
    # last result is win → weighted_win_rate should be close to 1.0
    assert result["weighted_win_rate"] > 0.9


def test_result_values_rounded_to_4dp():
    result = weighted_form_features([1, 0, -1])
    for key in ("weighted_win_rate", "weighted_draw_rate", "weighted_ppg"):
        val = result[key]
        assert round(val, 4) == val
