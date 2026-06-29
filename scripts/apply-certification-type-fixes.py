from pathlib import Path
import ast

soccerway = Path("backend/src/data/scrapers/soccerway_scraper.py")
source = soccerway.read_text()
old = '''    def _unavailable_data(
        self,
        data_type: str,
        league: str
    ) -> Dict:
        raise RuntimeError("Synthetic scraper fallback removed; verified source data required")
'''
new = '''    def _unavailable_data(
        self,
        data_type: str,
        league: str
    ) -> Dict:
        logger.warning("Soccerway data unavailable for %s (%s)", league, data_type)
        return {}
'''
if source.count(old) != 1:
    raise RuntimeError("Soccerway unavailable-result contract changed")
soccerway.write_text(source.replace(old, new, 1))

test_path = Path("backend/tests/test_scrapers.py")
source = test_path.read_text()
replacements = {
    "test_exchange_odds_structure": '''    def test_exchange_odds_structure(self):
        """Unconfigured exchange access must not invent odds."""
        scraper = BetfairExchangeScraper()

        assert scraper.get_match_odds("Arsenal", "Chelsea", "EPL") is None
''',
    "test_spread_calculation": '''    def test_spread_calculation(self):
        """Unavailable exchange prices must produce no derived features."""
        scraper = BetfairExchangeScraper()

        assert scraper.calculate_exchange_features("Liverpool", "Man City", "EPL") == {}
''',
    "test_standings_structure": '''    def test_standings_structure(self):
        """Unavailable standings must return an empty result."""
        scraper = SoccerwayScraper()

        assert scraper.get_standings("EPL") == {}
''',
    "test_position_features": '''    def test_position_features(self):
        """Unavailable standings must not produce position features."""
        scraper = SoccerwayScraper()

        assert scraper.calculate_position_features("Arsenal", "Chelsea", "EPL") == {}
''',
    "test_team_valuation_structure": '''    def test_team_valuation_structure(self):
        """Unavailable squad values must not be estimated."""
        scraper = TransfermarktScraper()

        assert scraper.get_team_valuation("Arsenal", "EPL") is None
''',
    "test_value_features": '''    def test_value_features(self):
        """Unavailable squad values must produce no derived features."""
        scraper = TransfermarktScraper()

        assert scraper.calculate_value_features("Man City", "Chelsea", "EPL") == {}
''',
    "test_odds_structure": '''    def test_odds_structure(self):
        """Unavailable historical prices must not be fabricated."""
        scraper = OddsPortalScraper()

        assert scraper.get_match_odds("Arsenal", "Chelsea", "EPL") is None
''',
    "test_odds_features": '''    def test_odds_features(self):
        """Unavailable historical prices must produce no derived features."""
        scraper = OddsPortalScraper()

        assert scraper.calculate_odds_features("Liverpool", "Man United", "EPL") == {}
''',
    "test_xg_structure": '''    def test_xg_structure(self):
        """Unavailable expected-goals evidence must not be estimated."""
        scraper = UnderstatScraper()

        assert scraper.get_team_xg("Arsenal", "EPL") is None
''',
    "test_xg_features": '''    def test_xg_features(self):
        """Unavailable expected-goals evidence must produce no derived features."""
        scraper = UnderstatScraper()

        assert scraper.calculate_xg_features("Liverpool", "Man City", "EPL") == {}
''',
    "test_h2h_features": '''    def test_h2h_features(self):
        """Unavailable head-to-head evidence must produce no derived features."""
        scraper = FlashscoreScraper()

        assert scraper.calculate_h2h_features("Arsenal", "Chelsea") == {}
''',
}

tree = ast.parse(source)
lines = source.splitlines(keepends=True)
found: set[str] = set()
for node in sorted(
    (
        item
        for item in ast.walk(tree)
        if isinstance(item, ast.FunctionDef) and item.name in replacements
    ),
    key=lambda item: item.lineno,
    reverse=True,
):
    if node.end_lineno is None:
        raise RuntimeError(f"Cannot rewrite test method {node.name}")
    lines[node.lineno - 1 : node.end_lineno] = [replacements[node.name]]
    found.add(node.name)

missing = set(replacements) - found
if missing:
    raise RuntimeError(f"Missing scraper tests: {sorted(missing)}")
test_path.write_text("".join(lines))
Path(__file__).unlink()
