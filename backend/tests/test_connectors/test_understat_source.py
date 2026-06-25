"""Tests for backend/src/connectors/understat_source.py.

Only exercises the parts that need no network / no soccerdata install:
the pure ``rolling_xg_features`` static method and team-name resolution.

Run:
    cd backend && pytest tests/test_connectors/test_understat_source.py -v
"""

from __future__ import annotations

import pandas as pd
import pytest

from src.connectors.understat_source import UnderstatTeamXGSource, _resolve_team_name


# ---------------------------------------------------------------------------
# _resolve_team_name
# ---------------------------------------------------------------------------


class TestResolveTeamName:
    def test_exact_match(self):
        assert _resolve_team_name("Arsenal", ["Arsenal", "Chelsea"]) == "Arsenal"

    def test_case_insensitive_fallback(self):
        assert _resolve_team_name("arsenal", ["Arsenal", "Chelsea"]) == "Arsenal"

    def test_no_match_returns_none(self):
        assert _resolve_team_name("Barcelona", ["Arsenal", "Chelsea"]) is None

    def test_empty_candidates_returns_none(self):
        assert _resolve_team_name("Arsenal", []) is None


# ---------------------------------------------------------------------------
# rolling_xg_features
# ---------------------------------------------------------------------------


class TestRollingXgFeatures:
    @pytest.fixture
    def shuffled_matches(self) -> pd.DataFrame:
        """Three Arsenal matches deliberately out of date order."""
        return pd.DataFrame(
            [
                {"date": "2025-09-01", "home_team": "Arsenal", "away_team": "C", "home_xg": 3.0, "away_xg": 0.5},
                {"date": "2025-08-01", "home_team": "Arsenal", "away_team": "A", "home_xg": 1.0, "away_xg": 1.0},
                {"date": "2025-08-15", "home_team": "Arsenal", "away_team": "B", "home_xg": 2.0, "away_xg": 0.8},
            ]
        )

    def test_missing_columns_raises(self):
        with pytest.raises(ValueError, match="missing columns"):
            UnderstatTeamXGSource.rolling_xg_features(pd.DataFrame([{"home_team": "X"}]))

    def test_sorts_by_date_before_rolling(self, shuffled_matches):
        """match_order must follow chronological date, not input row order."""
        rollups = UnderstatTeamXGSource.rolling_xg_features(shuffled_matches, window=5)
        arsenal = rollups[rollups["team"] == "Arsenal"].sort_values("match_order")
        # Chronological xG_for sequence should be 1.0 (Aug 1), 2.0 (Aug 15), 3.0 (Sep 1)
        assert list(arsenal["xg_for"]) == [1.0, 2.0, 3.0]

    def test_shift_one_prevents_leakage(self, shuffled_matches):
        """First chronological match has no prior data → rolling NaN."""
        rollups = UnderstatTeamXGSource.rolling_xg_features(shuffled_matches, window=5)
        arsenal = rollups[rollups["team"] == "Arsenal"].sort_values("match_order")
        # min_periods=2 + shift(1): first two rows can't have a value.
        assert pd.isna(arsenal.iloc[0]["rolling_xg_for"])
        assert pd.isna(arsenal.iloc[1]["rolling_xg_for"])
        # Third row averages the first two *prior* matches: (1.0 + 2.0)/2 = 1.5
        assert arsenal.iloc[2]["rolling_xg_for"] == pytest.approx(1.5)

    def test_falls_back_to_input_order_without_date(self):
        matches = pd.DataFrame(
            [
                {"home_team": "Arsenal", "away_team": "A", "home_xg": 1.0, "away_xg": 1.0},
                {"home_team": "Arsenal", "away_team": "B", "home_xg": 2.0, "away_xg": 0.8},
            ]
        )
        rollups = UnderstatTeamXGSource.rolling_xg_features(matches)
        arsenal = rollups[rollups["team"] == "Arsenal"].sort_values("match_order")
        assert list(arsenal["xg_for"]) == [1.0, 2.0]

    def test_match_order_is_one_indexed(self, shuffled_matches):
        rollups = UnderstatTeamXGSource.rolling_xg_features(shuffled_matches)
        assert rollups["match_order"].min() == 1
