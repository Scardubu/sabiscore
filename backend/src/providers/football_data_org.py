"""football-data.org canonical fixture/standing provider."""

from __future__ import annotations

from .base import BaseProvider, ProviderCapability, TrustTier

COMPETITIONS = {
    "EPL": "PL",
    "LA_LIGA": "PD",
    "SERIE_A": "SA",
    "BUNDESLIGA": "BL1",
    "LIGUE_1": "FL1",
}


class FootballDataOrgProvider(BaseProvider):
    provider_id = "football_data_org"
    display_name = "football-data.org"
    trust_tier = TrustTier.OFFICIAL_AUTHENTICATED
    requires_key = True
    base_url = "https://api.football-data.org/v4"

    async def capabilities(self) -> list[ProviderCapability]:
        return [
            ProviderCapability(
                provider=self.provider_id,
                competition=competition,
                fixtures=True,
                standings=True,
                notes=["official_authenticated", "not_football_data_csv"],
            )
            for competition in COMPETITIONS
        ]
