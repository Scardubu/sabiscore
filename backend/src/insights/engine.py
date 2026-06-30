"""Retired legacy insights facade.

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
