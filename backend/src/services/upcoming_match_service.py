"""Service for production upcoming fixtures with API-first and DB fallback strategy."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.cache import cache_manager
from ..core.config import settings
from ..data.loaders.football_data_api import FootballDataAPIClient, FootballDataAPIError
from ..db.models import Match
from .upcoming_match_feature_service import UpcomingMatchFeatureProjector
from ..models.prediction import PredictionEngine
from .odds_service import OddsService

logger = logging.getLogger(__name__)


class UpcomingMatchService:
    """Fetch upcoming matches with cache and resilient fallback chain."""

    def __init__(self, api_client: Optional[FootballDataAPIClient] = None):
        self.api_client = api_client or FootballDataAPIClient()

    async def get_upcoming_matches(
        self,
        db: AsyncSession,
        league: Optional[str] = None,
        days_ahead: int = 7,
        limit: int = 20,
    ) -> Dict[str, Any]:
        cache_key = f"upcoming:v2:{league or '*'}:{days_ahead}:{limit}"
        cached = cache_manager.get(cache_key)
        if isinstance(cached, dict) and "matches" in cached:
            return cached

        try:
            matches = await self.api_client.get_upcoming_matches(days_ahead=days_ahead, limit=limit, league=league)
            payload = {
                "matches": matches,
                "total": len(matches),
                "league_filter": league,
                "date_range_days": days_ahead,
                "source": "football-data.org",
            }
            cache_manager.set(cache_key, payload, ttl=settings.fixture_cache_ttl)
            return payload
        except FootballDataAPIError:
            # Fall back to DB seamlessly when external fixture API is unavailable.
            db_payload = await self._get_upcoming_matches_from_db(db, league=league, days_ahead=days_ahead, limit=limit)
            db_payload["source"] = "database"
            cache_manager.set(cache_key, db_payload, ttl=settings.fixture_cache_ttl)
            return db_payload

    async def _get_upcoming_matches_from_db(
        self,
        db: AsyncSession,
        league: Optional[str],
        days_ahead: int,
        limit: int,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=max(days_ahead, 1))

        query = (
            select(Match)
            .where(
                and_(
                    Match.match_date >= now,
                    Match.match_date <= end_date,
                    Match.status == "scheduled",
                )
            )
            .order_by(Match.match_date.asc())
            .limit(limit)
        )
        if league:
            query = query.where(func.lower(Match.league_id) == league.lower())

        result = await db.execute(query)
        matches = result.scalars().all()

        rows: List[Dict[str, Any]] = []
        for match in matches:
            rows.append(
                {
                    "id": str(match.id),
                    "home_team": match.home_team_id,
                    "away_team": match.away_team_id,
                    "league": match.league_id,
                    "match_date": match.match_date.isoformat() if match.match_date else None,
                    "venue": match.venue,
                    "status": match.status or "scheduled",
                    "has_odds": False,
                    "source": "database",
                }
            )

        return {
            "matches": rows,
            "total": len(rows),
            "league_filter": league,
            "date_range_days": days_ahead,
        }

    async def get_upcoming_matches_with_predictions(
        self,
        db: AsyncSession,
        league: Optional[str] = None,
        days_ahead: int = 7,
        limit: int = 20,
        include_value_bets: bool = True,
    ) -> Dict[str, Any]:
        """
        Fetch upcoming matches and attach predictions + value bets.

        Args:
            db: Database session
            league: Optional league filter
            days_ahead: Days ahead to look
            limit: Max matches to return
            include_value_bets: Include value bet calculations

        Returns:
            {
                "upcoming_matches": [
                    {
                        match data + predictions + odds + value_bets
                    }
                ],
                "total": int,
                "matches_with_value": int,
                "avg_edge_pct": float,
                "source": str,
                "ttl_seconds": int
            }
        """

        cache_key = f"upcoming:predictions:{league or '*'}:{days_ahead}:{limit}"
        cached = cache_manager.get(cache_key)
        if isinstance(cached, dict) and "upcoming_matches" in cached:
            logger.debug(f"Prediction cache hit for {league}")
            return cached

        # Initialize services
        feature_projector = UpcomingMatchFeatureProjector()
        prediction_engine = PredictionEngine()
        odds_service = OddsService()

        # Get base upcoming matches
        try:
            matches_response = await self.get_upcoming_matches(
                db, league=league, days_ahead=days_ahead, limit=limit
            )
            matches = matches_response.get("matches", [])
            source = matches_response.get("source", "unknown")
        except Exception as e:
            logger.error(f"Failed to get upcoming matches: {e}")
            return {
                "upcoming_matches": [],
                "total": 0,
                "matches_with_value": 0,
                "error": str(e),
            }

        # Project features and get predictions for each match
        enriched_matches = []
        matches_with_value = 0
        total_edge_pct = 0.0

        for match in matches:
            try:
                match_id = str(match.get("match_id") or match.get("id") or "")
                match["match_id"] = match_id
                match_date = datetime.fromisoformat(
                    match.get("match_date", datetime.now(timezone.utc).isoformat())
                )

                # 1. Project features via canonical path (68 or 86 features)
                features_result = await feature_projector.project_match_features(
                    match, db, match_date
                )
                # Use features_58 slice for legacy prediction_service compat;
                # canonical prediction.py path can be added here once retrained
                # v6 artifacts are available under ACTIVE_BASELINE_VERSION.
                # Prefer the full Phase 8 vector; fall back through narrower widths
                features_arr = (
                    features_result.get("features")
                    or features_result.get("features_68")
                    or features_result.get("features_58")
                )
                if features_arr is None:
                    features_arr = np.array(
                        list(features_result.get("features_dict", {}).values()),
                        dtype=np.float32,
                    )
                full_features = np.asarray(features_arr, dtype=np.float32)

                # 2. Get predictions via canonical PredictionEngine path
                pred_result = await prediction_engine.predict(
                    features=full_features,
                    league=match.get("league", ""),
                    match_id=match_id,
                )
                predictions = pred_result.to_dict()
                data_gaps: list = list(features_result.get("data_gaps", []))

                # 3. Get odds
                odds = await odds_service.get_match_odds(
                    match.get("home_team", ""),
                    match.get("away_team", ""),
                    match.get("league", ""),
                )
                odds_available = {"home_win", "draw", "away_win"}.issubset(odds)

                # 4. Calculate value bets
                value_bets = []
                if include_value_bets and odds_available:
                    value_bets = PredictionEngine.calculate_value_bets(
                        predictions, odds
                    )

                # 5. Add enriched data to match
                match["predictions"] = predictions
                match["odds"] = odds if odds_available else None
                match["value_bets"] = value_bets
                match["has_value"] = len(value_bets) > 0
                match["best_value_bet"] = value_bets[0] if value_bets else None
                match["data_quality"] = features_result.get("data_quality", {})
                match["data_gaps"] = data_gaps
                match["staleness_seconds"] = features_result.get("staleness_seconds", 0)
                match["source"] = str(match.get("source", source))

                if value_bets:
                    matches_with_value += 1
                    # Calculate average edge from value bets
                    if value_bets:
                        total_edge_pct += value_bets[0].get("edge_pct", 0)

                enriched_matches.append(match)

            except Exception as e:
                logger.warning(
                    f"Failed to enrich match {match.get('id')}: {e}", exc_info=True
                )
                # Still include match without predictions
                match["predictions"] = None
                match["odds"] = None
                match["value_bets"] = []
                match["has_value"] = False
                match["best_value_bet"] = None
                match["data_gaps"] = ["prediction_failed"]
                match["staleness_seconds"] = 0
                match["match_id"] = str(match.get("match_id") or match.get("id") or "")
                match["source"] = str(match.get("source", source))
                enriched_matches.append(match)

        # Build response
        avg_edge_pct = (
            total_edge_pct / matches_with_value if matches_with_value > 0 else 0.0
        )

        response = {
            "upcoming_matches": enriched_matches,
            "total": len(enriched_matches),
            "matches_with_value": matches_with_value,
            "avg_edge_pct": round(avg_edge_pct, 2),
            "cache_hit": False,
            "ttl_seconds": settings.fixture_cache_ttl,
            "source": f"{source}+predictions",
        }

        # Cache result
        cache_manager.set(cache_key, response, ttl=settings.fixture_cache_ttl)

        return response
