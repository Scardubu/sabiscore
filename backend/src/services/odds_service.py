"""Odds compatibility service backed by the provider gateway."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.cache import cache_manager
from ..core.config import settings
from ..db.models import Odds
from ..providers.base import ProviderStatus
from ..providers.the_odds_api import TheOddsAPIProvider

logger = logging.getLogger(__name__)


class OddsService:
    """Fetch live odds through the canonical provider gateway."""
    DEFAULT_ODDS = {"source": "unavailable", "reason": "odds_not_verified"}

    def __init__(self, cache_backend: Any = None) -> None:
        self.cache = cache_backend or cache_manager
        self.provider = TheOddsAPIProvider(
            api_key=settings.the_odds_api_key,
            enabled=settings.enable_the_odds_api_provider,
            live_tests=settings.provider_live_tests,
        )

    async def close(self) -> None:
        return None

    async def fetch_live_odds(
        self,
        sport: str = "soccer_epl",
        regions: str = "uk,eu",
        markets: str = "h2h",
    ) -> List[Dict[str, Any]]:
        """
        Fetch live odds from The Odds API.
        
        Args:
            sport: Sport key (e.g., soccer_epl, soccer_germany_bundesliga)
            regions: Comma-separated regions (uk, eu, us, au)
            markets: Comma-separated markets (h2h, spreads, totals)
            
        Returns:
            List of match odds dictionaries
        """
        cache_key = f"live_odds:{sport}:{regions}:{markets}"
        cached = self.cache.get(cache_key)
        if cached:
            logger.info("Cache hit for live odds: %s", sport)
            return cached

        result = await self.provider.odds(sport=sport, regions=regions, markets=markets)
        if result.status is not ProviderStatus.VERIFIED:
            logger.warning(
                "Odds provider unavailable provider=%s status=%s error=%s",
                result.provider,
                result.status.value,
                result.error_code,
            )
            return []

        self.cache.set(cache_key, result.records, ttl=120)
        return result.records

    async def get_match_odds(
        self,
        home_team: str,
        away_team: str,
        league: str,
    ) -> Dict[str, float]:
        """
        Get odds for a specific match by team names.
        
        Args:
            home_team: Home team name
            away_team: Away team name
            league: League identifier
            
        Returns:
            Dictionary with home_win, draw, away_win odds
        """
        cache_key = f"match_odds:{league}:{home_team}:{away_team}".lower().replace(" ", "_")
        cached = self.cache.get(cache_key)
        if cached:
            if isinstance(cached, dict):
                cached.setdefault("source", "cache")
                cached.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
            return cached

        sport_key = self._league_to_sport_key(league)
        live_odds = await self.fetch_live_odds(sport=sport_key)

        # Find matching event
        home_normalized = home_team.lower().replace(" ", "")
        away_normalized = away_team.lower().replace(" ", "")

        for event in live_odds:
            event_home = event.get("home_team", "").lower().replace(" ", "")
            event_away = event.get("away_team", "").lower().replace(" ", "")

            if home_normalized in event_home and away_normalized in event_away:
                odds = self._extract_h2h_odds(event)
                if odds:
                    # Cache for 5 minutes
                    self.cache.set(cache_key, odds, ttl=300)
                    return odds

        logger.warning("No verified live odds found for %s vs %s", home_team, away_team)
        unavailable = {
            "source": "unavailable",
            "reason": "coherent_1x2_market_snapshot_not_found",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bookmaker": None,
        }
        self.cache.set(cache_key, unavailable, ttl=60)
        return unavailable

    async def store_odds_snapshot(
        self,
        db: AsyncSession,
        match_id: str,
        odds: Dict[str, float],
        bookmaker: str = "aggregated",
    ) -> None:
        """Store odds snapshot in database for historical tracking."""
        try:
            odds_record = Odds(
                match_id=match_id,
                bookmaker=bookmaker,
                home_win=odds.get("home_win"),
                draw=odds.get("draw"),
                away_win=odds.get("away_win"),
                timestamp=datetime.now(timezone.utc),
            )
            db.add(odds_record)
            await db.commit()
            logger.info("Stored odds snapshot for match %s", match_id)
        except Exception as exc:
            logger.error("Failed to store odds snapshot: %s", exc)
            await db.rollback()

    def _league_to_sport_key(self, league: str) -> str:
        """Map internal league codes to Odds API sport keys."""
        league_map = {
            "epl": "soccer_epl",
            "premier_league": "soccer_epl",
            "bundesliga": "soccer_germany_bundesliga",
            "la_liga": "soccer_spain_la_liga",
            "serie_a": "soccer_italy_serie_a",
            "ligue_1": "soccer_france_ligue_one",
        }
        normalized = league.lower().replace(" ", "_")
        return league_map.get(normalized, "soccer_epl")

    def _extract_h2h_odds(self, event: Dict[str, Any]) -> Optional[Dict[str, float]]:
        """Extract head-to-head odds from Odds API event."""
        bookmakers = event.get("bookmakers", [])
        if not bookmakers:
            return None

        # Use first bookmaker with h2h market
        for bookmaker in bookmakers:
            markets = bookmaker.get("markets", [])
            for market in markets:
                if market.get("key") == "h2h":
                    outcomes = market.get("outcomes", [])
                    if len(outcomes) >= 2:
                        odds_dict = {}
                        for outcome in outcomes:
                            name = outcome.get("name", "").lower()
                            price = outcome.get("price")
                            if "draw" in name or name == "draw":
                                odds_dict["draw"] = float(price)
                            elif event.get("home_team", "").lower() in name:
                                odds_dict["home_win"] = float(price)
                            elif event.get("away_team", "").lower() in name:
                                odds_dict["away_win"] = float(price)

                        if {"home_win", "draw", "away_win"}.issubset(odds_dict):
                            odds_dict["source"] = "odds_api"
                            odds_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
                            odds_dict["bookmaker"] = bookmaker.get("title")
                            return odds_dict

        return None

    async def get_odds_movement(
        self,
        db: AsyncSession,
        match_id: str,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Get historical odds movement for a match.
        
        Args:
            db: Database session
            match_id: Match identifier
            hours: Hours of history to retrieve
            
        Returns:
            List of odds snapshots with timestamps
        """
        try:
            from sqlalchemy import select

            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
            query = (
                select(Odds)
                .where(Odds.match_id == match_id)
                .where(Odds.timestamp >= cutoff)
                .order_by(Odds.timestamp.desc())
            )

            result = await db.execute(query)
            odds_records = result.scalars().all()

            movement = []
            for record in odds_records:
                movement.append({
                    "timestamp": record.timestamp.isoformat(),
                    "bookmaker": record.bookmaker,
                    "home_win": record.home_win,
                    "draw": record.draw,
                    "away_win": record.away_win,
                })

            return movement

        except Exception as exc:
            logger.error("Failed to retrieve odds movement: %s", exc)
            return []


# Global instance (lazily initialized on first access)
odds_service = None
