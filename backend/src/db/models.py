"""Convenience re-exports for SQLAlchemy models defined in ``src.core.database``.

This wrapper allows application code to rely on ``src.db.models`` without
re-implementing the ORM metadata. Keeping a single source of truth for table
definitions prevents divergences between sync/async contexts.
"""

from ..core.database import (  # noqa: F401
    Base,
    FeatureVector,
    League,
    Match,
    MatchEvent,
    MatchStats,
    Odds,
    OddsHistory,
    Player,
    PlayerValuation,
    Prediction,
    Team,
    ValueBet,
)

__all__ = [
    "Base",
    "FeatureVector",
    "League",
    "Match",
    "MatchEvent",
    "MatchStats",
    "Odds",
    "OddsHistory",
    "Player",
    "PlayerValuation",
    "Prediction",
    "Team",
    "ValueBet",
]
