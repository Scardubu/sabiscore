"""
OddsPortal Historical Odds Scraper
===================================

Scrapes historical odds data and closing lines from OddsPortal.

Features:
- Opening and closing odds
- Odds movement tracking
- Multi-bookmaker comparison
- Historical line movement analysis

Ethical Note:
- Uses local data fallback when available
- Respects rate limits (3 seconds between requests)
- Only scrapes publicly available odds information
"""

import json
import logging
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base_scraper import BaseScraper, CACHE_DIR, PROCESSED_DIR

logger = logging.getLogger(__name__)


class OddsPortalScraper(BaseScraper):
    """
    Scraper for OddsPortal historical odds data.
    
    Provides:
    - Opening and closing odds
    - Line movement analysis
    - Multi-bookmaker comparisons
    - Historical odds trends
    """
    
    BASE_URL = "https://www.oddsportal.com"
    
    # League paths on OddsPortal
    LEAGUE_PATHS = {
        "EPL": "/football/england/premier-league/",
        "La Liga": "/football/spain/laliga/",
        "Serie A": "/football/italy/serie-a/",
        "Bundesliga": "/football/germany/bundesliga/",
        "Ligue 1": "/football/france/ligue-1/",
    }
    
    # Common bookmakers
    BOOKMAKERS = [
        "bet365", "Pinnacle", "Betfair", "Unibet", 
        "William Hill", "888sport", "Betway", "1xBet"
    ]
    
    def __init__(self):
        super().__init__(
            base_url=self.BASE_URL,
            rate_limit_delay=3.0,
            max_retries=3,
            timeout=20
        )
        
        self.cache_dir = CACHE_DIR / "oddsportal"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.local_odds_path = PROCESSED_DIR / "historical_odds.json"
    
    def _fetch_remote(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL"
    ) -> Optional[Dict]:
        """
        Fetch historical odds for a match.
        
        Note: OddsPortal uses JavaScript rendering.
        Full implementation requires Playwright/Selenium.
        """
        logger.info(f"Fetching OddsPortal odds for {home_team} vs {away_team}")
        
        # For development, return simulated historical odds
        return self._simulate_odds_data(home_team, away_team, league)
    
    def _simulate_odds_data(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict:
        """Simulate realistic historical odds data."""
        # Generate opening odds based on perceived team strength
        home_strength = self._estimate_team_strength(home_team)
        away_strength = self._estimate_team_strength(away_team)
        
        # Calculate fair probabilities
        home_prob = (home_strength + 0.1) / (home_strength + away_strength + 0.3)  # Home advantage
        away_prob = away_strength / (home_strength + away_strength + 0.3)
        draw_prob = 1 - home_prob - away_prob
        
        # Convert to decimal odds (with bookmaker margin)
        margin = 1.05  # 5% margin
        home_odds = round(margin / home_prob, 2)
        draw_odds = round(margin / draw_prob, 2)
        away_odds = round(margin / away_prob, 2)
        
        # Simulate odds movement (opening to closing)
        opening_odds = {
            "home": round(home_odds * random.uniform(0.95, 1.05), 2),
            "draw": round(draw_odds * random.uniform(0.95, 1.05), 2),
            "away": round(away_odds * random.uniform(0.95, 1.05), 2),
        }
        
        closing_odds = {
            "home": home_odds,
            "draw": draw_odds,
            "away": away_odds,
        }
        
        # Multi-bookmaker odds
        bookmaker_odds = self._simulate_bookmaker_odds(
            closing_odds, self.BOOKMAKERS
        )
        
        return {
            "match": f"{home_team} vs {away_team}",
            "league": league,
            "date": (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
            "opening_odds": opening_odds,
            "closing_odds": closing_odds,
            "movement": {
                "home": round(closing_odds["home"] - opening_odds["home"], 3),
                "draw": round(closing_odds["draw"] - opening_odds["draw"], 3),
                "away": round(closing_odds["away"] - opening_odds["away"], 3),
            },
            "bookmaker_odds": bookmaker_odds,
            "best_odds": self._find_best_odds(bookmaker_odds),
            "average_odds": self._calculate_average_odds(bookmaker_odds),
            "implied_probabilities": {
                "home": round(1 / closing_odds["home"], 3),
                "draw": round(1 / closing_odds["draw"], 3),
                "away": round(1 / closing_odds["away"], 3),
            },
            "overround": round(
                (1/closing_odds["home"] + 1/closing_odds["draw"] + 1/closing_odds["away"]) * 100 - 100, 
                2
            ),
            "timestamp": datetime.now().isoformat(),
            "source": "oddsportal",
            "simulated": True,
        }
    
    def _estimate_team_strength(self, team: str) -> float:
        """Estimate team strength (0-1 scale)."""
        top_teams = {
            "Man City": 0.95, "Arsenal": 0.90, "Liverpool": 0.88,
            "Chelsea": 0.82, "Tottenham": 0.78, "Man United": 0.75,
            "Newcastle": 0.75, "Aston Villa": 0.72,
            "Real Madrid": 0.95, "Barcelona": 0.90, "Atletico Madrid": 0.82,
            "Bayern Munich": 0.95, "Dortmund": 0.82,
            "PSG": 0.92, "Inter": 0.85, "Juventus": 0.82,
        }
        
        for known_team, strength in top_teams.items():
            if known_team.lower() in team.lower() or team.lower() in known_team.lower():
                return strength
        
        return random.uniform(0.5, 0.7)  # Default for unknown teams
    
    def _simulate_bookmaker_odds(
        self,
        base_odds: Dict[str, float],
        bookmakers: List[str]
    ) -> Dict[str, Dict[str, float]]:
        """Simulate odds across multiple bookmakers."""
        result = {}
        
        for bookie in bookmakers:
            # Each bookmaker varies slightly
            variance = random.uniform(-0.08, 0.08)
            result[bookie] = {
                "home": round(base_odds["home"] * (1 + variance), 2),
                "draw": round(base_odds["draw"] * (1 + random.uniform(-0.05, 0.05)), 2),
                "away": round(base_odds["away"] * (1 - variance), 2),  # Inverse correlation
            }
        
        return result
    
    def _find_best_odds(
        self,
        bookmaker_odds: Dict[str, Dict[str, float]]
    ) -> Dict[str, Dict]:
        """Find best odds across bookmakers."""
        best = {
            "home": {"odds": 0, "bookmaker": ""},
            "draw": {"odds": 0, "bookmaker": ""},
            "away": {"odds": 0, "bookmaker": ""},
        }
        
        for bookie, odds in bookmaker_odds.items():
            for outcome in ["home", "draw", "away"]:
                if odds[outcome] > best[outcome]["odds"]:
                    best[outcome]["odds"] = odds[outcome]
                    best[outcome]["bookmaker"] = bookie
        
        return best
    
    def _calculate_average_odds(
        self,
        bookmaker_odds: Dict[str, Dict[str, float]]
    ) -> Dict[str, float]:
        """Calculate average odds across bookmakers."""
        totals = {"home": 0, "draw": 0, "away": 0}
        count = len(bookmaker_odds)
        
        for bookie_odds in bookmaker_odds.values():
            for outcome in totals:
                totals[outcome] += bookie_odds[outcome]
        
        return {k: round(v / count, 2) for k, v in totals.items()}
    
    def _parse_data(self, content: Dict) -> Dict:
        """Parse odds data."""
        return content
    
    def get_match_odds(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL"
    ) -> Optional[Dict]:
        """
        Get historical odds for a match.
        
        Args:
            home_team: Home team name
            away_team: Away team name
            league: League identifier
            
        Returns:
            Dict with opening/closing odds, movement, best odds
        """
        return self.fetch_data(home_team, away_team, league)
    
    def get_odds_movement(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL"
    ) -> Dict[str, float]:
        """
        Get odds movement (opening to closing).
        
        Positive = odds drifted (less likely)
        Negative = odds shortened (more likely)
        """
        data = self.get_match_odds(home_team, away_team, league)
        if data:
            return data.get("movement", {})
        return {}
    
    def calculate_odds_features(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL"
    ) -> Dict[str, float]:
        """
        Calculate odds-based features for prediction.
        
        Returns features like:
        - Implied probabilities
        - Odds movement signals
        - Market confidence
        """
        data = self.get_match_odds(home_team, away_team, league)
        if not data:
            return {}
        
        closing = data.get("closing_odds", {})
        probs = data.get("implied_probabilities", {})
        movement = data.get("movement", {})
        
        return {
            "odds_home": closing.get("home", 2.0),
            "odds_draw": closing.get("draw", 3.5),
            "odds_away": closing.get("away", 3.0),
            "prob_home": probs.get("home", 0.33),
            "prob_draw": probs.get("draw", 0.33),
            "prob_away": probs.get("away", 0.33),
            "movement_home": movement.get("home", 0),
            "movement_away": movement.get("away", 0),
            "overround": data.get("overround", 5.0),
            "market_confidence": round(1 / max(data.get("overround", 5), 0.1), 3),
        }


# Convenience function
def get_historical_odds(
    home_team: str,
    away_team: str,
    league: str = "EPL"
) -> Optional[Dict]:
    """Get historical odds from OddsPortal."""
    return OddsPortalScraper().get_match_odds(home_team, away_team, league)
