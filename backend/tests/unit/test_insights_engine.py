"""Tests for insights prediction engine with synthetic data."""
import os
import pytest
import pandas as pd
from unittest.mock import MagicMock, patch
import sys
from pathlib import Path

# Add backend/src to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from src.insights.engine import InsightsEngine


# Ensure Redis connections are disabled during import
os.environ.setdefault("REDIS_ENABLED", "false")

with patch.dict("sys.modules", {
    "great_expectations": MagicMock(),
    "great_expectations.dataset": MagicMock(),
    "sqlalchemy": MagicMock(),
    "sqlalchemy.orm": MagicMock(),
    "redis": MagicMock(),
    "redis.exceptions": MagicMock(),
    "torch": MagicMock(),
    "torchvision": MagicMock(),
    "torchvision.transforms": MagicMock(),
}):
    with patch("requests.Session.get") as mock_get, patch("time.sleep", return_value=None):
        mock_response = MagicMock(status_code=200)
        mock_response.raise_for_status.return_value = None
        mock_response.text = ""
        mock_response.json.return_value = {}
        mock_get.return_value = mock_response

        # from src.insights.engine import InsightsEngine
        # from src.models.ensemble import SabiScoreEnsemble
        # from src.data.aggregator import DataAggregator


@pytest.fixture
def mock_model():
    """Mock ML model with fixed predictions."""
    mock = MagicMock()  # Remove spec restriction
    # Return DataFrame format as expected by engine
    mock.predict.return_value = pd.DataFrame([{
        "home_win_prob": 0.65,
        "draw_prob": 0.20,
        "away_win_prob": 0.15,
        "prediction": "home_win",
        "confidence": 0.8
    }])
    # Add other methods that might be called
    mock.transform.return_value = pd.DataFrame([{"feature": 1.0}])
    mock.explain.return_value = {"feature_importance": {"feature": 0.5}}
    mock.get_feature_names.return_value = ["home_goals_avg", "away_goals_avg"]
    mock.predict_proba.return_value = [[0.65, 0.20, 0.15]]
    mock.is_trained = True
    return mock


@pytest.fixture(autouse=True)
def disable_external_calls(monkeypatch):
    """Prevent live HTTP requests and slow sleeps during engine tests."""

    monkeypatch.setattr(
        "src.data.scrapers.BaseScraper._make_request",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr("src.data.scrapers.time.sleep", lambda *_: None)


@pytest.fixture
def sample_match_data():
    return {
        "metadata": {
            "matchup": "TeamA vs TeamB",
            "league": "EPL",
            "home_team": "TeamA",
            "away_team": "TeamB",
        },
        "team_stats": {
            "home": {"attacking_strength": 0.9, "defensive_strength": 0.75},
            "away": {"attacking_strength": 0.7, "defensive_strength": 0.65},
        },
        "odds": {
            "home_win": 2.1,
            "draw": 3.5,
            "away_win": 3.9,
        },
    }


def test_engine_with_synthetic_features(mock_model, sample_match_data):
    """Test full prediction flow with supplied match data and odds."""
    engine = InsightsEngine(model=mock_model)
    result = engine.generate_match_insights(
        matchup="TeamA vs TeamB",
        league="EPL",
        match_data=sample_match_data,
        market_odds=sample_match_data["odds"],
    )

    assert result["metadata"]["matchup"] == "TeamA vs TeamB"
    assert result["predictions"]["home_win_prob"] == pytest.approx(0.65)
    assert result["xg_analysis"]["home_xg"] > 0
    assert result["value_analysis"]["summary"].startswith("1 opportunities")
    assert result["monte_carlo"]["simulations"] == 10000
    assert abs(sum(result["monte_carlo"]["distribution"].values()) - 1.0) < 0.05
    assert len(result["scenarios"]) >= 1
    assert result["risk_assessment"]["risk_level"] in {"low", "medium", "high"}
    assert "TeamA vs TeamB" in result["narrative"]


def test_engine_with_missing_features(mock_model, sample_match_data):
    """Engine should fall back to safe defaults when data unavailable."""
    mock_model.is_trained = False
    engine = InsightsEngine(model=mock_model)
    result = engine.generate_match_insights(
        matchup="TeamA vs TeamB",
        league="EPL",
        match_data=sample_match_data,
    )
    
    # Should still produce a valid result structure
    assert "predictions" in result
    assert "metadata" in result
    assert result["metadata"]["matchup"] == "TeamA vs TeamB"
    assert result["predictions"]["prediction"] == "home_win"


def test_engine_uses_aggregator_when_no_match_data(mock_model, sample_match_data):
    """Verify aggregator is invoked when match_data not provided."""
    with patch('src.insights.engine.DataAggregator.fetch_match_data', return_value=sample_match_data) as mock_fetch:
        engine = InsightsEngine(model=mock_model)
        engine.generate_match_insights(matchup="TeamA vs TeamB", league="EPL")
        assert mock_fetch.call_count == 1


def test_engine_risk_assessment_varies_with_confidence(mock_model, sample_match_data):
    """Risk assessment should adjust tier based on probabilities."""
    engine = InsightsEngine(model=mock_model)
    custom_predictions = {
        "home_win_prob": 0.9,
        "draw_prob": 0.05,
        "away_win_prob": 0.05,
        "prediction": "home_win",
        "confidence": 0.85,
    }

    # No bets available -> should be high risk
    risk = engine._assess_risk(custom_predictions, {"bets": [], "best_bet": None}, {"distribution": {"home_win": 0.9}})
    assert risk["risk_level"] == "high"

    # Provide positive-EV bet to trigger low risk branch
    value_analysis = {
        "bets": [{"quality": {"quality_score": 90}, "market_odds": 2.0, "expected_value": 0.2}],
        "best_bet": {"quality": {"quality_score": 90}, "market_odds": 2.0, "expected_value": 0.2},
    }
    low_risk = engine._assess_risk(custom_predictions, value_analysis, {"distribution": {"home_win": 0.9}})
    assert low_risk["risk_level"] == "low"

    # Low confidence scenario should be high risk regardless of bets
    low_conf_predictions = dict(custom_predictions, confidence=0.4)
    risk_low = engine._assess_risk(low_conf_predictions, value_analysis, {"distribution": {"home_win": 0.3}})
    assert risk_low["risk_level"] == "high"


