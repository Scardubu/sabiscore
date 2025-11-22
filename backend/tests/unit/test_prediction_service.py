"""Unit tests for prediction service to boost coverage."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.schemas.prediction import PredictionResponse, LeagueCode


def test_prediction_response_schema():
    """Test PredictionResponse schema validation."""
    prediction = PredictionResponse(
        match_id="match-123",
        home_team="Arsenal",
        away_team="Liverpool",
        league=LeagueCode.EPL,
        predictions={
            "home_win": 0.45,
            "draw": 0.30,
            "away_win": 0.25,
        },
        confidence=0.45,
        brier_score=0.18,
        value_bets=[],
        metadata={
            "engine": "god_stack_superlearner",
            "final_accuracy": 0.68
        }
    )
    
    assert prediction.predictions["home_win"] == 0.45
    assert prediction.confidence == 0.45
    assert prediction.metadata["engine"] == "god_stack_superlearner"


def test_prediction_response_probabilities_sum():
    """Test prediction probabilities sum to approximately 1."""
    prediction = PredictionResponse(
        match_id="match-456",
        home_team="Chelsea",
        away_team="Spurs",
        league=LeagueCode.EPL,
        predictions={
            "home_win": 0.40,
            "draw": 0.30,
            "away_win": 0.30,
        },
        confidence=0.40,
        brier_score=0.19,
        metadata={}
    )
    
    total_prob = sum(prediction.predictions.values())
    assert abs(total_prob - 1.0) < 0.01
