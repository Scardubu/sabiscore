#!/usr/bin/env python3
"""Replace obsolete synthetic-fallback tests with fail-closed contract tests."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, content: str) -> None:
    (ROOT / relative).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return content.replace(old, new, 1)


def replace_block(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


pipeline_path = "backend/tests/test_prediction_pipeline.py"
pipeline = read(pipeline_path)
pipeline = replace_once(
    pipeline,
    "from src.core.config import settings\n",
    "from src.core.config import settings\nfrom src.core.exceptions import DataUnavailableError\n",
    "prediction pipeline exception import",
)
pipeline = replace_block(
    pipeline,
    r"    @pytest\.mark\.asyncio\n    async def test_feature_generation\(self\):.*?\n    @pytest\.mark\.asyncio\n    async def test_prediction_endpoint",
    '''    @pytest.mark.asyncio
    async def test_feature_generation(self):
        """Incomplete evidence must never produce a model feature vector."""
        service = PredictionService()

        with pytest.raises(DataUnavailableError) as exc_info:
            service.transformer.engineer_features(
                {
                    "home_team": "Arsenal",
                    "away_team": "Liverpool",
                    "league": "EPL",
                    "odds": {"home_win": 2.1, "draw": 3.3, "away_win": 3.5},
                }
            )

        assert exc_info.value.reason == "DATA_UNAVAILABLE"
        assert "league_policy" in exc_info.value.missing_fields

    @pytest.mark.asyncio
    async def test_prediction_endpoint''',
    "feature generation test",
)
pipeline = replace_block(
    pipeline,
    r"    @pytest\.mark\.asyncio\n    async def test_prediction_service_direct\(self, sample_match_request\):.*?\n    @pytest\.mark\.asyncio\n    async def test_value_bet_detection",
    '''    @pytest.mark.asyncio
    async def test_prediction_service_direct(self, sample_match_request, monkeypatch):
        """PredictionService must propagate a typed real-data gap."""
        models_path = settings.models_path
        model_files = list(models_path.glob("*_ensemble.pkl"))
        if not model_files:
            pytest.skip("No models available")
        try:
            model = SabiScoreEnsemble.load_model(str(model_files[0]))
        except Exception as exc:
            pytest.skip(f"Model could not be loaded: {exc}")

        service = PredictionService(ensemble_model=model)

        def fail_closed(*_args, **_kwargs):
            raise DataUnavailableError("verified_feature_bundle")

        monkeypatch.setattr(service, "_build_feature_frame", fail_closed)
        with pytest.raises(DataUnavailableError) as exc_info:
            await service.predict_match(
                match_id="test_direct_001",
                request=sample_match_request,
            )

        assert exc_info.value.missing_fields == ("verified_feature_bundle",)

    @pytest.mark.asyncio
    async def test_value_bet_detection''',
    "direct prediction test",
)
pipeline = replace_block(
    pipeline,
    r"    @pytest\.mark\.asyncio\n    async def test_value_bet_detection\(self, sample_match_request\):.*?\n    @pytest\.mark\.asyncio\n    async def test_odds_integration",
    '''    @pytest.mark.asyncio
    async def test_value_bet_detection(self, sample_match_request, monkeypatch):
        """Attractive odds cannot bypass missing verified model evidence."""
        models_path = settings.models_path
        model_files = list(models_path.glob("*_ensemble.pkl"))
        if not model_files:
            pytest.skip("No models available")
        try:
            model = SabiScoreEnsemble.load_model(str(model_files[0]))
        except Exception as exc:
            pytest.skip(f"Model could not be loaded: {exc}")

        service = PredictionService(ensemble_model=model)
        request = MatchPredictionRequest(
            home_team="Arsenal",
            away_team="Liverpool",
            league="epl",
            odds={"home_win": 2.50, "draw": 3.40, "away_win": 3.00},
            bankroll=10_000,
        )

        def fail_closed(*_args, **_kwargs):
            raise DataUnavailableError("verified_feature_bundle")

        monkeypatch.setattr(service, "_build_feature_frame", fail_closed)
        with pytest.raises(DataUnavailableError):
            await service.predict_match(match_id="test_value_001", request=request)

    @pytest.mark.asyncio
    async def test_odds_integration''',
    "value detection test",
)
write(pipeline_path, pipeline)


end_to_end_path = "backend/tests/integration/test_end_to_end.py"
end_to_end = read(end_to_end_path)
end_to_end = replace_once(
    end_to_end,
    "from src.data.aggregator import DataAggregator\n",
    "from src.data.aggregator import DataAggregator\nfrom src.core.exceptions import DataUnavailableError\n",
    "end-to-end exception import",
)
end_to_end = replace_block(
    end_to_end,
    r"    @pytest\.mark\.asyncio\n    async def test_feature_transformation\(self, sample_match_request\):.*?\n\n\n@pytest\.mark\.integration",
    '''    @pytest.mark.asyncio
    async def test_feature_transformation(self, sample_match_request):
        """The transformer rejects incomplete source payloads."""
        service = PredictionService()

        with pytest.raises(DataUnavailableError) as exc_info:
            service.transformer.engineer_features(
                {
                    "home_team": sample_match_request.home_team,
                    "away_team": sample_match_request.away_team,
                    "league": "EPL",
                }
            )

        assert "odds" in exc_info.value.missing_fields


@pytest.mark.integration''',
    "end-to-end feature transformation test",
)
write(end_to_end_path, end_to_end)


api_path = "backend/tests/unit/test_api.py"
api = read(api_path)
api = replace_block(
    api,
    r"    @patch\('src\.api\.legacy_endpoints\.get_db'\)\n    @patch\('src\.api\.legacy_endpoints\._load_model_from_app'\)\n    def test_insights_generation\(self, mock_load_model, mock_get_db\):.*?\n    def test_model_status",
    '''    @patch('src.api.legacy_endpoints.get_db')
    @patch('src.api.legacy_endpoints._load_model_from_app')
    def test_insights_generation(self, mock_load_model, mock_get_db):
        """The legacy insights route is permanently fail-closed."""
        response = client.post(
            "/api/v1/insights",
            json={"matchup": "Manchester City vs Liverpool", "league": "EPL"},
        )

        assert response.status_code == 410
        assert response.json()["detail"]["error_code"] == "LEGACY_INSIGHTS_DISABLED"
        mock_load_model.assert_not_called()

    def test_model_status''',
    "legacy insights API test",
)
write(api_path, api)

# One-shot machinery must not remain in the repository.
(ROOT / ".github/workflows/apply-zero-fabrication-test-fixes.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
