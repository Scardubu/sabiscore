"""API endpoint tests using FastAPI TestClient."""
import json
from datetime import datetime, date
from typing import Any, Dict, Generator, List, Optional, Union
from unittest.mock import patch, MagicMock, ANY
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.encoders import jsonable_encoder

# Import the full API router so tests exercise the same routes as production
from src.api import api_router
from src.core.config import settings

class TestJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for test environment."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if hasattr(obj, 'model_dump'):  # For Pydantic v2
            return obj.model_dump()
        if hasattr(obj, 'dict'):  # For Pydantic v1
            return obj.dict()
        return super().default(obj)

# Create test client with the main app and custom JSON handling
test_app = FastAPI(title="Test SabiScore API")
test_app.include_router(api_router, prefix="/api/v1", tags=["API"])

class CustomTestClient(TestClient):
    def __init__(self, app):
        # Initialize with custom JSON encoder
        super().__init__(app)
        self.json_encoder = TestJSONEncoder

    def post(self, *args, **kwargs):
        # Ensure all data is JSON serializable
        if 'json' in kwargs:
            kwargs['json'] = json.loads(
                json.dumps(kwargs['json'], cls=TestJSONEncoder)
            )
        return super().post(*args, **kwargs)

# Create test client
client = CustomTestClient(test_app)

# Helper function to ensure all data is JSON serializable
def ensure_serializable(data: Any) -> Any:
    """Recursively convert all non-serializable objects to JSON-serializable types."""
    if isinstance(data, (str, int, float, bool, type(None))):
        return data
    if isinstance(data, (datetime, date)):
        return data.isoformat()
    if isinstance(data, dict):
        return {k: ensure_serializable(v) for k, v in data.items()}
    if isinstance(data, (list, tuple, set)):
        return [ensure_serializable(item) for item in data]
    if hasattr(data, 'model_dump'):  # Pydantic v2
        return ensure_serializable(data.model_dump())
    if hasattr(data, 'dict'):  # Pydantic v1
        return ensure_serializable(data.dict())
    if hasattr(data, 'isoformat'):  # datetime-like
        return data.isoformat()
    if hasattr(data, '__dict__'):  # Convert objects with __dict__
        return ensure_serializable(data.__dict__)
    return str(data)  # Fallback to string representation

@pytest.fixture
def mock_model() -> Generator[MagicMock, None, None]:
    """Fixture to provide a mock model instance."""
    with patch('src.models.ensemble.SabiScoreEnsemble') as mock_model_class, \
        patch('src.api.legacy_endpoints.cache') as mock_cache, \
        patch('src.api.legacy_endpoints.get_db') as mock_get_db, \
        patch('src.api.endpoints.monitoring.cache') as mock_monitoring_cache, \
        patch('src.api.endpoints.monitoring.engine') as mock_monitoring_engine:
        
        mock_model = MagicMock()
        mock_model.is_trained = True
        mock_model.engine = MagicMock()
        mock_model_class.load_latest_model.return_value = mock_model
        
        # Mock database session
        mock_db_session = MagicMock()
        mock_get_db.return_value = mock_db_session
        
        # Mock legacy cache methods for search endpoints
        mock_cache.ping.return_value = True
        mock_cache.metrics_snapshot.return_value = {
            "hits": 10,
            "misses": 2,
            "errors": 0,
            "circuit_open": False,
            "memory_entries": 5
        }

        # Monitoring health dependency mocks
        mock_monitoring_cache.ping.return_value = True
        mock_monitoring_cache.metrics_snapshot.return_value = mock_cache.metrics_snapshot.return_value

        mock_conn = MagicMock()
        mock_monitoring_engine.connect.return_value.__enter__.return_value = mock_conn
        mock_conn.execute.return_value = None
        
        test_app.state.model_instance = mock_model
        yield mock_model

@pytest.fixture
def test_client(mock_model: MagicMock) -> TestClient:
    """Test client with mocked dependencies."""
    return client

