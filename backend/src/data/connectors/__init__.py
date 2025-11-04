"""
Real-time API connectors for live match data

APIs:
- ESPN: Live scores and match updates (8s latency)
- Opta: Live xG and event data
- Betfair: 1-second odds stream
- Pinnacle: WebSocket for closing lines
"""

from .espn import ESPNConnector
from .opta import OptaConnector
from .betfair import BetfairConnector
from .pinnacle import PinnacleConnector

__all__ = [
    "ESPNConnector",
    "OptaConnector",
    "BetfairConnector",
    "PinnacleConnector",
]
