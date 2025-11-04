"""
Opta Sports Data API Connector
Real-time xG, xT, pressure maps, and advanced match statistics

Requires Opta API credentials (set in environment):
- OPTA_API_KEY
- OPTA_API_SECRET
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable
import aiohttp
from tenacity import retry, stop_after_attempt, wait_exponential

from ..core.config import settings

logger = logging.getLogger(__name__)


class OptaConnector:
    """Real-time connector for Opta Sports Data API"""

    BASE_URL = "https://api.performfeeds.com/soccerdata"
    WS_URL = "wss://api.performfeeds.com/soccerdata/stream"

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        """Initialize Opta connector
        
        Args:
            api_key: Opta API key (defaults to OPTA_API_KEY env var)
            api_secret: Opta API secret (defaults to OPTA_API_SECRET env var)
        """
        self.api_key = api_key or getattr(settings, "opta_api_key", None)
        self.api_secret = api_secret or getattr(settings, "opta_api_secret", None)
        self.session: Optional[aiohttp.ClientSession] = None
        self.ws_connection = None
        
        if not self.api_key or not self.api_secret:
            logger.warning("Opta API credentials not configured - connector will not function")

    async def __aenter__(self):
        """Async context manager entry"""
        if self.api_key and self.api_secret:
            self.session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
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
    async def fetch_live_xg(self, match_id: str) -> Optional[Dict]:
        """Fetch live expected goals (xG) data for a match
        
        Args:
            match_id: Opta match identifier
            
        Returns:
            Dictionary with xG data including:
            - Team xG values
            - Shot-level xG
            - xG timeline
            - Pressure maps
        """
        if not self.session:
            logger.warning("Opta session not initialized - call within async context manager")
            return self._mock_xg_data()

        url = f"{self.BASE_URL}/match/{match_id}/xg"
        
        try:
            async with self.session.get(url) as response:
                if response.status == 404:
                    logger.warning(f"Match {match_id} not found in Opta")
                    return None
                
                if response.status == 401:
                    logger.error("Opta API authentication failed - check credentials")
                    return None
                    
                response.raise_for_status()
                data = await response.json()
                
                logger.info(f"Fetched live xG for match {match_id}")
                return self._parse_xg_response(data)
                
        except aiohttp.ClientError as e:
            logger.error(f"Opta API error fetching xG: {e}")
            return None

    def _parse_xg_response(self, data: Dict) -> Dict:
        """Parse Opta xG API response"""
        try:
            return {
                "match_id": data.get("matchId"),
                "home_xg": data.get("homeTeam", {}).get("expectedGoals", 0.0),
                "away_xg": data.get("awayTeam", {}).get("expectedGoals", 0.0),
                "shots": data.get("shots", []),
                "xg_timeline": data.get("xgTimeline", []),
                "pressure_zones": data.get("pressureZones", []),
                "fetched_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error parsing Opta xG response: {e}")
            return {}

    async def fetch_live_stats(self, match_id: str) -> Optional[Dict]:
        """Fetch comprehensive live match statistics
        
        Args:
            match_id: Opta match identifier
            
        Returns:
            Dictionary with:
            - Possession, passes, shots
            - Expected threat (xT)
            - Duels, tackles, interceptions
            - Progressive actions
        """
        if not self.session:
            logger.warning("Opta session not initialized")
            return None

        url = f"{self.BASE_URL}/match/{match_id}/stats"
        
        try:
            async with self.session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
                
                return {
                    "match_id": match_id,
                    "possession": data.get("possession", {}),
                    "passes": data.get("passes", {}),
                    "shots": data.get("shots", {}),
                    "xT": data.get("expectedThreat", {}),
                    "duels": data.get("duels", {}),
                    "fetched_at": datetime.utcnow().isoformat(),
                }
                
        except Exception as e:
            logger.error(f"Error fetching Opta live stats: {e}")
            return None

    async def stream_live_xg(
        self,
        match_ids: List[str],
        callback: Callable[[Dict], None],
    ) -> None:
        """Stream live xG updates via WebSocket
        
        Args:
            match_ids: List of match IDs to stream
            callback: Function to call with each update
        """
        if not self.api_key or not self.api_secret:
            logger.error("Cannot stream without Opta credentials")
            return

        try:
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(
                    self.WS_URL,
                    headers={"Authorization": f"Bearer {self.api_key}"}
                ) as ws:
                    self.ws_connection = ws
                    
                    # Subscribe to matches
                    subscribe_msg = {
                        "action": "subscribe",
                        "matchIds": match_ids,
                        "dataTypes": ["xG", "xT", "shots"]
                    }
                    await ws.send_json(subscribe_msg)
                    logger.info(f"Subscribed to Opta stream for {len(match_ids)} matches")
                    
                    # Process messages
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            callback(data)
                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            logger.error(f"WebSocket error: {ws.exception()}")
                            break
                            
        except Exception as e:
            logger.error(f"Opta WebSocket stream error: {e}")

    def _mock_xg_data(self) -> Dict:
        """Mock xG data for testing without API credentials"""
        return {
            "match_id": "test_match",
            "home_xg": 1.8,
            "away_xg": 1.2,
            "shots": [],
            "xg_timeline": [],
            "pressure_zones": [],
            "fetched_at": datetime.utcnow().isoformat(),
            "mock": True,
        }


if __name__ == "__main__":
    async def test():
        async with OptaConnector() as opta:
            xg_data = await opta.fetch_live_xg("test_match_123")
            print("xG Data:", json.dumps(xg_data, indent=2))
    
    asyncio.run(test())
