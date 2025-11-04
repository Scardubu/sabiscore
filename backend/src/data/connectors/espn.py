"""
ESPN API Connector
Real-time scores and match updates with 8-second latency

Features:
- Live scores
- Match events (goals, cards, substitutions)
- Line-ups
- Match statistics
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential
from cachetools import TTLCache

from ...core.config import settings
from ...core.database import Match, MatchEvent, session_scope

import logging

logger = logging.getLogger(__name__)


class ESPNConnector:
    """ESPN API connector for live match data"""

    BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/"
    
    LEAGUE_IDS = {
        "EPL": "eng.1",
        "La_Liga": "esp.1",
        "Bundesliga": "ger.1",
        "Serie_A": "ita.1",
        "Ligue_1": "fra.1",
    }
    
    def __init__(self, poll_interval: int = 8):
        """
        Initialize ESPN connector
        
        Args:
            poll_interval: Polling interval in seconds (default: 8s for 8s latency)
        """
        self.poll_interval = poll_interval
        self.cache = TTLCache(maxsize=500, ttl=poll_interval)
        self.session: Optional[aiohttp.ClientSession] = None
        self._running = False

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            headers={
                "User-Agent": settings.user_agent,
            }
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        self._running = False
        if self.session:
            await self.session.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
    )
    async def fetch_scoreboard(self, league: str, date: Optional[str] = None) -> List[Dict]:
        """
        Fetch scoreboard for a league
        
        Args:
            league: League name (EPL, La_Liga, etc.)
            date: Date in YYYYMMDD format (default: today)
        
        Returns:
            List of match data
        """
        
        if league not in self.LEAGUE_IDS:
            raise ValueError(f"Unknown league: {league}")
        
        league_id = self.LEAGUE_IDS[league]
        url = urljoin(self.BASE_URL, f"{league_id}/scoreboard")
        
        params = {}
        if date:
            params["dates"] = date
        
        cache_key = f"{league}_{date or 'today'}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        try:
            async with self.session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    events = data.get("events", [])
                    
                    matches = []
                    for event in events:
                        match = self._parse_event(event, league)
                        if match:
                            matches.append(match)
                    
                    self.cache[cache_key] = matches
                    logger.info(f"Fetched {len(matches)} matches from ESPN for {league}")
                    
                    return matches
                else:
                    logger.warning(f"ESPN API returned HTTP {response.status}")
                    return []
        
        except Exception as e:
            logger.error(f"Error fetching ESPN scoreboard: {e}")
            raise

    def _parse_event(self, event: Dict, league: str) -> Optional[Dict]:
        """Parse ESPN event data into match structure"""
        
        try:
            competitions = event.get("competitions", [])
            if not competitions:
                return None
            
            competition = competitions[0]
            competitors = competition.get("competitors", [])
            
            if len(competitors) != 2:
                return None
            
            home_team = next((c for c in competitors if c.get("homeAway") == "home"), None)
            away_team = next((c for c in competitors if c.get("homeAway") == "away"), None)
            
            if not home_team or not away_team:
                return None
            
            status = competition.get("status", {})
            status_type = status.get("type", {}).get("name", "")
            
            # Parse match events
            events = []
            for detail in competition.get("details", []):
                events.append({
                    "type": detail.get("type", {}).get("text", ""),
                    "clock": detail.get("clock", {}).get("displayValue", ""),
                    "team": detail.get("team", {}).get("displayName", ""),
                    "athlete": detail.get("athletesInvolved", [{}])[0].get("displayName", "") if detail.get("athletesInvolved") else "",
                })
            
            return {
                "espn_id": event.get("id"),
                "league": league,
                "home_team": home_team.get("team", {}).get("displayName", ""),
                "away_team": away_team.get("team", {}).get("displayName", ""),
                "home_score": int(home_team.get("score", 0)),
                "away_score": int(away_team.get("score", 0)),
                "status": status_type,
                "minute": status.get("displayClock", ""),
                "date": event.get("date", ""),
                "events": events,
                "statistics": competition.get("statistics", []),
            }
        
        except Exception as e:
            logger.error(f"Error parsing ESPN event: {e}")
            return None

    async def poll_live_matches(self, league: str, callback=None):
        """
        Continuously poll for live match updates
        
        Args:
            league: League name
            callback: Async function to call with updates (receives match_data dict)
        """
        
        self._running = True
        
        while self._running:
            try:
                matches = await self.fetch_scoreboard(league)
                
                # Filter for live matches
                live_matches = [m for m in matches if m["status"] in ["STATUS_IN_PROGRESS", "STATUS_HALFTIME"]]
                
                if live_matches:
                    logger.info(f"Found {len(live_matches)} live matches in {league}")
                    
                    if callback:
                        for match in live_matches:
                            await callback(match)
                
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"Error in live polling: {e}")
                await asyncio.sleep(self.poll_interval)

    async def update_match_from_espn(self, match_id: str, espn_id: str) -> bool:
        """Update database match with ESPN live data"""
        
        # TODO: Implement match update logic
        # Fetch data from ESPN, update Match and MatchEvent tables
        
        return False

    def stop_polling(self):
        """Stop the live polling loop"""
        self._running = False


if __name__ == "__main__":
    # Test connector
    async def main():
        async with ESPNConnector(poll_interval=5) as connector:
            matches = await connector.fetch_scoreboard("EPL")
            print(f"Found {len(matches)} matches")
            
            for match in matches[:3]:
                print(f"{match['home_team']} {match['home_score']}-{match['away_score']} {match['away_team']} ({match['status']})")
    
    asyncio.run(main())
