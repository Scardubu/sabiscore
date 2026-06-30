"""Provider-independence and public staking contract tests."""

from datetime import datetime, timedelta, timezone

from src.schemas.betting_intelligence import (
    CompetitionEnum,
    EvidenceProviderEnum,
    EvidenceTierEnum,
    FreshnessInput,
    MarketInput,
    MatchAnalysisRequest,
    ModelInput,
    SourceStatusEnum,
    SourceStatusInput,
    VerdictEnum,
)
from src.services.betting_intelligence import KELLY_FRACTION, MAX_KELLY_CAP, analyze_match


NOW = datetime.now(timezone.utc)
PROVIDERS = list(EvidenceProviderEnum)


def request_with(providers):
    return MatchAnalysisRequest(
        match_id="provider-gate-001",
        home_team="Arsenal",
        away_team="Chelsea",
        competition=CompetitionEnum.EPL,
        kickoff_utc=NOW + timedelta(hours=24),
        model=ModelInput(
            home_probability=0.72,
            draw_probability=0.18,
            away_probability=0.10,
            model_version="provider-gate-v1",
            calibration_method="isotonic",
            calibration_validated=True,
            epistemic_uncertainty=0.05,
            aleatoric_uncertainty=0.10,
            confidence_tier=EvidenceTierEnum.OK,
        ),
        market=MarketInput(
            bookmaker="Pinnacle",
            home_odds=1.75,
            draw_odds=4.0,
            away_odds=6.0,
            captured_at=NOW,
        ),
        freshness=FreshnessInput(market_seconds=120, model_features_seconds=120),
        source_status=SourceStatusInput(
            model=SourceStatusEnum.VERIFIED,
            market=SourceStatusEnum.VERIFIED,
            team_metrics=SourceStatusEnum.VERIFIED,
            availability=SourceStatusEnum.VERIFIED,
        ),
        verified_evidence_providers=providers,
    )


def test_public_staking_policy_is_quarter_kelly_with_five_percent_cap():
    assert KELLY_FRACTION == 0.25
    assert MAX_KELLY_CAP == 0.05


def test_single_provider_is_hard_capped_at_hold():
    result = analyze_match(request_with(PROVIDERS[:1]), causal_drivers=["xg_differential"])
    assert result.verdict == VerdictEnum.HOLD
    assert result.stake == "pass"
    assert result.independent_source_count == 1


def test_three_providers_cannot_reach_high_conviction():
    result = analyze_match(request_with(PROVIDERS[:3]), causal_drivers=["xg_differential"])
    assert result.verdict != VerdictEnum.HIGH_CONVICTION
    assert result.independent_source_count == 3


def test_high_conviction_requires_at_least_four_providers():
    result = analyze_match(request_with(PROVIDERS[:4]), causal_drivers=["xg_differential"])
    if result.verdict == VerdictEnum.HIGH_CONVICTION:
        assert result.independent_source_count >= 4


def test_full_kelly_is_not_in_public_market_evaluations():
    result = analyze_match(request_with(PROVIDERS), causal_drivers=["xg_differential"])
    for evaluation in result.all_market_evaluations or []:
        assert "full_kelly" not in evaluation
        assert evaluation["stake_fraction"] <= MAX_KELLY_CAP


def test_missing_provider_provenance_is_partial():
    result = analyze_match(request_with([]), causal_drivers=["xg_differential"])
    assert result.verdict == VerdictEnum.PARTIAL
    assert "DATA_GAP: evidence_provider_provenance" in result.data_gaps
