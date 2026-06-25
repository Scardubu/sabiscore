"""football-data.org v4 connector.

Provides API-first fixture/result and standings ingestion for schedule
reconciliation.  This is *not* intended to replace SabiScore's existing
scraper stack (``FootballDataEnhancedScraper`` etc. in
``data/scrapers/``); it gives a stable, officially-licensed baseline source
and explicit freshness metadata for canary-safe enrichment.

Free-tier limits
----------------
The free tier allows 10 requests/minute and covers the top 5 leagues.
When running at bulk-backfill volumes use ``get_json_with_rate_limit_backoff``
(used internally by ``matches``/``standings``) or run during off-peak hours.

API docs: https://www.football-data.org/documentation/quickstart

Configuration
-------------
Reads ``settings.football_data_api_key`` (env ``FOOTBALL_DATA_API_KEY``),
which already exists in ``backend/src/core/config.py``. No new settings are
required for this connector to function.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Any

import pandas as pd

from .base import AsyncJSONClient, ConnectorError, SourceMeta

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# League → competition-code mapping
# ---------------------------------------------------------------------------

TOP5_COMPETITION_CODES: dict[str, str] = {
    "epl": "PL",
    "premier_league": "PL",
    "la_liga": "PD",
    "laliga": "PD",
    "serie_a": "SA",
    "bundesliga": "BL1",
    "ligue_1": "FL1",
    "ligue1": "FL1",
}

# Approximate staleness threshold per data category (seconds).
_FRESHNESS_SCHEDULE: int = 24 * 3_600  # 24 hours for fixtures/results
_FRESHNESS_STANDINGS: int = 24 * 3_600  # daily for standings

_BASE_URL = "https://api.football-data.org/v4"


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FootballDataOrgClient:
    """Async connector for football-data.org v4 API.

    Parameters
    ----------
    api_key:
        Your football-data.org API token.  Pass ``None`` to use the
        unauthenticated tier (heavily rate-limited; not recommended for
        production backfills).
    timeout_seconds:
        Per-request timeout.  12 s is usually sufficient.
    """

    api_key: str | None = None
    timeout_seconds: float = 12.0

    def _client(self) -> AsyncJSONClient:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["X-Auth-Token"] = self.api_key
        return AsyncJSONClient(
            base_url=_BASE_URL,
            headers=headers,
            timeout_seconds=self.timeout_seconds,
            max_retries=3,
        )

    def _competition_code(self, league: str) -> str:
        return TOP5_COMPETITION_CODES.get(league.lower(), league.upper())

    # ------------------------------------------------------------------
    # Matches endpoint
    # ------------------------------------------------------------------

    async def matches(
        self,
        *,
        league: str,
        date_from: date | None = None,
        date_to: date | None = None,
        season: int | None = None,
        status: str | None = None,
    ) -> tuple[pd.DataFrame, dict[str, Any]]:
        """Fetch fixture/result rows for a competition.

        Parameters
        ----------
        league:
            SabiScore league slug (``"epl"``, ``"bundesliga"``, …) or raw
            football-data.org competition code (``"PL"``, ``"BL1"``, …).
        date_from / date_to:
            Filter matches to a UTC date window.  Mutually exclusive with
            ``season`` in some API plan tiers.
        season:
            Season start year, e.g. ``2025`` for the 2025/26 season.
        status:
            Optional status filter: ``"SCHEDULED"``, ``"FINISHED"``, etc.

        Returns
        -------
        (DataFrame, meta_dict)
            DataFrame with columns: source_match_id, utc_date, status,
            league_code, season, home_team, away_team, home_score,
            away_score, matchday, stage.
        """
        code = self._competition_code(league)
        params: dict[str, Any] = {}
        if date_from:
            params["dateFrom"] = date_from.isoformat()
        if date_to:
            params["dateTo"] = date_to.isoformat()
        if season:
            params["season"] = season
        if status:
            params["status"] = status

        async with self._client() as client:
            payload = await client.get_json_with_rate_limit_backoff(
                f"/competitions/{code}/matches", params=params
            )

        raw_matches = payload.get("matches") or []
        if not isinstance(raw_matches, list):
            raise ConnectorError(
                f"football-data.org /competitions/{code}/matches returned "
                "an unexpected payload shape"
            )

        rows: list[dict[str, Any]] = []
        for item in raw_matches:
            score = item.get("score") or {}
            ft = score.get("fullTime") or {}
            rows.append(
                {
                    "source_match_id": item.get("id"),
                    "utc_date": item.get("utcDate"),
                    "status": item.get("status"),
                    "league_code": code,
                    "season": str((item.get("season") or {}).get("startDate") or "")[:4],
                    "home_team": (item.get("homeTeam") or {}).get("name"),
                    "away_team": (item.get("awayTeam") or {}).get("name"),
                    "home_score": ft.get("home"),
                    "away_score": ft.get("away"),
                    "matchday": item.get("matchday"),
                    "stage": item.get("stage"),
                }
            )

        frame = pd.DataFrame(rows)
        meta = SourceMeta(
            source="football-data.org",
            freshness_seconds=_FRESHNESS_SCHEDULE,
        ).as_dict() | {
            "competition_code": code,
            "row_count": len(frame),
            "filters": {k: str(v) for k, v in params.items()},
        }
        logger.info(
            "football-data.org: fetched %d matches for %s (params=%s)",
            len(frame),
            code,
            params,
        )
        return frame, meta

    # ------------------------------------------------------------------
    # Standings endpoint
    # ------------------------------------------------------------------

    async def standings(
        self,
        *,
        league: str,
        season: int | None = None,
    ) -> tuple[pd.DataFrame, dict[str, Any]]:
        """Fetch league standings table.

        Returns
        -------
        (DataFrame, meta_dict)
            DataFrame with columns: position, team, played, won, drawn, lost,
            goals_for, goals_against, goal_difference, points, form.
        """
        code = self._competition_code(league)
        params: dict[str, Any] = {}
        if season:
            params["season"] = season

        async with self._client() as client:
            payload = await client.get_json_with_rate_limit_backoff(
                f"/competitions/{code}/standings", params=params
            )

        standings_list = payload.get("standings") or []
        total_table: list[dict[str, Any]] = []
        for standing in standings_list:
            if standing.get("type") != "TOTAL":
                continue
            for entry in standing.get("table") or []:
                team_obj = entry.get("team") or {}
                total_table.append(
                    {
                        "position": entry.get("position"),
                        "team": team_obj.get("name"),
                        "team_id": team_obj.get("id"),
                        "played": entry.get("playedGames"),
                        "won": entry.get("won"),
                        "drawn": entry.get("draw"),
                        "lost": entry.get("lost"),
                        "goals_for": entry.get("goalsFor"),
                        "goals_against": entry.get("goalsAgainst"),
                        "goal_difference": entry.get("goalDifference"),
                        "points": entry.get("points"),
                        "form": entry.get("form"),
                    }
                )

        frame = pd.DataFrame(total_table)
        meta = SourceMeta(
            source="football-data.org",
            freshness_seconds=_FRESHNESS_STANDINGS,
        ).as_dict() | {
            "competition_code": code,
            "row_count": len(frame),
        }
        return frame, meta
