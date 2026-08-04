"""Repository queries for canonical and legacy fixture records."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Final, List, Sequence

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import Match
from ..db.models import MatchPredictionLog

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


# ---------------------------------------------------------------------------
# WP-3.3: settled-prediction join for walk_forward_validate() (model_registry.py)
# ---------------------------------------------------------------------------
#
# match_prediction_logs.match_id is a free-text column (no FK) sharing the
# legacy Match.id namespace — the same one WP-1's resolve_team_id()/
# canonical_season() operate on. canonical_fixture_id targets the separate
# canonical_fixtures spine, which nothing in this codebase populates today, so
# joining through it here would silently return zero rows forever.
#
# One caveat this v1 accepts rather than solves: a match can accumulate
# several prediction_logs over time (re-requested predictions); this join
# takes the MOST RECENT one per match regardless of whether it was logged
# before or after kickoff. There is currently no automatic pre-kickoff
# inference job (create_prediction() is manually/API-triggered), so this is
# not yet a live evaluation-integrity risk — but a future scheduled prediction
# job should either log a kickoff-relative flag or this query should gain a
# `MatchPredictionLog.created_at < Match.match_date` filter.


def build_settled_predictions_query(
    *,
    limit: int = 5_000,
    league: str | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
) -> Select[Any]:
    """Join the most recent logged prediction per settled fixture to its result."""

    validated_limit = _validated_limit(limit)

    latest_per_match = (
        select(
            MatchPredictionLog.match_id,
            func.max(MatchPredictionLog.created_at).label("latest_created_at"),
        )
        .group_by(MatchPredictionLog.match_id)
        .subquery()
    )

    statement = (
        select(
            Match.match_date,
            Match.home_score,
            Match.away_score,
            MatchPredictionLog.home_probability,
            MatchPredictionLog.draw_probability,
            MatchPredictionLog.away_probability,
        )
        .select_from(MatchPredictionLog)
        .join(Match, MatchPredictionLog.match_id == Match.id)
        .join(
            latest_per_match,
            and_(
                MatchPredictionLog.match_id == latest_per_match.c.match_id,
                MatchPredictionLog.created_at == latest_per_match.c.latest_created_at,
            ),
        )
        .where(
            func.lower(Match.status).in_(SETTLED_MATCH_STATUSES),
            Match.home_score.is_not(None),
            Match.away_score.is_not(None),
        )
    )

    if league:
        statement = statement.where(func.lower(Match.league_id) == league.lower())
    if started_at is not None:
        statement = statement.where(Match.match_date >= started_at)
    if ended_at is not None:
        statement = statement.where(Match.match_date <= ended_at)

    return statement.order_by(Match.match_date.asc()).limit(validated_limit)


async def get_settled_predictions(
    session: AsyncSession,
    *,
    limit: int = 5_000,
    league: str | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
) -> List[Dict[str, Any]]:
    """Return settled-fixture records shaped for
    ``model_registry.ModelRegistry.walk_forward_validate()``:
    ``{"date": ISO str, "outcome": 0|1|2, "probs": [p_home, p_draw, p_away]}``,
    where outcome is 0=home_win, 1=draw, 2=away_win.
    """

    result = await session.execute(
        build_settled_predictions_query(
            limit=limit,
            league=league,
            started_at=started_at,
            ended_at=ended_at,
        )
    )

    records: List[Dict[str, Any]] = []
    for match_date, home_score, away_score, home_prob, draw_prob, away_prob in result.all():
        if home_score > away_score:
            outcome = 0
        elif home_score == away_score:
            outcome = 1
        else:
            outcome = 2
        records.append(
            {
                "date": match_date.isoformat(),
                "outcome": outcome,
                "probs": [home_prob, draw_prob, away_prob],
            }
        )
    return records


async def get_next_upcoming_fixture(
    session: AsyncSession,
    *,
    leagues: Sequence[str] | None = None,
    within_days: int = 7,
) -> Match | None:
    """Earliest scheduled fixture in the horizon — feeds the readiness capability probe."""

    now = datetime.now(timezone.utc).replace(tzinfo=None)  # ponytail: match_date is TIMESTAMP WITHOUT TIME ZONE
    end_date = now + timedelta(days=within_days)
    statement = select(Match).where(
        Match.match_date >= now,
        Match.match_date <= end_date,
        Match.status == "scheduled",
    )
    if leagues:
        statement = statement.where(func.lower(Match.league_id).in_([league.lower() for league in leagues]))

    result = await session.execute(statement.order_by(Match.match_date.asc()).limit(1))
    return result.scalars().first()
