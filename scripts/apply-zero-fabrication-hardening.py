#!/usr/bin/env python3
"""Apply the reviewed zero-fabrication hardening patch atomically."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return content.replace(old, new, 1)


def replace_regex(content: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")
    return updated


# ---------------------------------------------------------------------------
# Retire the synthetic legacy inference implementation.
# ---------------------------------------------------------------------------
write(
    "backend/src/insights/engine.py",
    '''"""Retired legacy insights facade.

The former implementation generated placeholder odds, model features, xG values,
and probabilities whenever upstream data was missing. That behaviour violates the
SabiScore zero-fabrication contract and is intentionally unavailable in production.

Callers must use ``src.services.betting_intelligence.analyze_match`` through the
certified betting-intelligence API. The class remains as a narrow import-compatible
boundary so old integrations fail closed with a typed error instead of silently
producing a betting signal.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..core.exceptions import DataUnavailableError


class InsightsEngine:
    """Import-compatible fail-closed boundary for the retired legacy engine."""

    def __init__(
        self,
        model: Optional[Any] = None,
        aggregator: Optional[Any] = None,
        transformer: Optional[Any] = None,
        explainer: Optional[Any] = None,
    ) -> None:
        self.model = model
        self.data_aggregator = aggregator
        self.transformer = transformer
        self.explainer = explainer

    def generate_match_insights(
        self,
        matchup: str,
        league: str,
        match_data: Optional[Dict[str, Any]] = None,
        realtime_data: Optional[Dict[str, Any]] = None,
        market_odds: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """Reject legacy inference so no synthetic recommendation can escape."""
        del matchup, league, match_data, realtime_data, market_odds
        raise DataUnavailableError(
            "legacy_insights_engine",
            reason="LEGACY_ENGINE_DISABLED",
        )
''',
)


# ---------------------------------------------------------------------------
# Remove aggregator placeholders and mock-team synthesis.
# ---------------------------------------------------------------------------
aggregator = read("backend/src/data/aggregator.py")
aggregator = aggregator.replace("from .team_database import get_team_stats\n", "")
aggregator = replace_once(
    aggregator,
    '            odds = {"home_win": 2.0, "draw": 3.2, "away_win": 3.5}\n',
    "            odds = {}\n",
    "aggregate odds exception fallback",
)
aggregator = replace_once(
    aggregator,
    "            team_stats = self._create_mock_team_stats()\n",
    "            team_stats = {}\n",
    "aggregate team stats exception fallback",
)
aggregator = replace_regex(
    aggregator,
    r"    def _create_mock_team_stats\(self\) -> Dict\[str, Any\]:.*?\n    # ------------------------------------------------------------------\n    def fetch_historical_stats",
    "    # ------------------------------------------------------------------\n    def fetch_historical_stats",
    "mock team stats method",
)
aggregator = replace_regex(
    aggregator,
    r"    def fetch_odds\(self\) -> Dict\[str, float\]:.*?\n    def fetch_injuries",
    '''    def fetch_odds(self) -> Dict[str, float]:
        try:
            odds = self.oddsportal.scrape_odds(self.teams["home"], self.teams["away"])
            if not odds:
                logger.warning("No real odds found for %s", self.matchup)
                return {}
            required = ("home_win", "draw", "away_win")
            if any(key not in odds for key in required):
                logger.warning("Incomplete real odds for %s", self.matchup)
                return {}
            parsed = {key: float(odds[key]) for key in required}
            if any(value <= 1.0 for value in parsed.values()):
                logger.warning("Invalid real odds for %s", self.matchup)
                return {}
            return parsed
        except Exception as exc:
            logger.warning("Failed to fetch real odds for %s: %s", self.matchup, exc)
            return {}

    def fetch_injuries''',
    "fetch_odds",
)
aggregator = replace_regex(
    aggregator,
    r"    def fetch_team_stats\(self\) -> Dict\[str, Dict\[str, Any\]\]:.*?\n\n    def _load_local_history",
    '''    def fetch_team_stats(self) -> Dict[str, Dict[str, Any]]:
        """Return only fields parsed from a live Transfermarkt response."""
        try:
            player_values_home = self.transfermarkt.scrape_player_values(self.teams["home"])
            player_values_away = self.transfermarkt.scrape_player_values(self.teams["away"])

            def parsed_squad(values: pd.DataFrame) -> Dict[str, Any]:
                if values.empty or "value" not in values.columns:
                    return {}
                numeric = (
                    values["value"]
                    .astype(str)
                    .str.replace("€", "", regex=False)
                    .str.replace("m", "", regex=False)
                    .str.replace(",", "", regex=False)
                )
                numeric = pd.to_numeric(numeric, errors="coerce").dropna()
                if numeric.empty or float(numeric.sum()) <= 0:
                    return {}
                result: Dict[str, Any] = {
                    "squad_value": float(numeric.sum()),
                    "squad_size": int(len(values)),
                }
                if "age" in values.columns:
                    ages = pd.to_numeric(values["age"], errors="coerce").dropna()
                    if not ages.empty:
                        result["average_age"] = float(ages.mean())
                return result

            return {
                "home": parsed_squad(player_values_home),
                "away": parsed_squad(player_values_away),
            }
        except Exception as exc:
            logger.warning("Failed to fetch real team stats for %s: %s", self.matchup, exc)
            return {"home": {}, "away": {}}

    def _load_local_history''',
    "fetch_team_stats",
)
write("backend/src/data/aggregator.py", aggregator)


# ---------------------------------------------------------------------------
# Prediction service: missing model columns are a data gap, never zero-filled.
# ---------------------------------------------------------------------------
prediction = read("backend/src/services/prediction.py")
prediction = replace_once(
    prediction,
    "from ..core.config import settings\n",
    "from ..core.config import settings\nfrom ..core.exceptions import DataUnavailableError\n",
    "prediction exception import",
)
prediction = replace_once(
    prediction,
    '''        missing = [c for c in columns if c not in feature_frame.columns]
        if missing:
            logger.warning(f"Transformer output missing columns expected by model: {missing}")
            # Fill missing with 0
            for c in missing:
                feature_frame[c] = 0.0
                
''',
    '''        missing = [c for c in columns if c not in feature_frame.columns]
        if missing:
            raise DataUnavailableError([f"model_feature.{name}" for name in missing])

''',
    "prediction missing-column fallback",
)
write("backend/src/services/prediction.py", prediction)


# ---------------------------------------------------------------------------
# Mounted legacy endpoint: explicit 410 instead of invoking retired inference.
# ---------------------------------------------------------------------------
legacy = read("backend/src/api/legacy_endpoints.py")
legacy = legacy.replace("from pydantic import ValidationError\n", "")
legacy = replace_regex(
    legacy,
    r"@router.post\(\"/insights\", response_model=InsightsResponse\).*?\n@router.get\(\"/models/status\"\)",
    '''@router.post("/insights", deprecated=True)
async def generate_insights(
    request: Request,
    body: InsightsRequest,
    db: Session = Depends(get_db),
):
    """Retired legacy endpoint; use the certified betting-intelligence API."""
    del request, body, db
    raise _http_error(
        410,
        "This legacy insights endpoint is disabled because it could not enforce "
        "the zero-fabrication contract. Use /api/v1/betting-intelligence/analyze.",
        "LEGACY_INSIGHTS_DISABLED",
    )


@router.get("/models/status")''',
    "legacy insights endpoint",
)
legacy = legacy.replace("    InsightsResponse,\n", "")
write("backend/src/api/legacy_endpoints.py", legacy)


# ---------------------------------------------------------------------------
# Data pipeline writes/cache: absent source fields remain absent.
# ---------------------------------------------------------------------------
pipeline = read("backend/src/data/orchestrator.py")
pipeline = replace_once(
    pipeline,
    '                            home_stats.expected_goals = match_data.get("home_xg", 0.0)\n',
    '''                            home_xg = match_data.get("home_xg")
                            if home_xg is None:
                                raise ValueError("Understat record missing home_xg")
                            home_stats.expected_goals = float(home_xg)
''',
    "pipeline home xg fallback",
)
pipeline = replace_once(
    pipeline,
    '                            away_stats.expected_goals = match_data.get("away_xg", 0.0)\n',
    '''                            away_xg = match_data.get("away_xg")
                            if away_xg is None:
                                raise ValueError("Understat record missing away_xg")
                            away_stats.expected_goals = float(away_xg)
''',
    "pipeline away xg fallback",
)
pipeline = replace_once(
    pipeline,
    '''                        cache_value = json.dumps({
                            "possession_avg": metrics.get("possession", 50.0),
                            "ppda": metrics.get("ppda", 10.0),
                            "pressure_success_pct": metrics.get("press_success", 30.0)
                        })
''',
    '''                        required_metrics = ("possession", "ppda", "press_success")
                        missing_metrics = [name for name in required_metrics if metrics.get(name) is None]
                        if missing_metrics:
                            raise ValueError(
                                f"FBRef record missing required metrics: {', '.join(missing_metrics)}"
                            )
                        cache_value = json.dumps({
                            "possession_avg": float(metrics["possession"]),
                            "ppda": float(metrics["ppda"]),
                            "pressure_success_pct": float(metrics["press_success"]),
                        })
''',
    "pipeline tactical cache fallbacks",
)
write("backend/src/data/orchestrator.py", pipeline)


# ---------------------------------------------------------------------------
# Release gate: executable source and Alembic chain must remain clean.
# ---------------------------------------------------------------------------
makefile = read("Makefile")
makefile = replace_once(
    makefile,
    "\tphase7-caches phase7-caches-clean verify verify-core\n",
    "\tphase7-caches phase7-caches-clean verify verify-core contract-scan\n",
    "Makefile phony list",
)
makefile = replace_once(
    makefile,
    "verify-core: ## Run deterministic SabiScore checks without live providers or Docker\n",
    '''contract-scan: ## Fail when prohibited fabrication or schema-authority patterns enter production code
	@echo "  Scanning production contracts"
	@if grep -R -n -E 'FEATURE_DEFAULTS|hardcoded_odds' backend/src --include='*.py'; then \
	  echo "  ✗ Zero-fabrication contract violation"; exit 1; \
	fi
	@if grep -R -n 'create_all' backend/alembic --include='*.py'; then \
	  echo "  ✗ Alembic must be the sole schema authority"; exit 1; \
	fi
	@echo "  ✓ Production contract scan passed"

verify-core: contract-scan ## Run deterministic SabiScore checks without live providers or Docker
''',
    "Makefile contract scan",
)
write("Makefile", makefile)


# ---------------------------------------------------------------------------
# Tests now assert fail-closed legacy behaviour and use explicit test fixtures.
# ---------------------------------------------------------------------------
legacy_test = '''"""Legacy insights inference must fail closed."""

import pytest

from src.core.exceptions import DataUnavailableError
from src.insights.engine import InsightsEngine


def test_legacy_insights_engine_is_disabled():
    engine = InsightsEngine()
    with pytest.raises(DataUnavailableError) as exc_info:
        engine.generate_match_insights("TeamA vs TeamB", "EPL")
    assert exc_info.value.reason == "LEGACY_ENGINE_DISABLED"
    assert "legacy_insights_engine" in exc_info.value.missing_fields
'''
for relative in (
    "backend/tests/unit/test_insights_engine.py",
    "backend/tests/unit/test_engine_core.py",
    "backend/tests/unit/test_engine_simple.py",
    "backend/tests/unit/test_engine_minimal.py",
):
    write(relative, legacy_test)

write(
    "backend/tests/unit/test_feature_transformer.py",
    '''import pandas as pd
import pytest

from src.core.exceptions import DataUnavailableError
from src.data.transformers import FeatureTransformer


def _base_features() -> pd.DataFrame:
    # Explicit test-only values. Production code contains no feature defaults.
    return pd.DataFrame(
        [
            {
                "home_xg_avg_5": 1.0,
                "away_xg_avg_5": 1.0,
                "home_xg_diff_5": 0.0,
                "away_xg_diff_5": 0.0,
                "home_xg_consistency": 0.0,
                "away_xg_consistency": 0.0,
                "xg_differential": 0.0,
                "home_possession_style": 0.0,
                "away_possession_style": 0.0,
                "home_win_rate_5": 0.0,
                "away_win_rate_5": 0.0,
                "squad_value_diff": 0.0,
                "bookmaker_margin": 0.0,
                "home_implied_prob": 0.0,
            }
        ]
    )


def test_missing_match_data_fails_closed():
    with pytest.raises(DataUnavailableError):
        FeatureTransformer().engineer_features({})


def test_apply_enhanced_features_overrides_xg_values():
    transformer = FeatureTransformer()
    updated = transformer._apply_enhanced_features(
        _base_features(),
        {
            "enhanced_features": {
                "us_home_xg_pg": 1.85,
                "us_away_xg_pg": 1.05,
                "us_home_xg_diff": 0.9,
                "us_away_xg_diff": -0.2,
                "us_home_recent_xg": 1.80,
                "us_away_recent_xg": 1.00,
            }
        },
    )
    idx = updated.index[0]
    assert updated.at[idx, "home_xg_avg_5"] == pytest.approx(1.85)
    assert updated.at[idx, "away_xg_avg_5"] == pytest.approx(1.05)
    assert updated.at[idx, "xg_differential"] == pytest.approx(1.1)
    assert 0.0 <= updated.at[idx, "home_xg_consistency"] <= 1.0
    assert 0.0 <= updated.at[idx, "away_xg_consistency"] <= 1.0


def test_apply_enhanced_features_handles_whoscored_and_transfermarkt():
    transformer = FeatureTransformer()
    updated = transformer._apply_enhanced_features(
        _base_features(),
        {
            "enhanced_features": {
                "ws_home_avg_possession": 62.5,
                "ws_away_avg_possession": 47.2,
                "ws_home_win_rate_5": 0.78,
                "ws_away_win_rate_5": 0.34,
                "tm_value_diff_m": 120.0,
                "bf_market_margin_pct": 4.5,
            }
        },
    )
    idx = updated.index[0]
    assert updated.at[idx, "home_possession_style"] == pytest.approx(0.625)
    assert updated.at[idx, "away_possession_style"] == pytest.approx(0.472)
    assert updated.at[idx, "home_win_rate_5"] == pytest.approx(0.78)
    assert updated.at[idx, "away_win_rate_5"] == pytest.approx(0.34)
    assert updated.at[idx, "squad_value_diff"] == pytest.approx(120.0)
    assert updated.at[idx, "bookmaker_margin"] == pytest.approx(0.045)


def test_apply_enhanced_features_uses_betfair_back_prices_for_odds():
    transformer = FeatureTransformer()
    updated = transformer._apply_enhanced_features(
        _base_features(),
        {
            "enhanced_features": {
                "bf_home_back": 1.9,
                "bf_draw_back": 3.5,
                "bf_away_back": 4.2,
            }
        },
    )
    idx = updated.index[0]
    implied_home = 1 / 1.9
    implied_draw = 1 / 3.5
    implied_away = 1 / 4.2
    total = implied_home + implied_draw + implied_away
    assert updated.at[idx, "home_implied_prob"] == pytest.approx(implied_home / total)
    assert updated.at[idx, "bookmaker_margin"] == pytest.approx(total - 1, abs=1e-6)
''',
)

# Consume the one-shot workflow and patch script in the same commit.
(ROOT / ".github/workflows/apply-zero-fabrication-hardening.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
