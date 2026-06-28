"""Tests for api_football.py (injuries + lineups, x-apisports-key header auth).

Run:
    cd backend
    python -m pytest tests/providers/test_api_football.py -q --no-cov
"""

from __future__ import annotations

import httpx
import pytest

from src.providers.api_football import APIFootballProvider
from src.providers.base import ProviderStatus

VALID_INJURY = {
    "player": {"id": 1, "name": "Bukayo Saka"},
    "team": {"id": 57, "name": "Arsenal FC"},
    "fixture": {"id": 12345},
    "type": "Muscle Injury",
    "reason": "Hamstring"  ,
}

VALID_LINEUP_TEAM = {
    "team": {"id": 57, "name": "Arsenal FC"},
    "formation": "4-3-3",
    "startXI": [{"player": {"id": 1, "name": "Bukayo Saka"}}],
    "substitutes": [{"player": {"id": 2, "name": "Reiss Nelson"}}],
}


@pytest.mark.asyncio
async def test_injuries_happy_path(mock_client_factory):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"response": [VALID_INJURY], "errors": {}, "results": 1})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    result = await provider.injuries(competition="EPL")

    assert result.status == ProviderStatus.VERIFIED
    assert result.records[0]["player_name"] == "Bukayo Saka"
    assert result.records[0]["coherent"] is True
    assert calls[0].headers["x-apisports-key"] == "test-key"


@pytest.mark.asyncio
async def test_injuries_logical_error_in_200_response(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": [], "errors": {"league": "Invalid league"}, "results": 0})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    result = await provider.injuries(competition="EPL")

    assert result.status == ProviderStatus.UNAVAILABLE
    assert result.error_code == "api_logical_error"


@pytest.mark.asyncio
async def test_injuries_malformed_record_is_rejected_not_raised(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": [{"team": {"name": "Arsenal"}}], "errors": {}})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    result = await provider.injuries(competition="EPL")

    assert result.records[0]["coherent"] is False
    assert result.records[0]["rejection_reason"] == "missing_field_player_or_team"


@pytest.mark.asyncio
async def test_injuries_rate_limited(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    provider.max_retries = 0
    result = await provider.injuries(competition="EPL")

    assert result.status == ProviderStatus.RATE_LIMITED


@pytest.mark.asyncio
async def test_injuries_disabled_makes_no_network_call(mock_client_factory):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"response": []})

    provider = APIFootballProvider(api_key="test-key", enabled=False, http_client=mock_client_factory(handler))
    result = await provider.injuries(competition="EPL")

    assert result.status == ProviderStatus.UNAVAILABLE
    assert calls == []


@pytest.mark.asyncio
async def test_lineups_happy_path_splits_starting_and_substitute(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": [VALID_LINEUP_TEAM], "errors": {}})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    result = await provider.lineups(fixture_id=12345, competition="EPL")

    assert result.status == ProviderStatus.VERIFIED
    assert len(result.records) == 2
    roles = {r["role"] for r in result.records}
    assert roles == {"starting", "substitute"}


@pytest.mark.asyncio
async def test_lineups_requires_fixture_id(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": []})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    result = await provider.lineups(fixture_id=None)

    assert result.status == ProviderStatus.UNAVAILABLE
    assert result.error_code == "fixture_id_required"


@pytest.mark.asyncio
async def test_team_statistics_is_explicit_stub(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        raise AssertionError("team_statistics must not make a network call this round")

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    result = await provider.team_statistics(competition="EPL")

    assert result.status == ProviderStatus.PARTIAL
    assert result.error_code == "team_id_required"


@pytest.mark.asyncio
async def test_probe_verified_on_success(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": {"requests": {"current": 1, "limit_day": 100}}})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    assert await provider.probe() == ProviderStatus.VERIFIED


@pytest.mark.asyncio
async def test_probe_unavailable_on_failure(mock_client_factory):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={})

    provider = APIFootballProvider(api_key="test-key", enabled=True, http_client=mock_client_factory(handler))
    provider.max_retries = 0
    assert await provider.probe() == ProviderStatus.UNAVAILABLE
