"""Narrow validated market odds for the production core engine."""

from pathlib import Path

path = Path("backend/src/services/core_engine.py")
text = path.read_text()
old = '''        odds_values = (market.home_odds, market.draw_odds, market.away_odds)
        if all(_valid_odds(odds) for odds in odds_values):
            raw_implied = {
                "home": 1.0 / market.home_odds,
                "draw": 1.0 / market.draw_odds,
                "away": 1.0 / market.away_odds,
            }
'''
new = '''        odds_values = (market.home_odds, market.draw_odds, market.away_odds)
        if all(_valid_odds(odds) for odds in odds_values):
            home_odds, draw_odds, away_odds = odds_values
            assert home_odds is not None and draw_odds is not None and away_odds is not None
            raw_implied = {
                "home": 1.0 / home_odds,
                "draw": 1.0 / draw_odds,
                "away": 1.0 / away_odds,
            }
'''
if text.count(old) != 1:
    raise RuntimeError("core-engine odds contract no longer matches")
path.write_text(text.replace(old, new, 1))
Path(__file__).unlink()
