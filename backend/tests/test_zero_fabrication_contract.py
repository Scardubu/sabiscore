"""Gate-blocking tests for the production zero-fabrication contract."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.core.exceptions import DataUnavailableError
from src.data.aggregator import DataAggregator
from src.data.transformers import FeatureTransformer
from src.insights.engine import InsightsEngine
from src.models.feature_registry import CANONICAL_FEATURES_68


def test_incomplete_feature_payload_fails_closed() -> None:
    transformer = FeatureTransformer()

    with pytest.raises(DataUnavailableError) as exc_info:
        transformer.engineer_features(
            {
                "home_team": "Arsenal",
                "away_team": "Liverpool",
                "league": "EPL",
                "odds": {"home_win": 2.1, "draw": 3.3, "away_win": 3.5},
            }
        )

    assert exc_info.value.reason == "DATA_UNAVAILABLE"
    assert exc_info.value.missing_fields
    assert all(field.strip() for field in exc_info.value.missing_fields)


def test_complete_canonical_feature_vector_is_accepted() -> None:
    transformer = FeatureTransformer()
    payload = {name: float(index + 1) / 100.0 for index, name in enumerate(CANONICAL_FEATURES_68)}

    frame = transformer.engineer_features({"canonical_features": payload})

    assert list(frame.columns) == list(CANONICAL_FEATURES_68)
    assert frame.shape == (1, len(CANONICAL_FEATURES_68))


def test_legacy_engine_is_disabled() -> None:
    with pytest.raises(DataUnavailableError) as exc_info:
        InsightsEngine().generate_match_insights("Arsenal vs Liverpool", "EPL")

    assert exc_info.value.reason == "LEGACY_ENGINE_DISABLED"


def test_legacy_insights_route_returns_gone() -> None:
    response = TestClient(app).post(
        "/api/v1/insights",
        json={"matchup": "Arsenal vs Liverpool", "league": "EPL"},
    )

    assert response.status_code == 410
    assert response.json()["detail"]["error_code"] == "LEGACY_INSIGHTS_DISABLED"


def test_aggregator_never_invents_odds(monkeypatch) -> None:
    aggregator = DataAggregator("Arsenal vs Liverpool", "EPL")

    def unavailable(*_args, **_kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(aggregator.oddsportal, "scrape_odds", unavailable, raising=False)
    assert aggregator.fetch_odds() == {}


def test_prohibited_production_patterns_are_absent() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    source_root = backend_root / "src"
    alembic_root = backend_root / "alembic"

    source_text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in source_root.rglob("*.py")
    )
    migration_text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in alembic_root.rglob("*.py")
    )

    assert "FEATURE_DEFAULTS" not in source_text
    assert "hardcoded_odds" not in source_text
    assert "create_all" not in migration_text
