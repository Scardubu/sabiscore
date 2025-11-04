"""
Betfair Exchange API Connector
Real-time betting odds with 1-second latency via Stream API

Requires Betfair credentials (set in environment):
- BETFAIR_APP_KEY
- BETFAIR_SESSION_TOKEN
- BETFAIR_CERT_PATH (for certificate authentication)
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


class BetfairConnector:
    """Real-time connector for Betfair Exchange Stream API"""

    API_URL = "https://api.betfair.com/exchange/betting/rest/v1.0"
    STREAM_URL = "https://stream-api.betfair.com/api"

    def __init__(
        self,
        app_key: Optional[str] = None,
        session_token: Optional[str] = None,
    ):
        """Initialize Betfair connector
        
        Args:
            app_key: Betfair application key
            session_token: Betfair session token
        """
        self.app_key = app_key or getattr(settings, "betfair_app_key", None)
        self.session_token = session_token or getattr(settings, "betfair_session_token", None)
        self.session: Optional[aiohttp.ClientSession] = None
        self.ws_connection = None

        if not self.app_key or not self.session_token:
            logger.warning("Betfair credentials not configured - connector will not function")

    async def __aenter__(self):
        """Async context manager entry"""
        if self.app_key and self.session_token:
            self.session = aiohttp.ClientSession(
                headers={
                    "X-Application": self.app_key,
                    "X-Authentication": self.session_token,
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
    async def fetch_market_odds(self, market_id: str) -> Optional[Dict]:
        """Fetch current odds for a market
        
        Args:
            market_id: Betfair market identifier
            
        Returns:
            Dictionary with:
            - Back/lay prices and volumes
            - Last traded price
            - Total matched volume
            - Market status
        """
        if not self.session:
            logger.warning("Betfair session not initialized")
            return self._mock_odds_data()

        url = f"{self.API_URL}/listMarketBook/"
        payload = {
            "marketIds": [market_id],
            "priceProjection": {
                "priceData": ["EX_BEST_OFFERS", "EX_TRADED"],
                "virtualise": False,
            }
        }

        try:
            async with self.session.post(url, json=payload) as response:
                if response.status == 401:
                    logger.error("Betfair authentication failed - check credentials")
                    return None
                    
                response.raise_for_status()
                data = await response.json()
                
                if data and len(data) > 0:
                    market = data[0]
                    return self._parse_market_book(market)
                    
                return None
                
        except Exception as e:
            logger.error(f"Betfair API error: {e}")
            return None

    def _parse_market_book(self, market: Dict) -> Dict:
        """Parse Betfair market book response"""
        try:
            runners = []
            for runner in market.get("runners", []):
                runner_data = {
                    "selection_id": runner.get("selectionId"),
                    "status": runner.get("status"),
                    "last_price_traded": runner.get("lastPriceTraded"),
                    "total_matched": runner.get("totalMatched"),
                }
                
                # Extract best available prices
                ex = runner.get("ex", {})
                runner_data["back_prices"] = ex.get("availableToBack", [])
                runner_data["lay_prices"] = ex.get("availableToLay", [])
                
                runners.append(runner_data)

            return {
                "market_id": market.get("marketId"),
                "status": market.get("status"),
                "inplay": market.get("inplay", False),
                "total_matched": market.get("totalMatched"),
                "runners": runners,
                "fetched_at": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error parsing Betfair market book: {e}")
            return {}

    async def search_football_markets(
        self,
        event_name: str,
        market_type: str = "MATCH_ODDS"
    ) -> List[Dict]:
        """Search for football markets by event name
        
        Args:
            event_name: Match name (e.g., "Arsenal v Liverpool")
            market_type: Market type (MATCH_ODDS, OVER_UNDER_25, etc.)
            
        Returns:
            List of matching markets with IDs
        """
        if not self.session:
            logger.warning("Betfair session not initialized")
            return []

        url = f"{self.API_URL}/listMarketCatalogue/"
        payload = {
            "filter": {
                "eventTypeIds": ["1"],  # 1 = Football/Soccer
                "marketTypeCodes": [market_type],
                "textQuery": event_name,
            },
            "maxResults": 10,
            "marketProjection": ["MARKET_START_TIME", "RUNNER_DESCRIPTION"],
        }

        try:
            async with self.session.post(url, json=payload) as response:
                response.raise_for_status()
                markets = await response.json()
                
                logger.info(f"Found {len(markets)} markets for '{event_name}'")
                return markets
                
        except Exception as e:
            logger.error(f"Error searching Betfair markets: {e}")
            return []

    async def stream_odds(
        self,
        market_ids: List[str],
        callback: Callable[[Dict], None],
    ) -> None:
        """Stream real-time odds updates via Betfair Stream API
        
        Args:
            market_ids: List of market IDs to stream
            callback: Function to call with each odds update (receives Dict)
        """
        if not self.app_key or not self.session_token:
            logger.error("Cannot stream without Betfair credentials")
            return

        try:
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(self.STREAM_URL) as ws:
                    self.ws_connection = ws
                    
                    # Authenticate
                    auth_msg = {
                        "op": "authentication",
                        "appKey": self.app_key,
                        "session": self.session_token,
                    }
                    await ws.send_json(auth_msg)
                    
                    # Subscribe to markets
                    subscribe_msg = {
                        "op": "marketSubscription",
                        "marketIds": market_ids,
                        "marketDataFilter": {
                            "fields": ["EX_BEST_OFFERS", "EX_TRADED_VOL"],
                        },
                    }
                    await ws.send_json(subscribe_msg)
                    logger.info(f"Subscribed to Betfair stream for {len(market_ids)} markets")
                    
                    # Process streaming messages
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            if data.get("op") == "mcm":  # Market change message
                                for market_change in data.get("mc", []):
                                    callback(market_change)
                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            logger.error(f"WebSocket error: {ws.exception()}")
                            break
                            
        except Exception as e:
            logger.error(f"Betfair stream error: {e}")

    def calculate_implied_probability(self, back_price: float, lay_price: float) -> float:
        """Calculate true implied probability from back/lay prices
        
        Args:
            back_price: Best available back (bet on) price
            lay_price: Best available lay (bet against) price
            
        Returns:
            Implied probability (0.0 to 1.0)
        """
        if back_price <= 1.0 or lay_price <= 1.0:
            return 0.0
        
        # Mid-price (removes bookmaker margin)
        mid_price = (back_price + lay_price) / 2
        return 1.0 / mid_price

    def _mock_odds_data(self) -> Dict:
        """Mock odds data for testing without API credentials"""
        return {
            "market_id": "test_market",
            "status": "OPEN",
            "inplay": True,
            "total_matched": 250000.0,
            "runners": [
                {
                    "selection_id": 123,
                    "status": "ACTIVE",
                    "last_price_traded": 2.10,
                    "total_matched": 100000.0,
                    "back_prices": [{"price": 2.08, "size": 500}],
                    "lay_prices": [{"price": 2.12, "size": 450}],
                },
                {
                    "selection_id": 124,
                    "status": "ACTIVE",
                    "last_price_traded": 3.50,
                    "total_matched": 75000.0,
                    "back_prices": [{"price": 3.45, "size": 300}],
                    "lay_prices": [{"price": 3.55, "size": 320}],
                },
            ],
            "fetched_at": datetime.utcnow().isoformat(),
            "mock": True,
        }


if __name__ == "__main__":
    async def test():
        async with BetfairConnector() as betfair:
            markets = await betfair.search_football_markets("Manchester City")
            print(f"Found {len(markets)} markets")
            
            if markets:
                odds = await betfair.fetch_market_odds(markets[0]["marketId"])
                print("Odds:", json.dumps(odds, indent=2))
    
    asyncio.run(test())
