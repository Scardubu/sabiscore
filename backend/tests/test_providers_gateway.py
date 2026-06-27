import pytest

from src.providers.espn import ESPN_LEAGUE_SLUGS, ESPNProvider
from src.providers.base import ProviderResult, ProviderStatus, TrustTier
from src.providers.reconciliation import FixtureCandidate, reconcile_fixture
from src.providers.registry import build_provider_registry


def test_espn_gateway_is_keyless_supplementary_and_covers_supported_slugs():
    provider = ESPNProvider(enabled=True, live_tests=False)

    assert provider.provider_id == "espn"
    assert provider.requires_key is False
    assert provider.trust_tier is TrustTier.UNOFFICIAL_PUBLIC
    assert set(ESPN_LEAGUE_SLUGS) == {
        "EPL",
        "LA_LIGA",
        "SERIE_A",
        "BUNDESLIGA",
        "LIGUE_1",
        "EREDIVISIE",
        "UCL",
    }


@pytest.mark.asyncio
async def test_espn_scoreboard_fails_closed_when_live_calls_disabled():
    provider = ESPNProvider(enabled=True, live_tests=False)

    result = await provider.scoreboard("EPL")

    assert isinstance(result, ProviderResult)
    assert result.status is ProviderStatus.PARTIAL
    assert result.records == []
    assert "live_provider_calls_disabled" in result.warnings


def test_provider_registry_registers_canonical_provider_set():
    registry = build_provider_registry()
    provider_ids = {provider.provider_id for provider in registry.providers}

    assert provider_ids == {
        "espn",
        "football_data_org",
        "api_football",
        "sportmonks",
        "the_odds_api",
    }
    assert registry.get("espn").requires_key is False
    assert registry.get("the_odds_api").requires_key is True


def test_reconciliation_reports_ambiguity_instead_of_guessing():
    from datetime import datetime, timezone

    provider_record = FixtureCandidate(
        fixture_id="provider-a",
        provider="espn",
        provider_event_id="a",
        home_team="Arsenal",
        away_team="Chelsea",
        kickoff_utc=datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc),
        competition="EPL",
    )
    candidates = [
        FixtureCandidate(
            fixture_id="fixture-1",
            provider="football_data_org",
            provider_event_id="b",
            home_team="Arsenal",
            away_team="Chelsea",
            kickoff_utc=datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc),
            competition="EPL",
        ),
        FixtureCandidate(
            fixture_id="fixture-2",
            provider="api_football",
            provider_event_id="c",
            home_team="Arsenal",
            away_team="Chelsea",
            kickoff_utc=datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc),
            competition="EPL",
        ),
    ]

    decision = reconcile_fixture(provider_record, candidates)

    assert decision.status == "CONFLICTING"
    assert decision.fixture_id is None
    assert decision.reason == "ambiguous_candidate"
