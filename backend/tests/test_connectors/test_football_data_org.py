"""Tests for backend/src/connectors/football_data_org.py.

Uses ``respx`` to mock the football-data.org API so no real network calls
are made. If respx is not installed, tests are skipped gracefully.

Install:
    pip install respx pytest-asyncio

Run:
    cd backend && pytest tests/test_connectors/test_football_data_org.py -v
"""

from __future__ import annotations

import pytest

try:
    import respx
    import httpx

    HAS_RESPX = True
except ImportError:
    HAS_RESPX = False

pytestmark = pytest.mark.skipif(
    not HAS_RESPX, reason="respx not installed — skipping HTTP mock tests"
)


if HAS_RESPX:
    from src.connectors.football_data_org import FootballDataOrgClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_match_payload(home: str = "Arsenal", away: str = "Chelsea") -> dict:
    return {
        "matches": [
            {
                "id": 42,
                "utcDate": "2025-08-16T14:00:00Z",
                "status": "FINISHED",
                "season": {"startDate": "2025-08-01", "endDate": "2026-05-31"},
                "homeTeam": {"name": home},
                "awayTeam": {"name": away},
                "score": {
                    "fullTime": {"home": 2, "away": 1},
                },
                "matchday": 1,
                "stage": "REGULAR_SEASON",
            }
        ]
    }


def _make_standings_payload() -> dict:
    return {
        "standings": [
            {
                "type": "TOTAL",
                "table": [
                    {
                        "position": 1,
                        "team": {"name": "Arsenal", "id": 57},
                        "playedGames": 5,
                        "won": 4,
                        "draw": 1,
                        "lost": 0,
                        "goalsFor": 12,
                        "goalsAgainst": 3,
                        "goalDifference": 9,
                        "points": 13,
                        "form": "WWWDW",
                    }
                ],
            }
        ]
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_matches_returns_dataframe_and_meta():
    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        mock.get("/competitions/PL/matches").mock(
            return_value=httpx.Response(
                200, json=_make_match_payload(), headers={"Content-Type": "application/json"}
            )
        )
        client = FootballDataOrgClient(api_key="test-key")
        frame, meta = await client.matches(league="epl", season=2025)

    assert len(frame) == 1
    assert frame.iloc[0]["home_team"] == "Arsenal"
    assert frame.iloc[0]["home_score"] == 2
    assert meta["source"] == "football-data.org"
    assert meta["competition_code"] == "PL"
    assert meta["row_count"] == 1


@pytest.mark.asyncio
async def test_matches_league_code_mapping():
    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        route = mock.get("/competitions/BL1/matches").mock(
            return_value=httpx.Response(200, json={"matches": []})
        )
        client = FootballDataOrgClient(api_key="test-key")
        await client.matches(league="bundesliga")
    assert route.called


@pytest.mark.asyncio
async def test_matches_raw_code_passthrough():
    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        route = mock.get("/competitions/SA/matches").mock(
            return_value=httpx.Response(200, json={"matches": []})
        )
        client = FootballDataOrgClient(api_key="test-key")
        await client.matches(league="SA")
    assert route.called


@pytest.mark.asyncio
async def test_standings_returns_dataframe():
    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        mock.get("/competitions/PL/standings").mock(
            return_value=httpx.Response(200, json=_make_standings_payload())
        )
        client = FootballDataOrgClient(api_key="test-key")
        frame, meta = await client.standings(league="epl")

    assert len(frame) == 1
    assert frame.iloc[0]["team"] == "Arsenal"
    assert frame.iloc[0]["points"] == 13
    assert meta["source"] == "football-data.org"


@pytest.mark.asyncio
async def test_matches_handles_empty_response():
    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        mock.get("/competitions/PL/matches").mock(
            return_value=httpx.Response(200, json={"matches": []})
        )
        client = FootballDataOrgClient(api_key="test-key")
        frame, meta = await client.matches(league="epl")

    assert frame.empty
    assert meta["row_count"] == 0


@pytest.mark.asyncio
async def test_matches_rate_limit_honoured():
    """A 429 followed by a valid response should succeed after backoff."""
    call_count = 0

    async def _side_effect(request):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json=_make_match_payload())

    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        mock.get("/competitions/PL/matches").mock(side_effect=_side_effect)
        client = FootballDataOrgClient(api_key="test-key")
        frame, _ = await client.matches(league="epl")

    assert len(frame) == 1
    assert call_count == 2


@pytest.mark.asyncio
async def test_matches_raises_connector_error_on_bad_payload():
    from src.connectors.base import ConnectorError

    with respx.mock(base_url="https://api.football-data.org/v4") as mock:
        mock.get("/competitions/PL/matches").mock(
            return_value=httpx.Response(200, json={"matches": "not-a-list"})
        )
        client = FootballDataOrgClient(api_key="test-key")
        with pytest.raises(ConnectorError):
            await client.matches(league="epl")
