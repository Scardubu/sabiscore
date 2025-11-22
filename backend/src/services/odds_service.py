"""Real-time odds fetching service integrating multiple bookmaker APIs."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.cache import cache_manager
from ..core.config import settings
from ..db.models import Match, Odds

logger = logging.getLogger(__name__)


class OddsService:
    """Fetch and aggregate live odds from multiple bookmaker APIs."""

    def __init__(self, cache_backend: Any = None) -> None:
        self.cache = cache_backend or cache_manager
        self.odds_api_key = settings.odds_api_key
        self.odds_api_base = "https://api.the-odds-api.com/v4"
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(10.0, connect=5.0),
                limits=httpx.Limits(
                    max_keepalive_connections=10,
                    max_connections=20,
                    keepalive_expiry=30.0
                ),
                http2=True,  # Enable HTTP/2 for better performance
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

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

        if not self.odds_api_key:
            logger.warning("Odds API key not configured, returning mock odds")
            return self._generate_mock_odds(sport)

        try:
            client = await self._get_client()
            url = f"{self.odds_api_base}/sports/{sport}/odds"
            params = {
                "apiKey": self.odds_api_key,
                "regions": regions,
                "markets": markets,
                "oddsFormat": "decimal",
            }

            response = await client.get(url, params=params)
            response.raise_for_status()
            
            odds_data = response.json()
            logger.info("Fetched %d events from Odds API for %s", len(odds_data), sport)

            # Cache for 2 minutes (odds change frequently)
            self.cache.set(cache_key, odds_data, ttl=120)
            return odds_data

        except httpx.HTTPStatusError as exc:
            logger.error("Odds API HTTP error: %s - %s", exc.response.status_code, exc.response.text)
            return self._generate_mock_odds(sport)
        except Exception as exc:
            logger.error("Failed to fetch live odds: %s", exc)
            return self._generate_mock_odds(sport)

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
        # Normalize and create cache key for consistent lookups
        cache_key = f"match_odds:{league}:{home_team}:{away_team}".lower().replace(" ", "_")
        cached = self.cache.get(cache_key)
        if cached:
            logger.debug("Cache hit for match odds: %s", cache_key)
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

        # Fallback to reasonable default odds
        logger.warning("No live odds found for %s vs %s, using defaults", home_team, away_team)
        default_odds = {"home_win": 2.1, "draw": 3.3, "away_win": 3.6}
        self.cache.set(cache_key, default_odds, ttl=60)
        return default_odds

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
                timestamp=datetime.utcnow(),
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

                        if len(odds_dict) >= 2:
                            # Ensure we have all three outcomes
                            odds_dict.setdefault("home_win", 2.0)
                            odds_dict.setdefault("draw", 3.3)
                            odds_dict.setdefault("away_win", 3.5)
                            return odds_dict

        return None

    def _generate_mock_odds(self, sport: str) -> List[Dict[str, Any]]:
        """Generate mock odds for development/testing."""
        import random

        mock_matches = [
            {"home": "Arsenal", "away": "Liverpool"},
            {"home": "Manchester City", "away": "Chelsea"},
            {"home": "Tottenham", "away": "Manchester United"},
        ]

        events = []
        for match in mock_matches:
            base_home = random.uniform(1.8, 2.5)
            base_draw = random.uniform(3.0, 3.8)
            base_away = random.uniform(2.0, 4.0)

            events.append({
                "id": f"mock_{match['home']}_{match['away']}",
                "sport_key": sport,
                "commence_time": (datetime.utcnow() + timedelta(days=random.randint(0, 7))).isoformat(),
                "home_team": match["home"],
                "away_team": match["away"],
                "bookmakers": [{
                    "key": "mock_bookmaker",
                    "title": "Mock Bookmaker",
                    "markets": [{
                        "key": "h2h",
                        "outcomes": [
                            {"name": match["home"], "price": round(base_home, 2)},
                            {"name": "Draw", "price": round(base_draw, 2)},
                            {"name": match["away"], "price": round(base_away, 2)},
                        ]
                    }]
                }]
            })

        return events

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

            cutoff = datetime.utcnow() - timedelta(hours=hours)
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


# Global instance
odds_service = OddsService()
