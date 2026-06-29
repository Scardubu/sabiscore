from __future__ import annotations

import json
from datetime import datetime, timezone

from src.services.scraped_feature_store import ScrapedTeamFormStore


def _record(**overrides):
    payload = {
        "source": "football-data-csv",
        "team": "Arsenal",
        "matches_sampled": 3,
        "ppg": 2.0,
        "wins": 2,
        "draws": 0,
        "losses": 1,
        "goals_for_avg": 1.6666666666666667,
        "goals_against_avg": 0.6666666666666666,
        "goal_difference_avg": 1.0,
        "latest_match_date": "30/08/2024",
        "recent": [],
    }
    payload.update(overrides)
    return payload


def test_loads_real_team_form_before_cutoff(tmp_path):
    path = tmp_path / "team-form-EPL-2425.json"
    path.write_text(json.dumps([_record()]), encoding="utf-8")

    record = ScrapedTeamFormStore(tmp_path).get_team_form(
        competition="Premier League",
        team="arsenal",
        information_cutoff=datetime(2024, 9, 1, tzinfo=timezone.utc),
    )

    assert record is not None
    assert record.ppg == 2.0
    assert record.to_projection_stats()["wins_5"] == 2.0


def test_rejects_post_cutoff_record(tmp_path):
    path = tmp_path / "team-form-EPL-2425.json"
    path.write_text(json.dumps([_record(latest_match_date="01/09/2024")]), encoding="utf-8")

    assert ScrapedTeamFormStore(tmp_path).get_team_form(
        competition="EPL",
        team="Arsenal",
        information_cutoff=datetime(2024, 9, 1, tzinfo=timezone.utc),
    ) is None


def test_rejects_invalid_counts_derived_values_and_missing_date(tmp_path):
    path = tmp_path / "team-form-EPL-2425.json"
    for invalid in (
        _record(wins=3, draws=1),
        _record(ppg=0.5),
        _record(goal_difference_avg=99.0),
        _record(latest_match_date=None),
    ):
        path.write_text(json.dumps([invalid]), encoding="utf-8")
        assert ScrapedTeamFormStore(tmp_path).get_team_form(
            competition="EPL", team="Arsenal"
        ) is None


def test_rejects_unsupported_competition_and_malformed_json(tmp_path):
    (tmp_path / "team-form-EPL-2425.json").write_text("not-json", encoding="utf-8")
    store = ScrapedTeamFormStore(tmp_path)
    assert store.get_team_form(competition="UCL", team="Arsenal") is None
    assert store.get_team_form(competition="EPL", team="Arsenal") is None
