"""Football-Data.org v4 client for upcoming fixtures."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

import httpx

from ...connectors.base import AsyncJSONClient, ConnectorError, ConnectorRateLimitError
from ...core.config import settings

logger = logging.getLogger(__name__)

# Free tier is 10 requests/minute, so the quota window resets within a minute.
# Waiting longer than that on a boot background task buys nothing.
_RATE_LIMIT_MAX_WAIT_SECONDS = 60.0


class FootballDataAPIError(RuntimeError):
    """Raised when Football-Data.org API requests fail."""


class FootballDataAPIClient:
    """Fetch and normalize upcoming football fixtures from Football-Data.org."""

    BASE_URL = "https://api.football-data.org/v4"
    TOP_COMPETITIONS = {
        "PL": "EPL",
        "PD": "La Liga",
        "BL1": "Bundesliga",
        "SA": "Serie A",
        "FL1": "Ligue 1",
        "DED": "Eredivisie",
        "CL": "UCL",
    }

    def __init__(self, api_key: Optional[str] = None, timeout_seconds: Optional[int] = None):
        self.api_key = api_key or settings.football_data_api_key
        self.timeout = timeout_seconds or max(int(settings.request_timeout), 10)

    async def get_upcoming_matches(
        self,
        days_ahead: int = 7,
        limit: int = 20,
        league: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return normalized upcoming matches for supported top leagues/competitions."""
        if getattr(settings, "mock_mode", False):
            return self._mock_matches(days_ahead=days_ahead, limit=limit, league=league)

        if not self.api_key:
            raise FootballDataAPIError("FOOTBALL_DATA_API_KEY is not configured")

        now = datetime.now(timezone.utc)
        return await self._fetch_competitions(
            competitions=self._resolve_competitions(league),
            date_from=now.date().isoformat(),
            date_to=(now + timedelta(days=max(days_ahead, 1))).date().isoformat(),
            status="SCHEDULED",
            limit=limit,
            normalizer=self._normalize_match,
        )

    async def _fetch_competitions(
        self,
        *,
        competitions: List[str],
        date_from: str,
        date_to: str,
        status: str,
        limit: int,
        normalizer: Callable[[Dict[str, Any]], Optional[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """Fetch one status window across competitions, isolating per-competition failure.

        The free tier allows 10 requests/minute and this issues one request per
        competition, so hitting the quota mid-loop is routine rather than
        exceptional. Previously any single failure raised and discarded every
        competition already collected *and* every one not yet attempted —
        observed in production 2026-08-08, where a 429 on the first competition
        seeded 0 fixtures across all seven leagues.

        Failures are now isolated per competition. A 429 that survives the
        Retry-After backoff means the quota is genuinely spent, so the loop stops
        rather than burning further requests, but still returns what it collected.
        Raises only when every competition failed and nothing came back at all.
        """
        normalized: List[Dict[str, Any]] = []
        failures: List[str] = []

        async with AsyncJSONClient(
            base_url=self.BASE_URL,
            headers={"X-Auth-Token": self.api_key},
            timeout_seconds=float(self.timeout),
        ) as client:
            for index, competition in enumerate(competitions):
                params = {
                    "dateFrom": date_from,
                    "dateTo": date_to,
                    "status": status,
                    "limit": limit,
                }
                try:
                    payload = await client.get_json_with_rate_limit_backoff(
                        f"/competitions/{competition}/matches",
                        params=params,
                        max_wait_seconds=_RATE_LIMIT_MAX_WAIT_SECONDS,
                    )
                except ConnectorRateLimitError:
                    # ponytail: quota genuinely spent (the 429 survived a full
                    # Retry-After wait) — further requests only waste it.
                    failures.append(f"{competition}: rate limited")
                    logger.warning(
                        "football_data: quota exhausted at %s — keeping %d match(es) from %d competition(s)",
                        competition,
                        len(normalized),
                        index,
                    )
                    break
                except (ConnectorError, httpx.HTTPError) as exc:
                    failures.append(f"{competition}: {type(exc).__name__}")
                    logger.warning("football_data: %s unavailable: %s", competition, exc)
                    continue

                for match in payload.get("matches", []):
                    item = normalizer(match)
                    if item:
                        normalized.append(item)

        if failures and not normalized:
            raise FootballDataAPIError(
                f"Football-Data API returned no data ({'; '.join(failures)})"
            )

        normalized.sort(key=lambda x: x.get("match_date") or "")
        return normalized[:limit]

    async def get_recent_results(
        self,
        days_back: int = 3,
        limit: int = 20,
        league: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return normalized recently-finished matches with final scores.

        Mirrors get_upcoming_matches's request shape but queries the *past*
        for status=FINISHED, and extracts scores instead of discarding them.
        """
        if getattr(settings, "mock_mode", False):
            return self._mock_results(days_back=days_back, limit=limit)

        if not self.api_key:
            raise FootballDataAPIError("FOOTBALL_DATA_API_KEY is not configured")

        now = datetime.now(timezone.utc)
        return await self._fetch_competitions(
            competitions=self._resolve_competitions(league),
            date_from=(now - timedelta(days=max(days_back, 1))).date().isoformat(),
            date_to=now.date().isoformat(),
            status="FINISHED",
            limit=limit,
            normalizer=self._normalize_result,
        )

    def _resolve_competitions(self, league: Optional[str]) -> List[str]:
        if not league:
            return list(self.TOP_COMPETITIONS.keys())

        normalized = league.strip().lower().replace("-", "_").replace(" ", "_")
        reverse_map = {
            "epl": "PL",
            "premier_league": "PL",
            "la_liga": "PD",
            "laliga": "PD",
            "bundesliga": "BL1",
            "serie_a": "SA",
            "seriea": "SA",
            "ligue_1": "FL1",
            "ligue1": "FL1",
            "eredivisie": "DED",
            "ucl": "CL",
            "champions_league": "CL",
            "uefa_champions_league": "CL",
        }
        code = reverse_map.get(normalized)
        return [code] if code else list(self.TOP_COMPETITIONS.keys())

    def _normalize_match(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        home = (raw.get("homeTeam") or {}).get("name")
        away = (raw.get("awayTeam") or {}).get("name")
        utc_date = raw.get("utcDate")
        comp_code = ((raw.get("competition") or {}).get("code") or "").upper()
        league = self.TOP_COMPETITIONS.get(comp_code, (raw.get("competition") or {}).get("name") or "Unknown")

        if not home or not away or not utc_date:
            return None

        match_id = raw.get("id")
        if match_id is None:
            return None

        return {
            "id": f"fd-{match_id}",
            "home_team": str(home),
            "away_team": str(away),
            "league": league,
            "match_date": utc_date,
            "match_round": str(raw.get("stage") or raw.get("matchday") or "") or None,
            "venue": None,
            "status": "scheduled",
            "has_odds": False,
            "source": "football-data.org",
        }

    def _normalize_result(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract {id, match_date, home_score, away_score, status} from a
        finished match's raw v4 payload. None on any missing field — covers
        postponed/awarded oddities that still slip through the status filter.
        """
        match_id = raw.get("id")
        utc_date = raw.get("utcDate")
        full_time = ((raw.get("score") or {}).get("fullTime")) or {}
        home_score = full_time.get("home")
        away_score = full_time.get("away")

        if match_id is None or not utc_date or home_score is None or away_score is None:
            return None

        return {
            "id": f"fd-{match_id}",
            "match_date": utc_date,
            "home_score": home_score,
            "away_score": away_score,
            "status": "finished",
        }

    def _mock_results(self, days_back: int, limit: int) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        samples = [(2, 1), (0, 0), (1, 3)]
        result: List[Dict[str, Any]] = []
        for idx, (home_score, away_score) in enumerate(samples):
            kickoff = now - timedelta(days=idx + 1)
            if kickoff < now - timedelta(days=max(days_back, 1)):
                continue
            result.append(
                {
                    "id": f"mock-fd-{idx+1}",
                    "match_date": kickoff.isoformat(),
                    "home_score": home_score,
                    "away_score": away_score,
                    "status": "finished",
                }
            )
        return result[:limit]

    def _mock_matches(self, days_ahead: int, limit: int, league: Optional[str]) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        samples = [
            ("Arsenal", "Chelsea", "EPL"),
            ("Real Madrid", "Valencia", "La Liga"),
            ("Bayern Munich", "Leverkusen", "Bundesliga"),
            ("Inter", "Roma", "Serie A"),
            ("PSG", "Lyon", "Ligue 1"),
            ("Ajax", "PSV", "Eredivisie"),
            ("Manchester City", "Bayern Munich", "UCL"),
        ]

        result: List[Dict[str, Any]] = []
        for idx, (home, away, lg) in enumerate(samples):
            if league and league.lower() not in lg.lower().replace(" ", ""):
                continue
            kickoff = now + timedelta(hours=idx * 8 + 2)
            if kickoff > now + timedelta(days=max(days_ahead, 1)):
                continue
            result.append(
                {
                    "id": f"mock-fd-{idx+1}",
                    "home_team": home,
                    "away_team": away,
                    "league": lg,
                    "match_date": kickoff.isoformat(),
                    "venue": None,
                    "status": "scheduled",
                    "has_odds": False,
                    "source": "mock",
                }
            )

        return result[:limit]
