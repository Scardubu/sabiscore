import pandas as pd
import pytest

from src.data.transformers import FEATURE_DEFAULTS, FeatureTransformer


def _base_features() -> pd.DataFrame:
    return pd.DataFrame([FEATURE_DEFAULTS]).copy()


def test_apply_enhanced_features_overrides_xg_values():
    transformer = FeatureTransformer()
    features = _base_features()
    match_data = {
        "enhanced_features": {
            "us_home_xg_pg": 1.85,
            "us_away_xg_pg": 1.05,
            "us_home_xg_diff": 0.9,
            "us_away_xg_diff": -0.2,
            "us_home_recent_xg": 1.80,
            "us_away_recent_xg": 1.00,
        }
    }

    updated = transformer._apply_enhanced_features(features, match_data)
    idx = updated.index[0]

    assert updated.at[idx, "home_xg_avg_5"] == pytest.approx(1.85)
    assert updated.at[idx, "away_xg_avg_5"] == pytest.approx(1.05)
    assert updated.at[idx, "xg_differential"] == pytest.approx(1.1)
    assert 0.0 <= updated.at[idx, "home_xg_consistency"] <= 1.0
    assert 0.0 <= updated.at[idx, "away_xg_consistency"] <= 1.0


def test_apply_enhanced_features_handles_whoscored_and_transfermarkt():
    transformer = FeatureTransformer()
    features = _base_features()
    match_data = {
        "enhanced_features": {
            "ws_home_avg_possession": 62.5,
            "ws_away_avg_possession": 47.2,
            "ws_home_win_rate_5": 0.78,
            "ws_away_win_rate_5": 0.34,
            "tm_value_diff_m": 120.0,
            "bf_market_margin_pct": 4.5,
        }
    }

    updated = transformer._apply_enhanced_features(features, match_data)
    idx = updated.index[0]

    assert updated.at[idx, "home_possession_style"] == pytest.approx(0.625)
    assert updated.at[idx, "away_possession_style"] == pytest.approx(0.472)
    assert updated.at[idx, "home_win_rate_5"] == pytest.approx(0.78)
    assert updated.at[idx, "away_win_rate_5"] == pytest.approx(0.34)
    assert updated.at[idx, "squad_value_diff"] == pytest.approx(120.0)
    assert updated.at[idx, "bookmaker_margin"] == pytest.approx(0.045)


def test_apply_enhanced_features_uses_betfair_back_prices_for_odds():
    transformer = FeatureTransformer()
    features = _base_features()
    match_data = {
        "enhanced_features": {
            "bf_home_back": 1.9,
            "bf_draw_back": 3.5,
            "bf_away_back": 4.2,
        }
    }

    updated = transformer._apply_enhanced_features(features, match_data)
    idx = updated.index[0]

    implied_home = 1 / 1.9
    implied_draw = 1 / 3.5
    implied_away = 1 / 4.2
    total = implied_home + implied_draw + implied_away

    assert updated.at[idx, "home_implied_prob"] == pytest.approx(implied_home / total)
    assert updated.at[idx, "bookmaker_margin"] == pytest.approx(total - 1, abs=1e-6)
