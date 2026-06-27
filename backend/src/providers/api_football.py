"""API-Football authenticated enrichment provider descriptor."""

from __future__ import annotations

from .base import BaseProvider, ProviderCapability, TrustTier
from .espn import ESPN_LEAGUE_SLUGS


class APIFootballProvider(BaseProvider):
    provider_id = "api_football"
    display_name = "API-Football"
    trust_tier = TrustTier.OFFICIAL_AUTHENTICATED
    requires_key = True

    async def capabilities(self) -> list[ProviderCapability]:
        return [
            ProviderCapability(
                provider=self.provider_id,
                competition=competition,
                fixtures=True,
                standings=True,
                lineups=True,
                injuries=True,
                team_statistics=True,
                player_statistics=True,
                odds=True,
                notes=["provider_predictions_excluded_from_sabiscore_model"],
            )
            for competition in ESPN_LEAGUE_SLUGS
        ]
