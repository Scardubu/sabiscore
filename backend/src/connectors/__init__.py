"""
Real-time data connectors for live match data and odds streams
"""

from .opta import OptaConnector
from .betfair import BetfairConnector
from .pinnacle import PinnacleConnector

__all__ = [
    "OptaConnector",
    "BetfairConnector",
    "PinnacleConnector",
]
