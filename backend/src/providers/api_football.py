"""API-Football authenticated enrichment provider.

Operational client: injuries + lineups via x-apisports-key header auth.
team_statistics() is a deliberate explicit stub — the real endpoint requires
a team_id the orchestrator's PREMATCH_ENRICHED profile does not yet thread
through (see comment on the method). Provider prediction/odds endpoints are
intentionally never called — SabiScore excludes provider predictions from
its own model.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel

from .base import (
    BaseProvider,
    ProviderCapability,
    ProviderQuota,
    ProviderResult,
    ProviderStatus,
    TrustTier,
    stable_hash,
)
from .espn import ESPN_LEAGUE_SLUGS

_LEAGUE_IDS: dict[str, int] = {
    "EPL": 39,
    "LA_LIGA": 140,
    "SERIE_A": 135,
    "BUNDESLIGA": 78,
    "LIGUE_1": 61,
}


def _current_season() -> int:
    """API-Football seasons are keyed by the year the season starts (Aug-Jul)."""
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 7 else now.year - 1


class InjuryRecord(BaseModel):
    provider: str = "api_football"
    player_id: int | None = None
    player_name: str
    team_id: int | None = None
    team_name: str
    fixture_id: int | None = None
    injury_type: str | None = None
    reason: str | None = None
    coherent: bool
    rejection_reason: str | None = None


class LineupRecord(BaseModel):
    provider: str = "api_football"
    fixture_id: int | None = None
    team_id: int | None = None
    team_name: str
    formation: str | None = None
    player_id: int | None = None
    player_name: str
    role: str
    coherent: bool
    rejection_reason: str | None = None


class APIFootballProvider(BaseProvider):
    provider_id = "api_football"
    display_name = "API-Football"
    trust_tier = TrustTier.OFFICIAL_AUTHENTICATED
    requires_key = True
    base_url = "https://v3.football.api-sports.io"

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

    async def injuries(self, *, competition: str) -> ProviderResult:
        guard = self._guard("injuries")
        if guard is not None:
            return guard
        league_id = _LEAGUE_IDS.get(competition.upper())
        if league_id is None:
            return self._unsupported_competition("injuries", competition)

        try:
            payload, headers = await self._get_json(
                f"{self.base_url}/injuries",
                headers={"x-apisports-key": self.api_key or ""},
                params={"league": league_id, "season": _current_season()},
            )
        except Exception as exc:
            return self._network_failure("injuries", exc)

        logical_error = self._logical_error("injuries", payload)
        if logical_error is not None:
            return logical_error

        raw_items = payload.get("response") if isinstance(payload, dict) else None
        raw_items = raw_items if isinstance(raw_items, list) else []
        records = [self._normalize_injury(raw) for raw in raw_items]

        return ProviderResult(
            provider=self.provider_id,
            operation="injuries",
            status=ProviderStatus.VERIFIED if records else ProviderStatus.PARTIAL,
            trust_tier=self.trust_tier,
            records=[r.model_dump(mode="json") for r in records],
            quota=self._quota_from_headers(headers),
            warnings=[f"rejected: {r.rejection_reason}" for r in records if not r.coherent],
            raw_snapshot_id=stable_hash(payload),
        )

    async def lineups(self, *, fixture_id: Any, competition: str | None = None) -> ProviderResult:
        # `competition` is accepted-but-unused: the orchestrator's
        # PREMATCH_ENRICHED call site passes it, but /fixtures/lineups only
        # needs the fixture id.
        guard = self._guard("lineups")
        if guard is not None:
            return guard
        if not fixture_id:
            return ProviderResult(
                provider=self.provider_id,
                operation="lineups",
                status=ProviderStatus.UNAVAILABLE,
                trust_tier=self.trust_tier,
                error_code="fixture_id_required",
            )

        try:
            payload, headers = await self._get_json(
                f"{self.base_url}/fixtures/lineups",
                headers={"x-apisports-key": self.api_key or ""},
                params={"fixture": fixture_id},
            )
        except Exception as exc:
            return self._network_failure("lineups", exc)

        logical_error = self._logical_error("lineups", payload)
        if logical_error is not None:
            return logical_error

        raw_teams = payload.get("response") if isinstance(payload, dict) else None
        raw_teams = raw_teams if isinstance(raw_teams, list) else []
        records: list[LineupRecord] = []
        for team_entry in raw_teams:
            records.extend(self._normalize_lineup_team(team_entry, fixture_id=fixture_id))

        return ProviderResult(
            provider=self.provider_id,
            operation="lineups",
            status=ProviderStatus.VERIFIED if records else ProviderStatus.PARTIAL,
            trust_tier=self.trust_tier,
            records=[r.model_dump(mode="json") for r in records],
            quota=self._quota_from_headers(headers),
            warnings=[f"rejected: {r.rejection_reason}" for r in records if not r.coherent],
            raw_snapshot_id=stable_hash(payload),
        )

    async def team_statistics(self, *, competition: str) -> ProviderResult:
        # ponytail: the real /teams/statistics endpoint requires a team_id;
        # the orchestrator's PREMATCH_ENRICHED profile only threads
        # `competition` through today. Upgrade once per-fixture team IDs are
        # available to the orchestrator at this call site.
        return ProviderResult(
            provider=self.provider_id,
            operation="team_statistics",
            status=ProviderStatus.PARTIAL,
            trust_tier=self.trust_tier,
            warnings=["team_id_required_not_yet_passed_by_orchestrator"],
            error_code="team_id_required",
        )

    async def probe(self) -> ProviderStatus:
        """Cheap liveness probe: account/quota status endpoint."""
        try:
            await self._get_json(
                f"{self.base_url}/status",
                headers={"x-apisports-key": self.api_key or ""},
            )
            return ProviderStatus.VERIFIED
        except Exception:  # pragma: no cover - network path
            return ProviderStatus.UNAVAILABLE

    # ------------------------------------------------------------------ #
    # Internals                                                            #
    # ------------------------------------------------------------------ #

    def _guard(self, operation: str) -> ProviderResult | None:
        if not self.enabled or not self.configured:
            return ProviderResult(
                provider=self.provider_id,
                operation=operation,
                status=ProviderStatus.UNAVAILABLE,
                trust_tier=self.trust_tier,
                error_code="provider_disabled_or_unconfigured",
                warnings=["provider must be enabled and configured with a backend credential"],
            )
        return None

    def _unsupported_competition(self, operation: str, competition: str) -> ProviderResult:
        return ProviderResult(
            provider=self.provider_id,
            operation=operation,
            status=ProviderStatus.UNAVAILABLE,
            trust_tier=self.trust_tier,
            error_code="unsupported_competition",
            warnings=[f"competition {competition!r} has no API-Football league mapping"],
        )

    def _network_failure(self, operation: str, exc: Exception) -> ProviderResult:
        status = ProviderStatus.RATE_LIMITED if "rate_limited" in str(exc) else ProviderStatus.UNAVAILABLE
        return ProviderResult(
            provider=self.provider_id,
            operation=operation,
            status=status,
            trust_tier=self.trust_tier,
            error_code=type(exc).__name__,
        )

    def _logical_error(self, operation: str, payload: Any) -> ProviderResult | None:
        """API-Football returns HTTP 200 with a populated `errors` field on logical failures."""
        errors = payload.get("errors") if isinstance(payload, dict) else None
        if errors:
            return ProviderResult(
                provider=self.provider_id,
                operation=operation,
                status=ProviderStatus.UNAVAILABLE,
                trust_tier=self.trust_tier,
                error_code="api_logical_error",
                warnings=[str(errors)],
            )
        return None

    def _normalize_injury(self, raw: dict[str, Any]) -> InjuryRecord:
        try:
            player = raw["player"]
            team = raw["team"]
            player_name = str(player.get("name") or "")
            team_name = str(team.get("name") or "")
            if not player_name or not team_name:
                raise ValueError("missing_name")
        except (KeyError, TypeError, ValueError):
            return InjuryRecord(
                player_name="",
                team_name="",
                coherent=False,
                rejection_reason="missing_field_player_or_team",
            )
        raw_fixture = raw.get("fixture")
        fixture: dict[str, Any] = raw_fixture if isinstance(raw_fixture, dict) else {}
        return InjuryRecord(
            player_id=player.get("id"),
            player_name=player_name,
            team_id=team.get("id"),
            team_name=team_name,
            fixture_id=fixture.get("id"),
            injury_type=raw.get("type"),
            reason=raw.get("reason") or (player.get("reason") if isinstance(player, dict) else None),
            coherent=True,
        )

    def _normalize_lineup_team(self, raw: dict[str, Any], *, fixture_id: Any) -> list[LineupRecord]:
        team = raw.get("team") if isinstance(raw, dict) else None
        if not isinstance(team, dict) or not team.get("name"):
            return [
                LineupRecord(
                    fixture_id=fixture_id,
                    team_name="",
                    player_name="",
                    role="starting",
                    coherent=False,
                    rejection_reason="missing_field_team",
                )
            ]
        team_name = str(team.get("name") or "")
        team_id = team.get("id")
        formation = raw.get("formation")
        records: list[LineupRecord] = []
        for entry in raw.get("startXI") or []:
            records.append(
                self._normalize_lineup_player(
                    entry, fixture_id=fixture_id, team_id=team_id, team_name=team_name,
                    formation=formation, role="starting",
                )
            )
        for entry in raw.get("substitutes") or []:
            records.append(
                self._normalize_lineup_player(
                    entry, fixture_id=fixture_id, team_id=team_id, team_name=team_name,
                    formation=formation, role="substitute",
                )
            )
        return records

    def _normalize_lineup_player(
        self, entry: dict[str, Any], *, fixture_id: Any, team_id: Any, team_name: str, formation: Any, role: str
    ) -> LineupRecord:
        player = entry.get("player") if isinstance(entry, dict) else None
        player_name = str(player.get("name") or "") if isinstance(player, dict) else ""
        if not player_name:
            return LineupRecord(
                fixture_id=fixture_id,
                team_id=team_id,
                team_name=team_name,
                formation=formation,
                player_name="",
                role=role,
                coherent=False,
                rejection_reason="missing_field_player",
            )
        assert isinstance(player, dict)  # guaranteed by the player_name check above
        return LineupRecord(
            fixture_id=fixture_id,
            team_id=team_id,
            team_name=team_name,
            formation=formation,
            player_id=player.get("id"),
            player_name=player_name,
            role=role,
            coherent=True,
        )

    def _quota_from_headers(self, headers: Any) -> ProviderQuota:
        remaining = headers.get("x-ratelimit-requests-remaining") if headers else None
        limit = headers.get("x-ratelimit-requests-limit") if headers else None
        return ProviderQuota(
            remaining=int(remaining) if remaining and str(remaining).isdigit() else None,
            limit=int(limit) if limit and str(limit).isdigit() else None,
        )
