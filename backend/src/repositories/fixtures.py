"""Repository queries for canonical and legacy fixture records."""

from __future__ import annotations

from datetime import datetime
from typing import Final, Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import Match

# ``finished`` is the canonical status. The additional values cover historical
# loaders that pre-date the normalized schema; scores are still required, so a
# status alias alone can never qualify an unresolved fixture as settled.
SETTLED_MATCH_STATUSES: Final[tuple[str, ...]] = (
    "finished",
    "completed",
    "settled",
    "final",
)

MAX_SETTLED_FIXTURE_LIMIT: Final[int] = 20_000


def _validated_limit(limit: int) -> int:
    if not isinstance(limit, int):
        raise TypeError("limit must be an integer")
    if limit < 1 or limit > MAX_SETTLED_FIXTURE_LIMIT:
        raise ValueError(
            f"limit must be between 1 and {MAX_SETTLED_FIXTURE_LIMIT}"
        )
    return limit


def build_settled_fixtures_query(
    *,
    limit: int = 5_000,
    league: str | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    newest_first: bool = False,
) -> Select[tuple[Match]]:
    """Build the authoritative settled-fixture query.

    A fixture is settled only when its normalized/legacy final status is known
    *and* both final scores are present. This prevents postponed, abandoned, or
    partially ingested matches from entering evaluation datasets.
    """

    validated_limit = _validated_limit(limit)
    statement = select(Match).where(
        func.lower(Match.status).in_(SETTLED_MATCH_STATUSES),
        Match.home_score.is_not(None),
        Match.away_score.is_not(None),
    )

    if league:
        statement = statement.where(func.lower(Match.league_id) == league.lower())
    if started_at is not None:
        statement = statement.where(Match.match_date >= started_at)
    if ended_at is not None:
        statement = statement.where(Match.match_date <= ended_at)

    ordering = Match.match_date.desc() if newest_first else Match.match_date.asc()
    return statement.order_by(ordering, Match.id.asc()).limit(validated_limit)


async def get_settled_fixtures(
    session: AsyncSession,
    *,
    limit: int = 5_000,
    league: str | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    newest_first: bool = False,
) -> Sequence[Match]:
    """Return score-verified settled fixtures in deterministic date order."""

    result = await session.execute(
        build_settled_fixtures_query(
            limit=limit,
            league=league,
            started_at=started_at,
            ended_at=ended_at,
            newest_first=newest_first,
        )
    )
    return tuple(result.scalars().unique().all())
