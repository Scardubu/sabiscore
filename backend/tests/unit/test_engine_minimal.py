"""Legacy insights inference must fail closed."""

import pytest

from src.core.exceptions import DataUnavailableError
from src.insights.engine import InsightsEngine


def test_legacy_insights_engine_is_disabled():
    engine = InsightsEngine()
    with pytest.raises(DataUnavailableError) as exc_info:
        engine.generate_match_insights("TeamA vs TeamB", "EPL")
    assert exc_info.value.reason == "LEGACY_ENGINE_DISABLED"
    assert "legacy_insights_engine" in exc_info.value.missing_fields
