"""Per-competition failure isolation in FootballDataAPIClient.

Regression guard for the 2026-08-08 production incident: a 429 on the FIRST
of seven competitions raised and discarded all seven, so fixture_sync logged
"0 new upcoming fixtures seeded" while six leagues were never even attempted.

Contracts verified:
  1. A mid-loop rate limit keeps the competitions already fetched.
  2. A mid-loop HTTP error skips only that competition; the rest still load.
  3. Total failure (nothing collected anywhere) still raises, so the caller's
     warning + metrics path fires rather than silently returning empty.
  4. get_recent_results() shares the same isolation (same helper, one fix).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from src.connectors.base import ConnectorRateLimitError
from src.data.loaders.football_data_api import (
    FootballDataAPIClient,
    FootballDataAPIError,
)


def _match(match_id: int, comp_code: str, utc_date: str = "2026-08-20T15:00:00Z") -> dict:
    return {
        "id": match_id,
        "utcDate": utc_date,
        "homeTeam": {"name": f"Home {match_id}"},
        "awayTeam": {"name": f"Away {match_id}"},
        "competition": {"code": comp_code, "name": comp_code},
    }


def _result(match_id: int, comp_code: str, utc_date: str = "2026-08-01T15:00:00Z") -> dict:
    return {
        "id": match_id,
        "utcDate": utc_date,
        "homeTeam": {"name": f"Home {match_id}"},
        "awayTeam": {"name": f"Away {match_id}"},
        "competition": {"code": comp_code, "name": comp_code},
        "score": {"fullTime": {"home": 2, "away": 1}},
    }


def _client_yielding(side_effect) -> AsyncMock:
    """An AsyncJSONClient stand-in usable as an async context manager."""
    inner = AsyncMock()
    inner.get_json_with_rate_limit_backoff.side_effect = side_effect
    ctx = AsyncMock()
    ctx.__aenter__.return_value = inner
    ctx.__aexit__.return_value = False
    return ctx


async def test_rate_limit_midloop_keeps_already_fetched_competitions() -> None:
    """PL and PD succeed, BL1 is rate-limited: the two successes survive."""
    side_effect = [
        {"matches": [_match(1, "PL")]},
        {"matches": [_match(2, "PD")]},
        ConnectorRateLimitError("quota spent", retry_after_seconds=60.0),
    ]
    client = FootballDataAPIClient(api_key="test-key")

    with patch(
        "src.data.loaders.football_data_api.AsyncJSONClient",
        return_value=_client_yielding(side_effect),
    ):
        matches = await client.get_upcoming_matches(days_ahead=14, limit=50)

    # Pre-fix this returned nothing at all — the raise discarded PL and PD.
    assert len(matches) == 2
    assert {m["id"] for m in matches} == {"fd-1", "fd-2"}


async def test_http_error_skips_only_that_competition() -> None:
    """A 403 on one competition must not stop the ones after it."""
    request = httpx.Request("GET", "https://api.football-data.org/v4/x")
    side_effect = [
        httpx.HTTPStatusError(
            "forbidden", request=request, response=httpx.Response(403, request=request)
        ),
        {"matches": [_match(3, "PD")]},
        {"matches": [_match(4, "BL1")]},
        {"matches": []},
        {"matches": []},
        {"matches": []},
        {"matches": []},
    ]
    client = FootballDataAPIClient(api_key="test-key")

    with patch(
        "src.data.loaders.football_data_api.AsyncJSONClient",
        return_value=_client_yielding(side_effect),
    ):
        matches = await client.get_upcoming_matches(days_ahead=14, limit=50)

    assert {m["id"] for m in matches} == {"fd-3", "fd-4"}


async def test_total_failure_still_raises() -> None:
    """Nothing collected anywhere -> raise, so the caller logs + records metrics."""
    client = FootballDataAPIClient(api_key="test-key")
    side_effect = ConnectorRateLimitError("quota spent", retry_after_seconds=60.0)

    with patch(
        "src.data.loaders.football_data_api.AsyncJSONClient",
        return_value=_client_yielding(side_effect),
    ):
        with pytest.raises(FootballDataAPIError):
            await client.get_upcoming_matches(days_ahead=14, limit=50)


async def test_recent_results_shares_the_same_isolation() -> None:
    """get_recent_results() had the identical defect; one helper fixes both."""
    side_effect = [
        {"matches": [_result(10, "PL")]},
        ConnectorRateLimitError("quota spent", retry_after_seconds=60.0),
    ]
    client = FootballDataAPIClient(api_key="test-key")

    with patch(
        "src.data.loaders.football_data_api.AsyncJSONClient",
        return_value=_client_yielding(side_effect),
    ):
        results = await client.get_recent_results(days_back=3, limit=100)

    assert len(results) == 1
    assert results[0]["id"] == "fd-10"
    assert results[0]["home_score"] == 2
