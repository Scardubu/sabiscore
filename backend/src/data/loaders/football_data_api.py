"""Football-Data.org v4 client for upcoming fixtures."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from ...core.config import settings


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
        date_from = now.date().isoformat()
        date_to = (now + timedelta(days=max(days_ahead, 1))).date().isoformat()

        competitions = self._resolve_competitions(league)
        normalized: List[Dict[str, Any]] = []

        headers = {
            "X-Auth-Token": self.api_key,
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(timeout=self.timeout, headers=headers) as client:
            for competition in competitions:
                params = {
                    "dateFrom": date_from,
                    "dateTo": date_to,
                    "status": "SCHEDULED",
                    "limit": limit,
                }

                response = await client.get(f"{self.BASE_URL}/competitions/{competition}/matches", params=params)
                if response.status_code == 429:
                    raise FootballDataAPIError("Football-Data API rate limit exceeded")
                if response.status_code >= 400:
                    raise FootballDataAPIError(
                        f"Football-Data API request failed ({response.status_code}) for {competition}"
                    )

                payload = response.json()
                for match in payload.get("matches", []):
                    item = self._normalize_match(match)
                    if not item:
                        continue
                    normalized.append(item)

        normalized.sort(key=lambda x: x.get("match_date") or "")
        return normalized[:limit]

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
