"""Zero-fabrication regression tests for the upcoming-matches prediction path.

get_upcoming_matches_with_predictions() previously ran calculate_value_bets()
on PredictionEngine's uniform fallback result (returned whenever a model
artifact is missing or inference fails) whenever real market odds were
present — producing a fabricated edge/Kelly stake that reached the public
GET /upcoming/matches response. _is_fallback_prediction() is the gate that
prevents that; these tests pin its behavior and document the exact
fabrication it prevents.
"""

from __future__ import annotations

import sys
import os

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.services.upcoming_match_service import (
    _is_fallback_prediction,
    _select_feature_vector,
)
from src.models.prediction import PredictionEngine


def test_is_fallback_prediction_true_for_fallback_model_version():
    assert _is_fallback_prediction({"model_version": "fallback"}) is True


def test_is_fallback_prediction_case_insensitive():
    assert _is_fallback_prediction({"model_version": "FALLBACK"}) is True
    assert _is_fallback_prediction({"model_version": "Fallback"}) is True


def test_is_fallback_prediction_false_for_real_model_version():
    assert _is_fallback_prediction({"model_version": "v6_phase8"}) is False


def test_is_fallback_prediction_false_when_model_version_missing():
    assert _is_fallback_prediction({}) is False


def test_select_feature_vector_handles_project_match_features_shape():
    """Regression: project_match_features() returns features_68/features_58 but
    no 'features' key. A `a or b or c` chain over those values calls bool() on a
    multi-element ndarray and raises ValueError, which the enrichment loop
    swallowed into data_gaps=["prediction_failed"] for every fixture in
    production. This must select the vector without raising."""
    features_result = {
        "features_68": np.zeros(68, dtype=np.float32),
        "features_58": np.zeros(58, dtype=np.float32),
    }

    vector = _select_feature_vector(features_result)

    assert vector.shape == (68,)


def test_select_feature_vector_prefers_widest_available():
    features_result = {
        "features": np.ones(86, dtype=np.float32),
        "features_68": np.zeros(68, dtype=np.float32),
        "features_58": np.zeros(58, dtype=np.float32),
    }

    assert _select_feature_vector(features_result).shape == (86,)


def test_select_feature_vector_falls_back_to_features_dict():
    features_result = {"features_dict": {"a": 1.0, "b": 2.0}}

    assert _select_feature_vector(features_result).shape == (2,)


def test_select_feature_vector_ignores_an_all_zero_vector_rather_than_skipping_it():
    """An all-zero vector is falsy-adjacent but still a real projection —
    presence must be decided by `is not None`, never by truthiness."""
    features_result = {"features_68": np.zeros(68, dtype=np.float32)}

    assert _select_feature_vector(features_result).shape == (68,)


def test_fallback_prediction_would_fabricate_a_positive_edge_if_ungated():
    """Documents why the gate in get_upcoming_matches_with_predictions exists:
    a uniform-fallback prediction, called directly against realistic odds,
    produces a real-looking value bet — the exact fabrication the caller
    must avoid reaching."""
    fallback_predictions = {"home_win": 0.333, "draw": 0.333, "away_win": 0.334}
    odds = {"home_win": 2.1, "draw": 3.4, "away_win": 4.0}

    bets = PredictionEngine.calculate_value_bets(fallback_predictions, odds)

    assert len(bets) > 0
    assert bets[0]["edge_pct"] > 0


def test_calculate_value_bets_caps_kelly_stake_at_league_policy_cap():
    """WP-17 prerequisite fix: calculate_value_bets previously applied no cap
    at all (a 4th, independent, uncapped Kelly implementation beyond
    insights/engine.py, betting_intelligence.py, core_engine.py). A
    pathological high-edge input must still respect EREDIVISIE's 0.025
    kelly_cap via get_league_policy, not an arbitrarily large raw stake."""
    predictions = {"home_win": 0.99, "draw": 0.005, "away_win": 0.005}
    odds = {"home_win": 1.5, "draw": 20.0, "away_win": 20.0}

    bets = PredictionEngine.calculate_value_bets(predictions, odds, league="EREDIVISIE")

    home_bet = next(b for b in bets if b["outcome"] == "home_win")
    assert home_bet["kelly_stake_pct"] <= 2.5


def test_calculate_value_bets_falls_back_to_max_kelly_cap_for_unknown_league():
    """Same pathological input, an unrecognized league string — falls back
    to the conservative global MAX_KELLY_CAP (5.0%), not uncapped, and NOT
    EREDIVISIE's tighter 2.5% cap (that would require a league that resolves)."""
    predictions = {"home_win": 0.99, "draw": 0.005, "away_win": 0.005}
    odds = {"home_win": 1.5, "draw": 20.0, "away_win": 20.0}

    bets = PredictionEngine.calculate_value_bets(predictions, odds, league="NOT_A_REAL_LEAGUE")

    home_bet = next(b for b in bets if b["outcome"] == "home_win")
    assert home_bet["kelly_stake_pct"] <= 5.0
    assert home_bet["kelly_stake_pct"] > 2.5
