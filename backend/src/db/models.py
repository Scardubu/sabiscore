"""Canonical SQLAlchemy model exports for the SabiScore backend.

The legacy application models still live in ``src.core.database`` and share
the same ``Base`` metadata. New production hardening tables are declared here
with SQLAlchemy 2.0 typed mappings so Alembic and runtime code use one metadata
authority without duplicating tables.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ..core.database import (  # noqa: F401
    Base,
    FeatureVector,
    League,
    LeagueStanding,
    Match,
    MatchEvent,
    MatchStats,
    Odds,
    OddsHistory,
    Player,
    PlayerValuation,
    Prediction,
    Team,
    UserAccount,
    ValueBet,
    CanonicalCompetition,
    CanonicalFixture,
    CanonicalTeam,
    MarketSnapshot,
    ProviderCapabilityRecord,
    ProviderEventMapping,
    ProviderQuotaObservation,
    ProviderRequestSummary,
)
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column


class MatchPredictionLog(Base):
    __tablename__ = "match_prediction_logs"
    __table_args__ = (
        Index("ix_match_prediction_logs_match_time", "match_id", "created_at"),
        Index("ix_match_prediction_logs_fixture", "canonical_fixture_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[str] = mapped_column(String, nullable=False)
    canonical_fixture_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("canonical_fixtures.id"),
        nullable=True,
    )
    model_version: Mapped[str] = mapped_column(String, nullable=False)
    calibration_method: Mapped[str | None] = mapped_column(String, nullable=True)
    home_probability: Mapped[float] = mapped_column(Float, nullable=False)
    draw_probability: Mapped[float] = mapped_column(Float, nullable=False)
    away_probability: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_id: Mapped[str | None] = mapped_column(String, nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class ProviderHealthLog(Base):
    __tablename__ = "provider_health_log"
    __table_args__ = (
        Index("ix_provider_health_provider_time", "provider", "checked_at"),
        Index("ix_provider_health_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    warnings: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class ProviderCapabilityObservation(Base):
    __tablename__ = "provider_capability_observations"
    __table_args__ = (
        Index(
            "ix_provider_capability_obs_provider_comp",
            "provider",
            "competition",
            "checked_at",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    competition: Mapped[str] = mapped_column(String, nullable=False)
    season: Mapped[str | None] = mapped_column(String, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    capabilities_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    source: Mapped[str | None] = mapped_column(String, nullable=True)


class CircuitState(Base):
    __tablename__ = "circuit_state"

    provider: Mapped[str] = mapped_column(String, primary_key=True)
    open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_failure_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    retry_after: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    state_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

__all__ = [
    "Base",
    "FeatureVector",
    "League",
    "LeagueStanding",
    "Match",
    "MatchEvent",
    "MatchStats",
    "Odds",
    "OddsHistory",
    "Player",
    "PlayerValuation",
    "Prediction",
    "Team",
    "UserAccount",
    "ValueBet",
    "CanonicalCompetition",
    "CanonicalFixture",
    "CanonicalTeam",
    "MarketSnapshot",
    "ProviderCapabilityRecord",
    "ProviderEventMapping",
    "ProviderQuotaObservation",
    "ProviderRequestSummary",
    "MatchPredictionLog",
    "ProviderHealthLog",
    "ProviderCapabilityObservation",
    "CircuitState",
]
