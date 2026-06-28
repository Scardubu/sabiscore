"""ESPN provider — keyless, supplementary, discovery/readiness-only.

Trust tier: UNOFFICIAL_PUBLIC. ESPN supplies fixture discovery and event status
to the evidence orchestrator at the lowest precedence. It never establishes
critical odds, lineup, injury, probability, or execution evidence, and it never
computes model features, verdicts, EV, or stakes.

Public surface:
    EspnProvider            — the operational client (DI: httpx + breaker + clock)
    Competition             — canonical competition enum (7 supported)
    ProviderEnvelope        — redacted standard envelope
    NormalizedFixture       — normalized, audit-stamped fixture
    ProviderStatus          — health/status taxonomy
    TrustTier               — trust tier enum
    EspnSchemaError         — raised on contract drift (fail closed)
"""

from __future__ import annotations

from .client import CircuitBreaker, CircuitOpenError, EspnProvider
from .mappings import (
    Competition,
    UnsupportedCompetitionError,
    _ESPN_SLUG_BY_COMPETITION,
    competition_from_slug,
    espn_slug,
    supported_competitions,
)
from .schemas import (
    EspnSchemaError,
    NormalizedFixture,
    ProviderEnvelope,
    ProviderStatus,
    TrustTier,
)

ESPN_LEAGUE_SLUGS = {competition.value: slug for competition, slug in _ESPN_SLUG_BY_COMPETITION.items()}
ESPNProvider = EspnProvider

__all__ = [
    "EspnProvider",
    "ESPNProvider",
    "CircuitBreaker",
    "CircuitOpenError",
    "Competition",
    "UnsupportedCompetitionError",
    "ESPN_LEAGUE_SLUGS",
    "competition_from_slug",
    "espn_slug",
    "supported_competitions",
    "EspnSchemaError",
    "NormalizedFixture",
    "ProviderEnvelope",
    "ProviderStatus",
    "TrustTier",
]
