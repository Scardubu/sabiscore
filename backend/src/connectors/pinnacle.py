"""
Pinnacle Sports API Connector
Closing line oracle for CLV (Closing Line Value) tracking

Requires Pinnacle credentials (set in environment):
- PINNACLE_API_KEY
- PINNACLE_API_SECRET
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable
import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential
import base64

from ..core.config import settings

logger = logging.getLogger(__name__)


class PinnacleConnector:
    """Real-time connector for Pinnacle Sports API"""

    API_URL = "https://api.pinnacle.com/v2"
    WS_URL = "wss://api.pinnacle.com/stream"

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
    ):
        """Initialize Pinnacle connector
        
        Args:
            api_key: Pinnacle API key (username)
            api_secret: Pinnacle API secret (password)
        """
        self.api_key = api_key or getattr(settings, "pinnacle_api_key", None)
        self.api_secret = api_secret or getattr(settings, "pinnacle_api_secret", None)
        self.session: Optional[aiohttp.ClientSession] = None
        self.ws_connection = None

        if not self.api_key or not self.api_secret:
            logger.warning("Pinnacle credentials not configured - connector will not function")

    async def __aenter__(self):
        """Async context manager entry"""
        if self.api_key and self.api_secret:
            # Create Basic Auth header
            credentials = f"{self.api_key}:{self.api_secret}"
            encoded = base64.b64encode(credentials.encode()).decode()
            
            self.session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Basic {encoded}",
                    "Content-Type": "application/json",
                }
            )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
        if self.ws_connection:
            await self.ws_connection.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def fetch_odds(self, sport_id: int = 29, league_ids: Optional[List[int]] = None) -> Optional[Dict]:
        """Fetch current odds from Pinnacle
        
        Args:
            sport_id: Sport ID (29 = Soccer)
            league_ids: Optional list of league IDs to filter
            
        Returns:
            Dictionary with current odds for all markets
        """
        if not self.session:
            logger.warning("Pinnacle session not initialized")
            return self._mock_pinnacle_odds()

        url = f"{self.API_URL}/odds"
        params = {
            "sportId": sport_id,
            "oddsFormat": "DECIMAL",
            "isLive": 0,
        }
        
        if league_ids:
            params["leagueIds"] = ",".join(map(str, league_ids))

        try:
            async with self.session.get(url, params=params) as response:
                if response.status == 401:
                    logger.error("Pinnacle authentication failed - check credentials")
                    return None
                    
                response.raise_for_status()
                data = await response.json()
                
                logger.info(f"Fetched Pinnacle odds for {len(data.get('leagues', []))} leagues")
                return self._parse_odds_response(data)
                
        except Exception as e:
            logger.error(f"Pinnacle API error: {e}")
            return None

    def _parse_odds_response(self, data: Dict) -> Dict:
        """Parse Pinnacle odds API response"""
        parsed = {
            "sport_id": data.get("sportId"),
            "last_updated": data.get("last"),
            "leagues": [],
            "fetched_at": datetime.utcnow().isoformat(),
        }

        for league in data.get("leagues", []):
            league_data = {
                "league_id": league.get("id"),
                "league_name": league.get("name"),
                "events": []
            }

            for event in league.get("events", []):
                event_data = {
                    "event_id": event.get("id"),
                    "home_team": event.get("home"),
                    "away_team": event.get("away"),
                    "starts": event.get("starts"),
                    "periods": []
                }

                for period in event.get("periods", []):
                    period_data = {
                        "period_number": period.get("number"),
                        "cutoff": period.get("cutoff"),
                        "moneyline": period.get("moneyline", {}),
                        "spreads": period.get("spreads", []),
                        "totals": period.get("totals", []),
                    }
                    event_data["periods"].append(period_data)

                league_data["events"].append(event_data)
            parsed["leagues"].append(league_data)

        return parsed

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def fetch_closing_odds(self, event_id: int) -> Optional[Dict]:
        """Fetch closing line odds for an event (post-match)
        
        Args:
            event_id: Pinnacle event ID
            
        Returns:
            Dictionary with closing odds for CLV calculation
        """
        if not self.session:
            logger.warning("Pinnacle session not initialized")
            return None

        url = f"{self.API_URL}/odds"
        params = {
            "sportId": 29,
            "eventIds": event_id,
            "oddsFormat": "DECIMAL",
        }

        try:
            async with self.session.get(url, params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                return self._extract_closing_odds(data, event_id)
                
        except Exception as e:
            logger.error(f"Error fetching Pinnacle closing odds: {e}")
            return None

    def _extract_closing_odds(self, data: Dict, event_id: int) -> Optional[Dict]:
        """Extract closing odds for specific event"""
        try:
            for league in data.get("leagues", []):
                for event in league.get("events", []):
                    if event.get("id") == event_id:
                        periods = event.get("periods", [])
                        if periods:
                            period = periods[0]  # Full time
                            moneyline = period.get("moneyline", {})
                            
                            return {
                                "event_id": event_id,
                                "home_team": event.get("home"),
                                "away_team": event.get("away"),
                                "home_odds": moneyline.get("home"),
                                "away_odds": moneyline.get("away"),
                                "draw_odds": moneyline.get("draw"),
                                "cutoff": period.get("cutoff"),
                                "fetched_at": datetime.utcnow().isoformat(),
                            }
        except Exception as e:
            logger.error(f"Error extracting closing odds: {e}")
        
        return None

    async def stream_odds(
        self,
        sport_id: int,
        callback: Callable[[Dict], None],
    ) -> None:
        """Stream real-time odds updates via WebSocket
        
        Args:
            sport_id: Sport ID to stream (29 = Soccer)
            callback: Function to call with each update
        """
        if not self.api_key or not self.api_secret:
            logger.error("Cannot stream without Pinnacle credentials")
            return

        credentials = f"{self.api_key}:{self.api_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(
                    self.WS_URL,
                    headers={"Authorization": f"Basic {encoded}"}
                ) as ws:
                    self.ws_connection = ws
                    
                    # Subscribe to sport
                    subscribe_msg = {
                        "action": "subscribe",
                        "sportId": sport_id,
                        "oddsFormat": "DECIMAL",
                    }
                    await ws.send_json(subscribe_msg)
                    logger.info(f"Subscribed to Pinnacle stream for sport {sport_id}")
                    
                    # Process messages
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            if data.get("type") == "odds_update":
                                callback(data)
                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            logger.error(f"WebSocket error: {ws.exception()}")
                            break
                            
        except Exception as e:
            logger.error(f"Pinnacle stream error: {e}")

    def calculate_clv(
        self,
        bet_odds: float,
        closing_odds: float,
    ) -> float:
        """Calculate Closing Line Value (CLV)
        
        Args:
            bet_odds: Odds when bet was placed
            closing_odds: Closing line odds
            
        Returns:
            CLV in cents (positive = value captured)
        """
        if bet_odds <= 1.0 or closing_odds <= 1.0:
            return 0.0
        
        bet_prob = 1.0 / bet_odds
        closing_prob = 1.0 / closing_odds
        
        # CLV = difference in implied probability
        clv = (bet_prob - closing_prob) * 100
        return round(clv, 2)

    def _mock_pinnacle_odds(self) -> Dict:
        """Mock Pinnacle odds for testing"""
        return {
            "sport_id": 29,
            "last_updated": datetime.utcnow().isoformat(),
            "leagues": [
                {
                    "league_id": 1980,
                    "league_name": "England - Premier League",
                    "events": [
                        {
                            "event_id": 123456,
                            "home_team": "Arsenal",
                            "away_team": "Liverpool",
                            "starts": "2025-11-03T15:00:00Z",
                            "periods": [
                                {
                                    "period_number": 0,
                                    "cutoff": "2025-11-03T14:55:00Z",
                                    "moneyline": {
                                        "home": 2.10,
                                        "away": 3.50,
                                        "draw": 3.40,
                                    },
                                    "spreads": [],
                                    "totals": [],
                                }
                            ]
                        }
                    ]
                }
            ],
            "fetched_at": datetime.utcnow().isoformat(),
            "mock": True,
        }


if __name__ == "__main__":
    async def test():
        async with PinnacleConnector() as pinnacle:
            odds = await pinnacle.fetch_odds(sport_id=29)
            print("Odds:", json.dumps(odds, indent=2))
            
            # Test CLV calculation
            clv = pinnacle.calculate_clv(bet_odds=2.10, closing_odds=1.95)
            print(f"CLV: {clv:+.2f} cents")
    
    asyncio.run(test())
