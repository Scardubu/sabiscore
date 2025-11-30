"""
SabiScore Data Scrapers
========================

Ethical web scraping infrastructure for football data acquisition.

This module provides scrapers for:
- football-data.co.uk: Historical match data with Pinnacle odds
- Flashscore: Live scores and real-time odds
- OddsPortal: Closing line values from Pinnacle
- Transfermarkt: Player values and injury data
- Understat: xG/xA advanced statistics
- Betfair: Exchange odds for sharp line comparison
- WhoScored: Player ratings and tactical analysis
- Soccerway: League standings and fixtures

All scrapers implement ethical practices:
- Rate limiting (2-8s delays)
- User-agent rotation
- robots.txt compliance
- Local data fallback
- Circuit breaker patterns
"""

from .base_scraper import BaseScraper, USER_AGENTS, DATA_DIR, CACHE_DIR, PROCESSED_DIR
from .football_data_scraper import FootballDataEnhancedScraper
from .betfair_scraper import BetfairExchangeScraper
from .whoscored_scraper import WhoScoredScraper, get_whoscored_stats
from .soccerway_scraper import SoccerwayScraper, get_standings, get_fixtures
from .transfermarkt_scraper import TransfermarktScraper, get_team_value
from .oddsportal_scraper import OddsPortalScraper, get_historical_odds
from .understat_scraper import UnderstatScraper, get_xg_stats
from .flashscore_scraper import FlashscoreScraper, get_live_match

__all__ = [
    # Base
    "BaseScraper",
    "USER_AGENTS",
    "DATA_DIR",
    "CACHE_DIR",
    "PROCESSED_DIR",
    # Scrapers
    "FootballDataEnhancedScraper",
    "BetfairExchangeScraper",
    "WhoScoredScraper",
    "SoccerwayScraper",
    "TransfermarktScraper",
    "OddsPortalScraper",
    "UnderstatScraper",
    "FlashscoreScraper",
    # Convenience functions
    "get_whoscored_stats",
    "get_standings",
    "get_fixtures",
    "get_team_value",
    "get_historical_odds",
    "get_xg_stats",
    "get_live_match",
]
