"""Sportmonks optional enrichment provider descriptor."""

from __future__ import annotations

from .base import BaseProvider, ProviderCapability, TrustTier
from .espn import ESPN_LEAGUE_SLUGS


class SportmonksProvider(BaseProvider):
    provider_id = "sportmonks"
    display_name = "Sportmonks"
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
                notes=["subscription_gated_fields_reported_by_doctor", "provider_value_bets_excluded"],
            )
            for competition in ESPN_LEAGUE_SLUGS
        ]
