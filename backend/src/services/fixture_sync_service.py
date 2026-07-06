"""Seed the matches table with upcoming fixtures from football-data.org.

Called once at startup as a non-blocking background task. Only runs when
FOOTBALL_DATA_API_KEY is configured. Failures are logged and silently
swallowed so they never prevent the API from serving requests.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Human-readable league name (as returned by FootballDataAPIClient.TOP_COMPETITIONS)
# mapped to (league_id, country). Closed set — only supported competitions.
_LEAGUE_META: dict[str, tuple[str, str]] = {
    "EPL": ("PL", "England"),
    "La Liga": ("PD", "Spain"),
    "Bundesliga": ("BL1", "Germany"),
    "Serie A": ("SA", "Italy"),
    "Ligue 1": ("FL1", "France"),
    "Eredivisie": ("DED", "Netherlands"),
    "UCL": ("CL", "Europe"),
}


def _team_id(team_name: str, league_id: str) -> str:
    """Deterministic stable team ID so re-syncs are idempotent."""
    slug = f"{league_id}:{team_name}".lower().replace(" ", "_")
    return f"fd-team-{slug}"


async def sync_upcoming_fixtures(session: AsyncSession) -> int:
    """Fetch upcoming fixtures and upsert League/Team/Match rows.

    Returns the number of new Match rows inserted.
    """
    from ..data.loaders.football_data_api import FootballDataAPIClient, FootballDataAPIError
    from ..core.database import League, Team, Match

    client = FootballDataAPIClient()
    try:
        matches_raw = await client.get_upcoming_matches(days_ahead=7, limit=50)
    except FootballDataAPIError as exc:
        logger.warning("fixture_sync: football-data.org unavailable: %s", exc)
        return 0

    inserted = 0
    for raw in matches_raw:
        league_name: str = raw.get("league", "")
        meta = _LEAGUE_META.get(league_name)
        if not meta:
            continue  # unsupported competition — fail closed

        league_id, country = meta

        # League upsert
        if not await session.get(League, league_id):
            session.add(League(id=league_id, name=league_name, country=country))
            await session.flush()

        # Team upserts
        home_name: str = raw.get("home_team", "")
        away_name: str = raw.get("away_team", "")
        home_id = _team_id(home_name, league_id)
        away_id = _team_id(away_name, league_id)
        for tid, tname in [(home_id, home_name), (away_id, away_name)]:
            if tname and not await session.get(Team, tid):
                session.add(Team(id=tid, name=tname, league_id=league_id))
        await session.flush()

        # Match upsert
        match_id: str = raw.get("id", "")
        if not match_id or await session.get(Match, match_id):
            continue

        raw_date = raw.get("match_date", "")
        try:
            match_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            logger.debug("fixture_sync: unparseable date %r — skipping %s", raw_date, match_id)
            continue

        session.add(Match(
            id=match_id,
            league_id=league_id,
            home_team_id=home_id,
            away_team_id=away_id,
            match_date=match_date,
            season=str(datetime.now(timezone.utc).year),
            status="scheduled",
        ))
        inserted += 1

    await session.commit()
    return inserted


async def run_fixture_sync() -> None:
    """Entry point for the startup background task — swallows all errors."""
    from ..db.session import AsyncSessionLocal

    if AsyncSessionLocal is None:
        logger.warning("fixture_sync: DB not ready, skipping")
        return

    try:
        async with AsyncSessionLocal() as session:
            count = await sync_upcoming_fixtures(session)
            logger.info("fixture_sync: %d new upcoming fixtures seeded", count)
    except Exception:
        logger.exception("fixture_sync: unhandled error — continuing without fixture data")
