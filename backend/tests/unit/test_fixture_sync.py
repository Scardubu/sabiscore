"""Unit tests for fixture_sync_service.sync_upcoming_fixtures().

Three contracts verified:
  1. Idempotency — re-syncing the same data inserts 0 new rows.
  2. Unsupported competition — unknown league names are silently dropped.
  3. Malformed date — un-parseable match_date skips that match; valid ones still insert.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.core.database import Base


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


def _match(n: int, league: str = "EPL", date: str = "2026-07-15T15:00:00Z") -> dict:
    return {
        "id": f"fd-match-{n}",
        "league": league,
        "home_team": f"TeamA {n}",
        "away_team": f"TeamB {n}",
        "match_date": date,
    }


def _mock_client(matches: list) -> tuple:
    """Return (patch target, configured mock) for FootballDataAPIClient."""
    mock = AsyncMock()
    mock.get_upcoming_matches.return_value = matches
    return mock


async def test_idempotent_resync(session: AsyncSession) -> None:
    """Re-syncing identical data inserts 0 rows on the second call."""
    from src.services.fixture_sync_service import sync_upcoming_fixtures

    matches = [_match(1), _match(2)]
    with patch("src.data.loaders.football_data_api.FootballDataAPIClient") as MockCls:
        MockCls.return_value = _mock_client(matches)
        count_first = await sync_upcoming_fixtures(session)

        MockCls.return_value = _mock_client(matches)
        count_second = await sync_upcoming_fixtures(session)

    assert count_first == 2
    assert count_second == 0  # idempotent — nothing new to insert


async def test_unsupported_competition_skipped(session: AsyncSession) -> None:
    """Matches whose league is not in the 7-competition closed set are dropped."""
    from src.services.fixture_sync_service import sync_upcoming_fixtures

    matches = [
        _match(10, league="EPL"),           # supported
        _match(11, league="FIFA World Cup"), # unsupported — must be skipped
        _match(12, league="EPL"),           # supported
    ]
    with patch("src.data.loaders.football_data_api.FootballDataAPIClient") as MockCls:
        MockCls.return_value = _mock_client(matches)
        count = await sync_upcoming_fixtures(session)

    assert count == 2  # only the two EPL matches inserted


async def test_malformed_date_skipped(session: AsyncSession) -> None:
    """A match with an un-parseable match_date is skipped; valid neighbours still insert."""
    from src.services.fixture_sync_service import sync_upcoming_fixtures

    matches = [
        _match(20, league="EPL"),                               # good
        _match(21, league="EPL", date="not-a-date"),            # bad date → skip
        _match(22, league="EPL"),                               # good
    ]
    with patch("src.data.loaders.football_data_api.FootballDataAPIClient") as MockCls:
        MockCls.return_value = _mock_client(matches)
        count = await sync_upcoming_fixtures(session)

    assert count == 2  # bad-date match dropped, two valid matches inserted
