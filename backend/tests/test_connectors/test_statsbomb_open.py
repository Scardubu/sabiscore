"""Tests for backend/src/connectors/statsbomb_open.py.

Uses a minimal synthetic StatsBomb events JSON so no real data download is
needed. Run:
    cd backend && pytest tests/test_connectors/test_statsbomb_open.py -v
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
import pytest

from src.connectors.statsbomb_open import StatsBombOpenDataSource


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_event(
    event_id: str,
    type_name: str,
    team: str,
    minute: int = 10,
    shot_xg: float | None = None,
    shot_outcome: str | None = None,
) -> dict:
    event: dict = {
        "id": event_id,
        "minute": minute,
        "second": 0,
        "period": 1,
        "type": {"name": type_name},
        "team": {"name": team},
        "player": {"name": "Test Player"},
        "location": [60.0, 40.0],
        "under_pressure": False,
        "play_pattern": {"name": "Regular Play"},
    }
    if shot_xg is not None:
        event["shot"] = {
            "statsbomb_xg": shot_xg,
            "outcome": {"name": shot_outcome or "Off T"},
            "body_part": {"name": "Right Foot"},
        }
    return event


@pytest.fixture
def events_dir(tmp_path: Path) -> Path:
    events_root = tmp_path / "events"
    events_root.mkdir()
    return tmp_path


@pytest.fixture
def match_id() -> str:
    return "3788741"


@pytest.fixture
def events_file(events_dir: Path, match_id: str) -> Path:
    payload = [
        _make_event("e1", "Pass", "Arsenal", minute=1),
        _make_event("e2", "Shot", "Arsenal", minute=22, shot_xg=0.15, shot_outcome="Goal"),
        _make_event("e3", "Shot", "Chelsea", minute=35, shot_xg=0.08, shot_outcome="Off T"),
        _make_event("e4", "Shot", "Arsenal", minute=61, shot_xg=0.32, shot_outcome="Saved"),
        _make_event("e5", "Carry", "Chelsea", minute=70),
    ]
    path = events_dir / "events" / f"{match_id}.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


@pytest.fixture
def source(events_dir: Path) -> StatsBombOpenDataSource:
    return StatsBombOpenDataSource(root=events_dir)


# ---------------------------------------------------------------------------
# load_events_json
# ---------------------------------------------------------------------------


class TestLoadEventsJson:
    def test_returns_dataframe_and_meta(self, source, events_file, match_id):
        frame, meta = source.load_events_json(match_id)
        assert isinstance(frame, pd.DataFrame)
        assert len(frame) == 5
        assert meta["source"] == "statsbomb-open-data"
        assert meta["row_count"] == 5

    def test_shot_xg_column_populated(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        shots = frame[frame["type"] == "Shot"]
        assert not shots["shot_xg"].isnull().all()

    def test_file_not_found_raises(self, source):
        with pytest.raises(FileNotFoundError):
            source.load_events_json("99999")

    def test_invalid_payload_raises(self, events_dir, match_id):
        bad_path = events_dir / "events" / f"{match_id}.json"
        bad_path.write_text(json.dumps({"not": "a list"}), encoding="utf-8")
        src = StatsBombOpenDataSource(root=events_dir)
        with pytest.raises(ValueError, match="must be a list"):
            src.load_events_json(match_id)


# ---------------------------------------------------------------------------
# shot_features
# ---------------------------------------------------------------------------


class TestShotFeatures:
    def test_filters_to_shots_only(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        shots = source.shot_features(frame)
        assert set(shots["type"].unique()) == {"Shot"}

    def test_is_goal_flag(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        shots = source.shot_features(frame)
        goal_row = shots[shots["shot_outcome"] == "Goal"]
        assert goal_row["is_goal"].iloc[0] == 1
        non_goal = shots[shots["shot_outcome"] != "Goal"]
        assert (non_goal["is_goal"] == 0).all()

    def test_empty_frame_returns_empty(self, source):
        result = source.shot_features(pd.DataFrame())
        assert result.empty

    def test_no_shots_returns_empty(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        no_shots = frame[frame["type"] != "Shot"].copy()
        result = source.shot_features(no_shots)
        assert result.empty


# ---------------------------------------------------------------------------
# xg_summary_by_team
# ---------------------------------------------------------------------------


class TestXgSummaryByTeam:
    def test_aggregates_by_team(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        summary = source.xg_summary_by_team(frame)
        teams = set(summary["team"].tolist())
        assert "Arsenal" in teams
        assert "Chelsea" in teams

    def test_xg_totals_correct(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        summary = source.xg_summary_by_team(frame).set_index("team")
        # Arsenal: 0.15 + 0.32 = 0.47; Chelsea: 0.08
        assert summary.loc["Arsenal", "xg_total"] == pytest.approx(0.47)
        assert summary.loc["Arsenal", "goals"] == 1

    def test_xg_per_shot_computed(self, source, events_file, match_id):
        frame, _ = source.load_events_json(match_id)
        summary = source.xg_summary_by_team(frame)
        for _, row in summary.iterrows():
            if row["shots"] > 0:
                assert math.isfinite(row["xg_per_shot"])

    def test_empty_frame_returns_empty_with_columns(self, source):
        result = source.xg_summary_by_team(pd.DataFrame())
        assert result.empty
        assert "xg_total" in result.columns
