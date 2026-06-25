"""Data connectors for SabiScore.

This package contains two generations of connectors that coexist
side-by-side:

Legacy real-time connectors (Phase <=8)
----------------------------------------
``OptaConnector``, ``BetfairConnector``, ``PinnacleConnector`` — live match
data and odds-stream connectors used by ``api/websocket.py`` and friends.
These are unchanged.

V4 / Phase 9 candidate primitives (additive)
---------------------------------------------
Async-first, side-effect-free building blocks for the V4 source layer.
They can be introduced behind feature flags without modifying the Phase 8
inference path.

Quick import reference
~~~~~~~~~~~~~~~~~~~~~~~
.. code-block:: python

    # Legacy live connectors (unchanged)
    from src.connectors import OptaConnector, BetfairConnector, PinnacleConnector

    # API-first fixture/results/standings
    from src.connectors import FootballDataOrgClient

    # Odds normalisation + EV / CLV features (safe at request time)
    from src.connectors import (
        OddsMarketSnapshot,
        normalize_decimal_odds,
        implied_probabilities,
        power_method_probs,
        bookmaker_margin,
        compute_market_features,
    )

    # Offline xG sources (batch / shadow only)
    from src.connectors import UnderstatTeamXGSource, StatsBombOpenDataSource

    # Source registry (config-driven catalogue)
    from src.connectors import build_source_registry, enabled_source_names

    # Base primitives (for custom connectors)
    from src.connectors import AsyncJSONClient, ConnectorError, ConnectorRateLimitError, SourceMeta
"""

# ---------------------------------------------------------------------------
# Legacy real-time connectors (Phase <=8) — unchanged
# ---------------------------------------------------------------------------
from .opta import OptaConnector
from .betfair import BetfairConnector
from .pinnacle import PinnacleConnector

# ---------------------------------------------------------------------------
# V4 / Phase 9 candidate primitives (additive)
# ---------------------------------------------------------------------------
from .base import AsyncJSONClient, ConnectorError, ConnectorRateLimitError, SourceMeta
from .football_data_org import FootballDataOrgClient
from .odds_market import (
    OddsMarketSnapshot,
    bookmaker_margin,
    compute_market_features,
    implied_probabilities,
    is_complete_market,
    normalize_decimal_odds,
    power_method_probs,
)
from .source_registry import (
    SourceDescriptor,
    build_source_registry,
    enabled_source_names,
    offline_sources,
    registry_summary,
    request_time_safe_sources,
)
from .statsbomb_open import StatsBombOpenDataSource
from .understat_source import UnderstatTeamXGSource

__all__ = [
    # Legacy real-time connectors
    "OptaConnector",
    "BetfairConnector",
    "PinnacleConnector",
    # Base primitives
    "AsyncJSONClient",
    "ConnectorError",
    "ConnectorRateLimitError",
    "SourceMeta",
    # Official API connectors
    "FootballDataOrgClient",
    # Odds / market
    "OddsMarketSnapshot",
    "bookmaker_margin",
    "compute_market_features",
    "implied_probabilities",
    "is_complete_market",
    "normalize_decimal_odds",
    "power_method_probs",
    # Offline sources (shadow / batch)
    "StatsBombOpenDataSource",
    "UnderstatTeamXGSource",
    # Source registry
    "SourceDescriptor",
    "build_source_registry",
    "enabled_source_names",
    "offline_sources",
    "registry_summary",
    "request_time_safe_sources",
]
