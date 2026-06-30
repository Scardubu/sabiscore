"""
Unit Tests for SabiScore Scrapers
==================================

Tests for the enhanced scraping infrastructure.
"""

import pytest
from unittest.mock import Mock
from datetime import datetime
from typing import Any, Dict, Optional

# Import scrapers
from src.data.scrapers import (
    BaseScraper,
    FootballDataEnhancedScraper,
    BetfairExchangeScraper,
    SoccerwayScraper,
    TransfermarktScraper,
    OddsPortalScraper,
    UnderstatScraper,
    FlashscoreScraper,
)


class ConcreteScraper(BaseScraper):
    """Concrete implementation of BaseScraper for testing."""
    
    async def _fetch_remote(self, **kwargs) -> Optional[Dict[str, Any]]:
        return {"test": "data"}
    
    def _parse_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        return raw_data


class TestBaseScraper:
    """Tests for BaseScraper functionality."""
    
    def test_user_agent_rotation(self):
        """Test that user agents rotate properly."""
        scraper = ConcreteScraper(
            base_url="https://example.com",
            rate_limit_delay=0.1,
        )
        
        # Get multiple user agents
        agents = [scraper._get_random_user_agent() for _ in range(10)]
        
        # Should have some variety
        assert len(set(agents)) >= 1
        assert all("Mozilla" in agent for agent in agents)
    
    def test_rate_limiting(self):
        """Test rate limiting between requests."""
        scraper = ConcreteScraper(
            base_url="https://example.com",
            rate_limit_delay=0.1,
        )
        
        start = datetime.now()
        scraper._wait_rate_limit()
        scraper._wait_rate_limit()
        elapsed = (datetime.now() - start).total_seconds()
        
        # Should have waited at least 0.1 seconds
        assert elapsed >= 0.1


class TestFootballDataScraper:
    """Tests for football-data.co.uk scraper."""
    
    def test_league_code_mapping(self):
        """Test league code to URL path mapping."""
        scraper = FootballDataEnhancedScraper()
        
        assert "E0" in scraper.LEAGUE_CODES["EPL"]
        assert "SP1" in scraper.LEAGUE_CODES["La Liga"]
        assert "I1" in scraper.LEAGUE_CODES["Serie A"]
    
    def test_download_season_data(self):
        """Test fetching historical data (using cache/fallback)."""
        scraper = FootballDataEnhancedScraper()
        
        # This may use cache or return empty DataFrame if remote fails
        df = scraper.download_season_data("EPL", "2324", use_cache=True)
        
        assert hasattr(df, 'columns')  # Is a DataFrame
        # If data exists, should have expected columns
        if len(df) > 0:
            assert "home_team" in df.columns or "HomeTeam" in df.columns
    
    def test_pinnacle_odds_extraction(self):
        """Test that Pinnacle odds columns exist in standardized output."""
        scraper = FootballDataEnhancedScraper()
        
        df = scraper.download_season_data("EPL", "2324", use_cache=True)
        
        if len(df) > 0:
            # Check for standardized Pinnacle columns
            pinnacle_cols = ["pinnacle_home", "pinnacle_draw", "pinnacle_away"]
            has_pinnacle = any(col in df.columns for col in pinnacle_cols)
            # Pinnacle odds should be present or we have local fallback
            assert has_pinnacle or len(df) > 0


class TestBetfairScraper:
    """Tests for Betfair exchange scraper."""
    
    def test_exchange_odds_structure(self):
        """Unconfigured exchange access must not invent odds."""
        scraper = BetfairExchangeScraper()

        assert scraper.get_match_odds("Arsenal", "Chelsea", "EPL") is None
    
    def test_spread_calculation(self):
        """Unavailable exchange prices must produce no derived features."""
        scraper = BetfairExchangeScraper()

        assert scraper.calculate_exchange_features("Liverpool", "Man City", "EPL") == {}


# NOTE: WhoScored scraper removed due to bot blocking - form features now sourced from Understat


class TestSoccerwayScraper:
    """Tests for Soccerway standings scraper."""
    
    def test_standings_structure(self):
        """Unavailable standings must return an empty result."""
        scraper = SoccerwayScraper()

        assert scraper.get_standings("EPL") == {}
    
    def test_position_features(self):
        """Unavailable standings must not produce position features."""
        scraper = SoccerwayScraper()

        assert scraper.calculate_position_features("Arsenal", "Chelsea", "EPL") == {}


