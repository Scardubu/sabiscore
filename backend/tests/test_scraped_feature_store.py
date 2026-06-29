from __future__ import annotations

import json
from datetime import datetime, timezone

from src.services.scraped_feature_store import ScrapedTeamFormStore


def test_loads_real_team_form_before_cutoff(tmp_path):
    payload = [{
        "source": "football-data-csv", "team": "Arsenal", "matches_sampled": 3,
        "ppg": 2.0, "wins": 2, "draws": 0, "losses": 1,
        "goals_for_avg": 1.67, "goals_against_avg": 0.67,
        "goal_difference_avg": 1.0, "latest_match_date": "30/08/2024", "recent": [],
    }]
    path = tmp_path / "team-form-EPL-2425.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    record = ScrapedTeamFormStore(tmp_path).get_team_form(
        competition="EPL", team="arsenal",
        information_cutoff=datetime(2024, 9, 1, tzinfo=timezone.utc),
    )
    assert record is not None
    assert record.ppg == 2.0
    assert record.to_projection_stats()["wins_5"] == 2.0


def test_rejects_post_cutoff_and_invalid_counts(tmp_path):
    path = tmp_path / "team-form-EPL-2425.json"
    path.write_text(json.dumps([{
        "team": "Arsenal", "matches_sampled": 3, "ppg": 2.0,
        "wins": 3, "draws": 1, "losses": 0,
        "goals_for_avg": 1.0, "goals_against_avg": 1.0,
        "goal_difference_avg": 0.0, "latest_match_date": "30/08/2024",
    }]), encoding="utf-8")
    assert ScrapedTeamFormStore(tmp_path).get_team_form(
        competition="EPL", team="Arsenal",
        information_cutoff=datetime(2024, 9, 1, tzinfo=timezone.utc),
    ) is None
