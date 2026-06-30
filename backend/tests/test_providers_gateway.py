import pytest

from src.providers.espn import ESPN_LEAGUE_SLUGS, ESPNProvider
from src.providers.base import ProviderResult, ProviderStatus, TrustTier
from src.providers.reconciliation import FixtureCandidate, reconcile_fixture
from src.providers.registry import build_provider_registry
from src.providers.orchestrator import EvidenceOrchestrator, EvidenceProfile


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


@pytest.mark.asyncio
async def test_enabled_provider_health_is_configured_not_verified_without_live_probe():
    provider = ESPNProvider(enabled=True, live_tests=False)

    health = await provider.health()

    assert health.status is ProviderStatus.CONFIGURED_UNVERIFIED
    assert health.configured is True
    assert "live_probe_not_run" in health.warnings


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


def test_reconciliation_requires_review_for_single_low_confidence_candidate():
    """A single plausible-but-imperfect candidate is reviewable, not unknown.

    Distinct from CONFLICTING (multiple equally-scored candidates) and from
    UNKNOWN (no candidate at all): here there is exactly one candidate that
    cleared the kickoff/competition filter but didn't reach the auto-accept
    confidence bar, so a human reviewer needs the fixture_id to confirm it.
    """
    from datetime import datetime, timezone

    # "Man United" vs "Manchester United" is a single-field abbreviation with
    # an otherwise exact match (away team + kickoff) — scores ~0.896 with
    # SequenceMatcher, comfortably inside [REVIEW_THRESHOLD, AUTO_ACCEPT_THRESHOLD).
    provider_record = FixtureCandidate(
        fixture_id="provider-a",
        provider="espn",
        provider_event_id="a",
        home_team="Man United",
        away_team="Chelsea",
        kickoff_utc=datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc),
        competition="EPL",
    )
    candidates = [
        FixtureCandidate(
            fixture_id="fixture-1",
            provider="football_data_org",
            provider_event_id="b",
            home_team="Manchester United",
            away_team="Chelsea",
            kickoff_utc=datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc),
            competition="EPL",
        ),
    ]

    decision = reconcile_fixture(provider_record, candidates)

    assert decision.status == "REQUIRES_REVIEW"
    assert decision.fixture_id is None
    assert decision.review_candidate_id == "fixture-1"
    assert decision.reason == "below_auto_accept_threshold_but_reviewable"


def test_reconciliation_unknown_only_when_no_candidate_exists():
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

    decision = reconcile_fixture(provider_record, [])

    assert decision.status == "UNKNOWN"
    assert decision.fixture_id is None
    assert decision.reason == "no_candidate"


@pytest.mark.asyncio
async def test_production_cycle_fans_out_across_profile_groups(monkeypatch):
    registry = build_provider_registry()
    orchestrator = EvidenceOrchestrator(registry)

    async def standard(_fixture, _competition):
        return [
            ProviderResult(
                provider="football_data_org",
                operation="standings",
                status=ProviderStatus.VERIFIED,
                trust_tier=TrustTier.OFFICIAL_AUTHENTICATED,
                records=[{"position": 1}],
            )
        ]

    async def enriched(_fixture, _competition):
        return [
            ProviderResult(
                provider="api_football",
                operation="injuries",
                status=ProviderStatus.VERIFIED,
                trust_tier=TrustTier.OFFICIAL_AUTHENTICATED,
                records=[{"player": "A"}],
            )
        ]

    async def market(_fixture, _competition, _canonical_fixture_id):
        return [
            ProviderResult(
                provider="the_odds_api",
                operation="odds",
                status=ProviderStatus.VERIFIED,
                trust_tier=TrustTier.OFFICIAL_AUTHENTICATED,
                records=[{"bookmaker": "Pinnacle"}],
            )
        ]

    monkeypatch.setattr(orchestrator, "_collect_prematch_standard", standard)
    monkeypatch.setattr(orchestrator, "_collect_prematch_enriched", enriched)
    monkeypatch.setattr(orchestrator, "_collect_market_refresh", market)

    results = await orchestrator.collect(
        {"competition": "EPL"},
        EvidenceProfile.PRODUCTION_CYCLE,
        canonical_fixture_id="fixture-1",
    )

    assert [result.provider for result in results] == [
        "football_data_org",
        "api_football",
        "the_odds_api",
    ]
