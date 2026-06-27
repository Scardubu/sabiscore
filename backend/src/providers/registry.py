"""Provider registration and aggregate gateway operations."""

from __future__ import annotations

import asyncio
from typing import Iterable

from ..core.config import settings
from .api_football import APIFootballProvider
from .base import ProviderCapability, ProviderHealth, ProviderQuota
from .espn import ESPNProvider
from .football_data_org import FootballDataOrgProvider
from .sportmonks import SportmonksProvider
from .the_odds_api import TheOddsAPIProvider


class ProviderRegistry:
    def __init__(self, providers: Iterable[object]) -> None:
        self.providers = list(providers)

    def list(self) -> list[object]:
        return list(self.providers)

    def get(self, provider_id: str):
        for provider in self.providers:
            if getattr(provider, "provider_id", None) == provider_id:
                return provider
        raise KeyError(provider_id)

    async def health(self) -> list[ProviderHealth]:
        return list(await asyncio.gather(*(provider.health() for provider in self.providers)))

    async def capabilities(self) -> list[ProviderCapability]:
        nested = await asyncio.gather(*(provider.capabilities() for provider in self.providers))
        return [item for group in nested for item in group]

    async def quota(self) -> dict[str, ProviderQuota]:
        values = await asyncio.gather(*(provider.quota() for provider in self.providers))
        return {provider.provider_id: quota for provider, quota in zip(self.providers, values)}

    async def doctor(self, provider_id: str | None = None) -> dict:
        providers = [self.get(provider_id)] if provider_id else self.providers
        reports = await asyncio.gather(*(provider.doctor() for provider in providers))
        return {"providers": reports}


def build_provider_registry() -> ProviderRegistry:
    return ProviderRegistry(
        [
            ESPNProvider(enabled=settings.enable_espn_provider, live_tests=settings.provider_live_tests),
            FootballDataOrgProvider(
                api_key=settings.football_data_api_key,
                enabled=settings.enable_football_data_provider,
                live_tests=settings.provider_live_tests,
            ),
            APIFootballProvider(
                api_key=settings.api_football_key,
                enabled=settings.enable_api_football_provider,
                live_tests=settings.provider_live_tests,
            ),
            SportmonksProvider(
                api_key=settings.sportmonks_api_key,
                enabled=settings.enable_sportmonks_provider,
                live_tests=settings.provider_live_tests,
            ),
            TheOddsAPIProvider(
                api_key=settings.the_odds_api_key,
                enabled=settings.enable_the_odds_api_provider,
                live_tests=settings.provider_live_tests,
            ),
        ]
    )