def test_health_check(test_client: TestClient) -> None:
    """Test health check endpoint."""
    response = test_client.get("/api/v1/health")
    assert response.status_code == 200
    assert "status" in response.json()
    assert "database" in response.json()

def test_search_matches(test_client: TestClient) -> None:
    """Test match search endpoint."""
    response = test_client.get("/api/v1/matches/search?q=manchester")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_insights_generation(test_client: TestClient, mock_model: MagicMock) -> None:
    """Test insights generation with valid request."""
    # Create a complete mock response that matches InsightsResponse schema
    mock_response = {
        "matchup": "Man Utd vs Liverpool",
        "league": "EPL",
        "metadata": {
            "matchup": "Man Utd vs Liverpool",
            "league": "EPL",
            "home_team": "Man Utd",
            "away_team": "Liverpool"
        },
        "predictions": {
            "home_win_prob": 0.6,
            "draw_prob": 0.2,
            "away_win_prob": 0.2,
            "prediction": "home_win",
            "confidence": 0.8
        },
        "xg_analysis": {
            "home_xg": 1.8,
            "away_xg": 1.2,
            "total_xg": 3.0,
            "xg_difference": 0.6
        },
        "value_analysis": {
            "value_bets": [
                {
                    "bet_type": "home_win",
                    "market_odds": 2.1,
                    "model_prob": 0.65,
                    "market_prob": 0.476,
                    "expected_value": 0.152,
                    "value_pct": 36.6,
                    "kelly_stake": 0.05,
                    "confidence_interval": [0.58, 0.72],
                    "edge": 0.174,
                    "recommendation": "Strong bet",
                    "quality": {
                        "quality_score": 75.5,
                        "tier": "Good",
                        "recommendation": "Consider betting",
                        "ev_contribution": 15.2,
                        "confidence_contribution": 39.0,
                        "liquidity_contribution": 18.75
                    }
                }
            ]
        },
        "monte_carlo": {
            "simulations": 10000,
            "distribution": {"home_win": 0.65, "draw": 0.20, "away_win": 0.15},
            "confidence_intervals": {"home_win": [0.63, 0.67]}
        },
        "scenarios": [{
            "name": "Most Likely", 
            "probability": 0.6, 
            "home_score": 2, 
            "away_score": 1, 
            "result": "home_win"
        }],
        "risk_assessment": {
            "risk_level": "low",
            "confidence_score": 0.78,
            "value_available": True,
            "recommendation": "Proceed",
            "distribution": {},
            "best_bet": None
        },
        "explanation": {
            "key_factors": ["Home advantage", "Recent form", "Head-to-head"],
            "summary": "Manchester United has been strong at home this season."
        },
        "narrative": "Manchester United has a 60% chance of winning against Liverpool based on current form and statistics.",
        "confidence_level": 0.8,
        "generated_at": datetime.utcnow()
    }
    
    # Ensure all data is JSON serializable
    mock_response = ensure_serializable(mock_response)
    
    # Convert to JSON and back to ensure it's fully serializable
    mock_response = json.loads(json.dumps(mock_response, cls=TestJSONEncoder))

    # Setup mock model and engine
    mock_engine = MagicMock()
    mock_engine.generate_match_insights.return_value = mock_response
    mock_model.engine = mock_engine

    # Make the request
    response = test_client.post(
        "/api/v1/insights",
        json={"matchup": "Man Utd vs Liverpool", "league": "EPL"}
    )

    # Assert the response
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}. Response: {response.text}"
    data = response.json()
    assert "predictions" in data, "Response missing 'predictions' field"
    assert "value_analysis" in data, "Response missing 'value_analysis' field"
    assert data["predictions"]["home_win_prob"] == 0.6, "Unexpected home_win_prob value"

def test_insights_validation(test_client: TestClient) -> None:
    """Test invalid insights request handling."""
    response = test_client.post(
        "/api/v1/insights",
        json={"matchup": "InvalidFormat"}
    )
    assert response.status_code == 422
    error = response.json()
    assert "detail" in error
    assert any("matchup" in str(e) for e in error["detail"])
