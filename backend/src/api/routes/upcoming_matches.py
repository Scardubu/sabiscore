"""
API routes for upcoming matches with predictions and value bets.

Endpoints:
- GET /api/v1/upcoming/matches - Fetch upcoming matches with predictions
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_async_session
from ...services.upcoming_match_service import UpcomingMatchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upcoming", tags=["upcoming"])


# Pydantic response models
class PredictionSchema(BaseModel):
    home_win: float
    draw: float
    away_win: float
    model_version: str = "1.0.0"
    calibration_method: str = "isotonic"
    confidence: float


class OddsSchema(BaseModel):
    home_win: float
    draw: float
    away_win: float
    source: str
    timestamp: Optional[str] = None
    bookmaker: Optional[str] = None


class ValueBetSchema(BaseModel):
    outcome: str
    edge_pct: float
    kelly_stake_pct: float
    clv_cents: float
    recommended_stake_ngn: int
    confidence: float


class DataQualitySchema(BaseModel):
    historical_data_ratio: float
    defaults_used_count: int
    is_synthetic: bool


class UpcomingMatchSchema(BaseModel):
    match_id: str
    home_team: str
    away_team: str
    league: str
    match_date: str
    venue: Optional[str] = None
    status: str
    predictions: Optional[PredictionSchema] = None
    odds: Optional[OddsSchema] = None
    value_bets: List[ValueBetSchema] = []
    has_value: bool = False
    data_quality: Optional[DataQualitySchema] = None
    source: str


class UpcomingMatchesResponseSchema(BaseModel):
    upcoming_matches: List[UpcomingMatchSchema]
    total: int
    matches_with_value: int
    avg_edge_pct: float
    cache_hit: bool = False
    ttl_seconds: int = 300
    source: str


@router.get("/matches", response_model=UpcomingMatchesResponseSchema)
async def get_upcoming_matches(
    league: Optional[str] = Query(
        None,
        description="Filter by league (EPL, LaLiga, Bundesliga, Serie A, Ligue 1, Championship)",
        example="EPL",
    ),
    days_ahead: int = Query(
        7, ge=1, le=30, description="Number of days ahead to fetch matches"
    ),
    limit: int = Query(
        20, ge=1, le=50, description="Maximum number of matches to return"
    ),
    include_predictions: bool = Query(
        True, description="Include ML predictions and value bets"
    ),
    include_value_bets: bool = Query(
        True, description="Include value bet calculations"
    ),
    db: AsyncSession = Depends(get_async_session),
) -> UpcomingMatchesResponseSchema:
    """
    Get upcoming football matches with optional ML predictions and value bets.

    **Response fields:**
    - `upcoming_matches`: List of matches with predictions
      - `predictions`: Calibrated probabilities (Home Win, Draw, Away Win)
      - `odds`: Market odds from bookmakers
      - `value_bets`: Recommended bets with positive edge
      - `data_quality`: Metadata about feature completeness
    - `total`: Total number of matches
    - `matches_with_value`: Matches with identified value bets
    - `avg_edge_pct`: Average edge across all value bets

    **Query Parameters:**
    - `league`: Filter by league (optional)
    - `days_ahead`: Forecast horizon (default: 7 days)
    - `limit`: Max matches (default: 20, max: 50)
    - `include_predictions`: Attach ML predictions (default: true)
    - `include_value_bets`: Calculate value bets (default: true)

    **Cache:**
    - 5 minutes for prediction results
    - Falls back to database if external API unavailable

    **Example:**
    ```
    GET /api/v1/upcoming/matches?league=EPL&days_ahead=7&limit=10
    ```

    **Response (success):**
    ```json
    {
      "upcoming_matches": [
        {
          "match_id": "fd-631821",
          "home_team": "Arsenal",
          "away_team": "Chelsea",
          "league": "Premier League",
          "match_date": "2026-05-31T15:00:00Z",
          "predictions": {
            "home_win": 0.483,
            "draw": 0.218,
            "away_win": 0.299,
            "model_version": "1.0.0",
            "calibration_method": "isotonic",
            "confidence": 0.87
          },
          "odds": {
            "home_win": 2.10,
            "draw": 3.40,
            "away_win": 3.80,
            "source": "pinnacle"
          },
          "value_bets": [
            {
              "outcome": "draw",
              "edge_pct": 8.5,
              "kelly_stake_pct": 4.2,
              "clv_cents": 28.9,
              "recommended_stake_ngn": 5000,
              "confidence": 0.81
            }
          ],
          "has_value": true,
          "data_quality": {
            "historical_data_ratio": 0.92,
            "defaults_used_count": 5,
            "is_synthetic": false
          }
        }
      ],
      "total": 15,
      "matches_with_value": 7,
      "avg_edge_pct": 4.8,
      "cache_hit": false,
      "ttl_seconds": 300,
      "source": "football-data.org+predictions"
    }
    ```

    **Errors:**
    - 400: Invalid league name or parameters
    - 500: Internal server error (will still return matches without predictions)
    """

    try:
        service = UpcomingMatchService()

        if include_predictions:
            response = await service.get_upcoming_matches_with_predictions(
                db,
                league=league,
                days_ahead=days_ahead,
                limit=limit,
                include_value_bets=include_value_bets,
            )
        else:
            # Get base upcoming matches only
            response = await service.get_upcoming_matches(
                db, league=league, days_ahead=days_ahead, limit=limit
            )
            response["matches_with_value"] = 0
            response["avg_edge_pct"] = 0.0

        return response

    except Exception as e:
        logger.error(f"Error fetching upcoming matches: {e}", exc_info=True)
        return {
            "upcoming_matches": [],
            "total": 0,
            "matches_with_value": 0,
            "avg_edge_pct": 0.0,
            "cache_hit": False,
            "ttl_seconds": 0,
            "source": "error",
        }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for upcoming matches service."""
    return {
        "status": "healthy",
        "service": "upcoming_matches",
        "timestamp": datetime.utcnow().isoformat(),
    }
