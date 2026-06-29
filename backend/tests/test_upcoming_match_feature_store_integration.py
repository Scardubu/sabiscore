from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from src.models.feature_registry import CANONICAL_FEATURES_58, DEFAULT_FEATURE_VALUES_58
from src.services.scraped_feature_store import ScrapedTeamForm
from src.services.upcoming_match_feature_service import (
    UpcomingMatchFeatureProjector,
    _canonical_form_features,
)


def test_canonical_form_mapping_is_side_specific() -> None:
    stats = {
        "ppg_5": 2.0,
        "wins_5": 3.0,
        "draws_5": 1.0,
        "losses_5": 1.0,
        "goals_for_avg_5": 1.8,
        "goals_against_avg_5": 0.8,
        "gd_avg_5": 1.0,
    }
    assert _canonical_form_features(stats, "home")["home_form_last5_home"] == 2.0
    assert _canonical_form_features(stats, "away")["away_goals_against_avg"] == 0.8


@pytest.mark.asyncio
async def test_projector_uses_scraped_form_only_when_database_history_is_missing() -> None:
    projector = UpcomingMatchFeatureProjector.__new__(UpcomingMatchFeatureProjector)
    projector.canonical_features = list(CANONICAL_FEATURES_58)
    projector.defaults = dict(DEFAULT_FEATURE_VALUES_58)
    projector._get_team_id_by_name = AsyncMock(side_effect=[None, None])
    projector._get_team_stats = AsyncMock(side_effect=[None, None])

    records = {
        "Arsenal": ScrapedTeamForm(
            team="Arsenal", matches_sampled=5, ppg=2.0, wins=3, draws=1, losses=1,
            goals_for_avg=1.8, goals_against_avg=0.8, goal_difference_avg=1.0,
            latest_match_date=datetime(2024, 8, 30, tzinfo=timezone.utc),
            source_file=Path("team-form-EPL-2425.json"),
        ),
        "Chelsea": ScrapedTeamForm(
            team="Chelsea", matches_sampled=5, ppg=1.4, wins=2, draws=1, losses=2,
            goals_for_avg=1.2, goals_against_avg=1.4, goal_difference_avg=-0.2,
            latest_match_date=datetime(2024, 8, 29, tzinfo=timezone.utc),
            source_file=Path("team-form-EPL-2425.json"),
        ),
    }

    class Store:
        def get_team_form(self, *, team, **_kwargs):
            return records.get(team)

    projector.scraped_form_store = Store()
    match_date = datetime(2024, 9, 1, tzinfo=timezone.utc)
    result = await projector.project_match_features(
        {
            "id": "fixture-1",
            "home_team": "Arsenal",
            "away_team": "Chelsea",
            "league": "EPL",
        },
        db=object(),
        match_date=match_date,
    )

    assert result["features_dict"]["home_form_last5_home"] == 2.0
    assert result["features_dict"]["away_form_last5_away"] == 1.4
    assert result["features_dict"]["total_goals_expected"] == 3.0
    assert result["data_quality"]["is_synthetic"] is False
    assert result["data_quality"]["feature_sources"] == {
        "home_form": "node-scraper:team-form-EPL-2425.json",
        "away_form": "node-scraper:team-form-EPL-2425.json",
    }
    assert "home_form_last5_home" not in result["data_gaps"]
    assert "away_form_last5_away" not in result["data_gaps"]
    assert "market_prob_home" in result["data_gaps"]
