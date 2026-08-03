"""WP-1 regression tests: resolve_team_id() must handle short-name vs
legal-name variants (D2a) via affix-stripping and reconcile_team() fallback,
while still failing closed on true nicknames and ambiguous names.
"""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.core.database import Base, Team
from src.services.team_identity import resolve_team_id
from src.utils.season import canonical_season
from datetime import datetime


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


async def _seed(session: AsyncSession, *names: str) -> None:
    session.add_all([Team(id=f"team-{i}", name=n, active=True) for i, n in enumerate(names)])
    await session.commit()


async def test_exact_match(session: AsyncSession) -> None:
    await _seed(session, "Arsenal", "Chelsea")
    assert await resolve_team_id("Arsenal", session) == "team-0"


async def test_case_insensitive_exact_match(session: AsyncSession) -> None:
    await _seed(session, "Arsenal", "Chelsea")
    assert await resolve_team_id("arsenal", session) == "team-0"


async def test_short_name_resolves_against_legal_name_suffix(session: AsyncSession) -> None:
    await _seed(session, "Arsenal FC", "Chelsea FC")
    assert await resolve_team_id("Arsenal", session) == "team-0"


async def test_legal_name_resolves_against_short_name(session: AsyncSession) -> None:
    await _seed(session, "Arsenal", "Chelsea")
    assert await resolve_team_id("Arsenal FC", session) == "team-0"


async def test_afc_prefix_resolves(session: AsyncSession) -> None:
    await _seed(session, "AFC Bournemouth", "Chelsea")
    assert await resolve_team_id("Bournemouth", session) == "team-0"


async def test_true_nickname_fails_closed(session: AsyncSession) -> None:
    await _seed(session, "Tottenham Hotspur", "Chelsea")
    # documented limitation (reconciliation.py docstring): nicknames need alias
    # resolution, not threshold tuning — this must stay unresolved, not guessed.
    assert await resolve_team_id("Spurs", session) is None


async def test_unrelated_name_fails_closed(session: AsyncSession) -> None:
    await _seed(session, "Arsenal", "Chelsea")
    assert await resolve_team_id("Some Nonexistent FC", session) is None


async def test_empty_name_fails_closed(session: AsyncSession) -> None:
    await _seed(session, "Arsenal")
    assert await resolve_team_id("", session) is None
    assert await resolve_team_id("   ", session) is None


async def test_no_teams_in_db_fails_closed(session: AsyncSession) -> None:
    assert await resolve_team_id("Arsenal", session) is None


def test_canonical_season_format_parity() -> None:
    # August match -> current/next year season
    assert canonical_season(datetime(2026, 8, 10)) == "2026/2027"
    # February match -> previous/current year season
    assert canonical_season(datetime(2027, 2, 15)) == "2026/2027"
    # boundary: July 1 flips to the new season
    assert canonical_season(datetime(2026, 7, 1)) == "2026/2027"
    assert canonical_season(datetime(2026, 6, 30)) == "2025/2026"
