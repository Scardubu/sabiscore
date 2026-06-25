"""
API routes for upcoming matches with predictions and value bets.

Endpoints:
- GET /upcoming/matches - Fetch upcoming matches with predictions
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...db.session import get_async_session
from ...services.upcoming_match_service import UpcomingMatchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upcoming", tags=["upcoming"])

# Approximate next-season start dates per league (ISO 8601 dates).
# Updated each off-season; used when fixture list is genuinely empty.
_NEXT_SEASON_START: Dict[str, str] = {
    "epl": "2026-08-08",
    "premier_league": "2026-08-08",
    "la_liga": "2026-08-15",
    "laliga": "2026-08-15",
    "bundesliga": "2026-08-21",
    "serie_a": "2026-08-23",
    "seriea": "2026-08-23",
    "ligue_1": "2026-08-08",
    "ligue1": "2026-08-08",
    "eredivisie": "2026-08-07",
    "ucl": "2026-09-15",
    "champions_league": "2026-09-15",
}
_NEXT_SEASON_START_DEFAULT = "2026-08-08"


def _compute_edge_quality_score(match: Dict[str, Any]) -> Optional[float]:
    """Compute a simplified 0-1 edge quality score from available upcoming-match data.

    Formula (approximation of the full Sprint 4 edge_quality_score):
      confidence  × 0.40  — model calibrated confidence
      market_edge × 0.30  — normalised best_value_bet.edge_pct (0%→0, 10%→1)
      freshness   × 0.20  — linear decay over LIVE_THRESHOLD_SECONDS
      completeness× 0.10  — historical_data_ratio from data_quality

    Returns None when neither predictions nor value bets are available.
    """
    predictions = match.get("predictions")
    best_bet = match.get("best_value_bet")
    data_quality = match.get("data_quality")
    staleness = int(match.get("staleness_seconds", 0))

    if predictions is None and best_bet is None:
        return None

    confidence = float(predictions.get("confidence", 0.0)) if predictions else 0.0
    edge_pct = float(best_bet.get("edge_pct", 0.0)) if best_bet else 0.0
    market_edge = min(1.0, edge_pct / 10.0)
    threshold = float(getattr(settings, "live_threshold_seconds", 3600))
    freshness = max(0.0, 1.0 - staleness / threshold) if threshold > 0 else 1.0
    completeness = (
        float(data_quality.get("historical_data_ratio", 0.5))
        if isinstance(data_quality, dict)
        else 0.5
    )

    score = 0.40 * confidence + 0.30 * market_edge + 0.20 * freshness + 0.10 * completeness
    return round(min(1.0, max(0.0, score)), 3)


def _next_season_start(league: Optional[str]) -> str:
    if not league:
        return _NEXT_SEASON_START_DEFAULT
    return _NEXT_SEASON_START.get(league.lower().replace(" ", "_"), _NEXT_SEASON_START_DEFAULT)


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
    value_bets: List[ValueBetSchema] = Field(default_factory=list)
    has_value: bool = False
    best_value_bet: Optional[ValueBetSchema] = None
    data_quality: Optional[DataQualitySchema] = None
    data_gaps: List[str] = Field(default_factory=list)
    staleness_seconds: int = 0
    source: str = "unknown"
    edge_quality_score: Optional[float] = None
    clv_pct: Optional[float] = None
    # UCL stage: group, r16, qf, sf, final. Null for domestic leagues.
    competition_stage: Optional[str] = None


class UpcomingMatchesResponseSchema(BaseModel):
    upcoming_matches: List[UpcomingMatchSchema]
    total: int
    matches_with_value: int
    avg_edge_pct: float
    cache_hit: bool = False
    ttl_seconds: int = 300
    source: str
    offseason: bool = False
    next_season_start: Optional[str] = None


class UpcomingAllFixtureSchema(BaseModel):
    matchId: str
    homeTeam: str
    awayTeam: str
    kickoffUtc: str
    league: str
    homeLogoUrl: str = ""
    awayLogoUrl: str = ""
    predictionAvailable: bool
    unavailableReason: Optional[str] = None
    edge_pct: Optional[float] = None
    freshnessTag: Optional[str] = None
    partialData: bool = False
    model_votes: Optional[Dict[str, int]] = None
    matchImportance: Optional[str] = None
    matchRound: Optional[str] = None
    # UCL stage: group, r16, qf, sf, final. Null for domestic leagues.
    competition_stage: Optional[str] = None


class UpcomingAllResponseSchema(BaseModel):
    fixtures: List[UpcomingAllFixtureSchema]
    total: int
    days: int
    source: str
    cache_ttl_seconds: int


@router.get("/matches", response_model=UpcomingMatchesResponseSchema)
async def get_upcoming_matches(
    league: Optional[str] = Query(
        None,
        description="Filter by league (EPL, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, UCL)",
        examples=["EPL"],
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

    **Cache:** 5 minutes for prediction results. Falls back to database if external API unavailable.

    **Example:**
    ```
    GET /upcoming/matches?league=EPL&days_ahead=7&limit=10
    ```
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
            response = await service.get_upcoming_matches(
                db, league=league, days_ahead=days_ahead, limit=limit
            )
            response["matches_with_value"] = 0
            response["avg_edge_pct"] = 0.0
            # get_upcoming_matches returns "matches"; normalise to "upcoming_matches"
            if "upcoming_matches" not in response and "matches" in response:
                response["upcoming_matches"] = response.pop("matches")

        matches = response.get("upcoming_matches", [])

        # Inject edge_quality_score per match
        for match in matches:
            match["edge_quality_score"] = _compute_edge_quality_score(match)

        # Detect off-season: fixture list genuinely empty
        is_offseason = len(matches) == 0
        response["offseason"] = is_offseason
        response["next_season_start"] = _next_season_start(league) if is_offseason else None

        return UpcomingMatchesResponseSchema.model_validate(response)

    except Exception as e:
        logger.error(f"Error fetching upcoming matches: {e}", exc_info=True)
        return UpcomingMatchesResponseSchema(
            upcoming_matches=[],
            total=0,
            matches_with_value=0,
            avg_edge_pct=0.0,
            cache_hit=False,
            ttl_seconds=0,
            source="error",
            offseason=False,
        )


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for upcoming matches service."""
    return {
        "status": "healthy",
        "service": "upcoming_matches",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/all", response_model=UpcomingAllResponseSchema)
async def get_upcoming_all(
    days: int = Query(7, ge=1, le=14, description="Number of days ahead"),
    limit: int = Query(200, ge=1, le=200, description="Maximum number of fixtures"),
    db: AsyncSession = Depends(get_async_session),
) -> UpcomingAllResponseSchema:
    """Get merged upcoming fixtures across all configured leagues.

    Includes prediction availability and edge summary where present.
    """
    service = UpcomingMatchService()
    payload = await service.get_upcoming_matches_with_predictions(
        db,
        league=None,
        days_ahead=days,
        limit=limit,
        include_value_bets=True,
    )

    fixtures: List[UpcomingAllFixtureSchema] = []
    for match in payload.get("upcoming_matches", []):
        value_bets = match.get("value_bets") or []
        best_edge = None
        if value_bets:
            try:
                best_edge = float(max(v.get("edge_pct", 0.0) for v in value_bets))
            except Exception:
                best_edge = None

        league = str(match.get("league", ""))
        is_ucl = league.upper() in {"UCL", "CHAMPIONS LEAGUE", "UEFA CHAMPIONS LEAGUE"}

        fixtures.append(
            UpcomingAllFixtureSchema(
                matchId=str(match.get("match_id") or match.get("id") or ""),
                homeTeam=str(match.get("home_team", "")),
                awayTeam=str(match.get("away_team", "")),
                kickoffUtc=str(match.get("match_date", "")),
                league=league,
                predictionAvailable=bool(match.get("predictions") is not None),
                unavailableReason=(
                    None
                    if match.get("predictions") is not None
                    else ", ".join(match.get("data_gaps") or ["Prediction unavailable"])
                ),
                edge_pct=best_edge,
                freshnessTag=(
                    "LIVE"
                    if int(match.get("staleness_seconds", 0)) == 0
                    else "RECENT"
                    if int(match.get("staleness_seconds", 0)) < 86400
                    else "STALE"
                ),
                partialData=bool(match.get("data_gaps")),
                model_votes=None,
                matchImportance="high" if is_ucl else "normal",
                matchRound="group" if is_ucl else None,
            )
        )

    fixtures.sort(key=lambda f: f.kickoffUtc)
    return UpcomingAllResponseSchema(
        fixtures=fixtures[:limit],
        total=min(len(fixtures), limit),
        days=days,
        source=str(payload.get("source", "unknown")),
        cache_ttl_seconds=int(payload.get("ttl_seconds", 300)),
    )



