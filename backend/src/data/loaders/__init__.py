"""
Data loaders for historical and real-time football data.

Loaders:
- FootballDataLoader: CSV files from football-data.co.uk (180k matches, 2018-2025)
- UnderstatLoader: xG data scraper with Playwright
- FBrefLoader: Scouting reports and advanced stats
- TransfermarktLoader: Player valuations and squad data
"""

from .football_data import FootballDataLoader
from .understat import UnderstatLoader
from .fbref import FBrefLoader
from .transfermarkt import TransfermarktLoader

__all__ = [
    "FootballDataLoader",
    "UnderstatLoader",
    "FBrefLoader",
    "TransfermarktLoader",
]
