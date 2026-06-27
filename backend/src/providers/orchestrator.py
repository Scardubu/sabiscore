"""Quota-aware evidence orchestration facade."""

from __future__ import annotations

from enum import Enum
from typing import Any

from .base import ProviderResult, ProviderStatus, TrustTier
from .registry import ProviderRegistry


class EvidenceProfile(str, Enum):
    DISCOVERY = "DISCOVERY"
    PREMATCH_STANDARD = "PREMATCH_STANDARD"
    PREMATCH_ENRICHED = "PREMATCH_ENRICHED"
    LINEUP_REFRESH = "LINEUP_REFRESH"
    MARKET_REFRESH = "MARKET_REFRESH"
    FORECAST_ONLY = "FORECAST_ONLY"


class EvidenceOrchestrator:
    def __init__(self, registry: ProviderRegistry) -> None:
        self.registry = registry

    async def collect(self, fixture: dict[str, Any], profile: EvidenceProfile) -> list[ProviderResult]:
        competition = str(fixture.get("competition") or fixture.get("league") or "EPL").upper()
        results: list[ProviderResult] = []
        if profile in {EvidenceProfile.DISCOVERY, EvidenceProfile.PREMATCH_STANDARD, EvidenceProfile.PREMATCH_ENRICHED}:
            espn = self.registry.get("espn")
            if hasattr(espn, "scoreboard"):
                results.append(await espn.scoreboard(competition))
        if not results:
            results.append(
                ProviderResult(
                    provider="orchestrator",
                    operation=profile.value,
                    status=ProviderStatus.PARTIAL,
                    trust_tier=TrustTier.OPEN_DATA,
                    warnings=["no_provider_operation_selected"],
                )
            )
        return results