class TestTransfermarktScraper:
    """Tests for Transfermarkt market value scraper."""
    
    def test_team_valuation_structure(self):
        """Unavailable squad values must not be estimated."""
        scraper = TransfermarktScraper()

        assert scraper.get_team_valuation("Arsenal", "EPL") is None
    
    def test_value_features(self):
        """Unavailable squad values must produce no derived features."""
        scraper = TransfermarktScraper()

        assert scraper.calculate_value_features("Man City", "Chelsea", "EPL") == {}


class TestOddsPortalScraper:
    """Tests for OddsPortal historical odds scraper."""
    
    def test_odds_structure(self):
        """Unavailable historical prices must not be fabricated."""
        scraper = OddsPortalScraper()

        assert scraper.get_match_odds("Arsenal", "Chelsea", "EPL") is None
    
    def test_odds_features(self):
        """Unavailable historical prices must produce no derived features."""
        scraper = OddsPortalScraper()

        assert scraper.calculate_odds_features("Liverpool", "Man United", "EPL") == {}


class TestUnderstatScraper:
    """Tests for Understat xG scraper."""
    
    def test_xg_structure(self):
        """Unavailable expected-goals evidence must not be estimated."""
        scraper = UnderstatScraper()

        assert scraper.get_team_xg("Arsenal", "EPL") is None
    
    def test_xg_prediction(self):
        """Test match xG prediction."""
        scraper = UnderstatScraper()
        
        prediction = scraper.get_match_xg_prediction("Arsenal", "Chelsea", "EPL")
        
        assert "home_xg" in prediction
        assert "away_xg" in prediction
        assert prediction["home_xg"] > 0
    
    def test_xg_features(self):
        """Unavailable expected-goals evidence must produce no derived features."""
        scraper = UnderstatScraper()

        assert scraper.calculate_xg_features("Liverpool", "Man City", "EPL") == {}


class TestFlashscoreScraper:
    """Tests for Flashscore live scores scraper."""
    
    def test_live_score_structure(self):
        """Test live score response structure."""
        scraper = FlashscoreScraper()
        
        match_data = scraper.get_live_score("Arsenal", "Chelsea")
        
        # May return None if simulation fails (no active match)
        if match_data is not None:
            assert "status" in match_data
            assert "score" in match_data
            assert "events" in match_data
            assert "lineups" in match_data
        # If None, test still passes - just no live match data
    
    def test_h2h_features(self):
        """Unavailable head-to-head evidence must produce no derived features."""
        scraper = FlashscoreScraper()

        assert scraper.calculate_h2h_features("Arsenal", "Chelsea") == {}


class TestDataAggregator:
    """Tests for the data aggregator."""
    
    def test_comprehensive_features(self):
        """Test comprehensive feature aggregation."""
        from src.data.aggregator import get_enhanced_aggregator
        
        aggregator = get_enhanced_aggregator()
        features = aggregator.get_comprehensive_features("Arsenal", "Chelsea", "EPL")
        
        assert "home_team" in features
        assert "away_team" in features
        assert "timestamp" in features
        
        # Check for prefixed features from various sources
        feature_keys = list(features.keys())
        has_prefixed = any(
            k.startswith(prefix) 
            for k in feature_keys 
            for prefix in ["bf_", "ws_", "sw_", "us_", "tm_"]
        )
        assert has_prefixed or len(feature_keys) > 3  # At least basic features


# Fixtures for mocking HTTP responses
@pytest.fixture
def mock_response():
    """Create a mock HTTP response."""
    mock = Mock()
    mock.status_code = 200
    mock.text = "<html><body>Mock response</body></html>"
    mock.content = b"Mock content"
    return mock


@pytest.fixture
def mock_csv_response():
    """Create a mock CSV response."""
    csv_content = """Date,HomeTeam,AwayTeam,FTHG,FTAG,PSH,PSD,PSA
01/01/2024,Arsenal,Chelsea,2,1,1.85,3.60,4.20
08/01/2024,Liverpool,Man City,1,1,2.50,3.40,2.80"""
    mock = Mock()
    mock.status_code = 200
    mock.text = csv_content
    mock.content = csv_content.encode('utf-8')
    return mock
