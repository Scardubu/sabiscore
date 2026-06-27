"""The Odds API current-market provider descriptor."""

from __future__ import annotations

from typing import Any

from .base import BaseProvider, ProviderCapability, ProviderQuota, ProviderResult, ProviderStatus, TrustTier, stable_hash
from .espn import ESPN_LEAGUE_SLUGS


class TheOddsAPIProvider(BaseProvider):
    provider_id = "the_odds_api"
    display_name = "The Odds API"
    trust_tier = TrustTier.OFFICIAL_AUTHENTICATED
    requires_key = True
    base_url = "https://api.the-odds-api.com/v4"

    async def capabilities(self) -> list[ProviderCapability]:
        return [
            ProviderCapability(
                provider=self.provider_id,
                competition=competition,
                fixtures=True,
                odds=True,
                notes=["single_bookmaker_snapshots_required", "quota_headers_recorded_when_live"],
            )
            for competition in ESPN_LEAGUE_SLUGS
        ]

    async def odds(
        self,
        *,
        sport: str,
        regions: str = "uk,eu",
        markets: str = "h2h",
    ) -> ProviderResult:
        if not self.enabled or not self.configured:
            return ProviderResult(
                provider=self.provider_id,
                operation="odds",
                status=ProviderStatus.PARTIAL,
                trust_tier=self.trust_tier,
                error_code="provider_disabled_or_unconfigured",
                warnings=["provider must be enabled and configured with a backend credential"],
            )

        try:
            payload, headers = await self._get_json(
                f"{self.base_url}/sports/{sport}/odds",
                params={
                    "apiKey": self.api_key,
                    "regions": regions,
                    "markets": markets,
                    "oddsFormat": "decimal",
                },
            )
            records = payload if isinstance(payload, list) else []
            return ProviderResult(
                provider=self.provider_id,
                operation="odds",
                status=ProviderStatus.VERIFIED,
                trust_tier=self.trust_tier,
                records=records,
                quota=self._quota_from_headers(headers),
                raw_snapshot_id=stable_hash(records),
            )
        except Exception as exc:  # pragma: no cover - network path
            return ProviderResult(
                provider=self.provider_id,
                operation="odds",
                status=ProviderStatus.UNAVAILABLE,
                trust_tier=self.trust_tier,
                error_code=type(exc).__name__,
            )

    def _quota_from_headers(self, headers: Any) -> ProviderQuota:
        remaining = headers.get("x-requests-remaining") if headers else None
        used = headers.get("x-requests-used") if headers else None
        return ProviderQuota(
            remaining=int(remaining) if remaining and str(remaining).isdigit() else None,
            cost=int(used) if used and str(used).isdigit() else None,
        )
