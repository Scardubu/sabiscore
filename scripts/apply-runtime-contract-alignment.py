#!/usr/bin/env python3
"""Align betting runtime, HTTP contract, frontend types, and certification tests."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


service_path = "backend/src/services/betting_intelligence.py"
service = read(service_path)
service = replace_once(
    service,
    "KELLY_FRACTION: float = 0.125             # one-eighth Kelly\nMAX_KELLY_CAP: float = 0.025              # 2.5% of bankroll\n",
    "KELLY_FRACTION: float = 0.25              # Quarter-Kelly public default\nMAX_KELLY_CAP: float = 0.05               # hard 5% bankroll ceiling\n",
    "Kelly policy constants",
)
service = replace_once(
    service,
    'CONTRACT_VERSION: str = "1.2.0"\nPOLICY_VERSION: str = "1.0"\n',
    'CONTRACT_VERSION: str = "1.3.0"\nPOLICY_VERSION: str = "1.1"\n',
    "service contract versions",
)
service = replace_once(
    service,
    '            "full_kelly": round(fk, 6),\n',
    "",
    "public full Kelly field",
)
service = replace_once(
    service,
    "    high_conviction_edge: float = HIGH_CONVICTION_EDGE,\n) -> VerdictEnum:\n",
    "    high_conviction_edge: float = HIGH_CONVICTION_EDGE,\n    independent_source_count: int = 0,\n) -> VerdictEnum:\n",
    "verdict source-count parameter",
)
service = replace_once(
    service,
    "    # -- Gate 3: HOLD ---------------------------------------------------------\n    tier_low = model.confidence_tier == EvidenceTierEnum.LOW_EVIDENCE\n",
    "    # -- Gate 3: HOLD ---------------------------------------------------------\n    # A single provider (or absent provider provenance) can never produce an\n    # execution verdict. Independent ownership, not row count, is the unit.\n    if independent_source_count <= 1:\n        return VerdictEnum.HOLD\n\n    tier_low = model.confidence_tier == EvidenceTierEnum.LOW_EVIDENCE\n",
    "single-provider HOLD ceiling",
)
service = replace_once(
    service,
    "        and has_causal_support\n        and sharp_signal in (SharpSignalEnum.CONFIRMING, SharpSignalEnum.NEUTRAL, SharpSignalEnum.UNKNOWN)\n",
    "        and has_causal_support\n        and independent_source_count >= 4\n        and sharp_signal in (SharpSignalEnum.CONFIRMING, SharpSignalEnum.NEUTRAL, SharpSignalEnum.UNKNOWN)\n",
    "HIGH_CONVICTION provider gate",
)
service = replace_once(
    service,
    "    model = request.model\n    market = request.market\n",
    "    model = request.model\n    market = request.market\n    independent_source_count = len(set(request.verified_evidence_providers))\n",
    "request provider count",
)
service = replace_once(
    service,
    "        high_conviction_edge=high_conviction_edge,\n    )\n",
    "        high_conviction_edge=high_conviction_edge,\n        independent_source_count=independent_source_count,\n    )\n",
    "pass provider count to verdict gate",
)
service = replace_once(
    service,
    '''        source_summary={
            "model": request.source_status.model.value,
            "market": request.source_status.market.value,
            "team_metrics": request.source_status.team_metrics.value,
            "availability": request.source_status.availability.value,
        },
''',
    '''        source_summary={
            "model": request.source_status.model.value,
            "market": request.source_status.market.value,
            "team_metrics": request.source_status.team_metrics.value,
            "availability": request.source_status.availability.value,
            "providers": [provider.value for provider in request.verified_evidence_providers],
            "independent_source_count": independent_source_count,
        },
        verified_evidence_providers=request.verified_evidence_providers,
        independent_source_count=independent_source_count,
''',
    "result provider provenance",
)
write(service_path, service)


endpoint_path = "backend/src/api/endpoints/betting_intelligence.py"
endpoint = read(endpoint_path)
endpoint = endpoint.replace('"contract_version": "1.2.0"', '"contract_version": "1.3.0"')
endpoint = endpoint.replace('"engine_version": "1.1.0"', '"engine_version": "1.2.0"')
endpoint = endpoint.replace('"policy_version": "1.0"', '"policy_version": "1.1"')
write(endpoint_path, endpoint)


web_path = "apps/web/src/lib/betting-intelligence-api.ts"
web = read(web_path)
web = replace_once(web, "// Contract version: 1.1.0", "// Contract version: 1.3.0", "web contract version")
web = replace_once(
    web,
    'export type EvidenceTier = "OK" | "LOW_EVIDENCE";\n',
    '''export type EvidenceTier = "OK" | "LOW_EVIDENCE";

export type EvidenceProvider =
  | "ESPN"
  | "FOOTBALL_DATA_ORG"
  | "API_FOOTBALL"
  | "SPORTMONKS"
  | "THE_ODDS_API";
''',
    "web evidence provider type",
)
web = replace_once(
    web,
    "  source_status?: SourceStatusInput;\n  data_gaps?: string[];\n",
    "  source_status?: SourceStatusInput;\n  verified_evidence_providers?: EvidenceProvider[];\n  data_gaps?: string[];\n",
    "web request provenance",
)
web = replace_once(web, "  full_kelly: number;\n", "", "web full Kelly field")
web = replace_once(
    web,
    "  source_summary?: Record<string, unknown>;\n  input_hash?: string | null;\n",
    "  source_summary?: Record<string, unknown>;\n  verified_evidence_providers?: EvidenceProvider[];\n  independent_source_count?: number;\n  input_hash?: string | null;\n",
    "web result provenance",
)
write(web_path, web)


engine_test_path = "backend/tests/test_betting_intelligence_engine.py"
engine_test = read(engine_test_path)
engine_test = replace_once(
    engine_test,
    "    EvidenceTierEnum,\n",
    "    EvidenceProviderEnum,\n    EvidenceTierEnum,\n",
    "engine test provider import",
)
engine_test = replace_once(
    engine_test,
    "    data_gaps=None,\n) -> MatchAnalysisRequest:\n",
    "    data_gaps=None,\n    providers=_DEFAULT,\n) -> MatchAnalysisRequest:\n",
    "engine test provider fixture argument",
)
engine_test = replace_once(
    engine_test,
    "        data_gaps=data_gaps or [],\n    )\n",
    '''        verified_evidence_providers=(
            [
                EvidenceProviderEnum.ESPN,
                EvidenceProviderEnum.FOOTBALL_DATA_ORG,
                EvidenceProviderEnum.API_FOOTBALL,
                EvidenceProviderEnum.SPORTMONKS,
                EvidenceProviderEnum.THE_ODDS_API,
            ]
            if providers is _DEFAULT
            else providers
        ),
        data_gaps=data_gaps or [],
    )
''',
    "engine test provider fixture payload",
)
engine_test = engine_test.replace(
    "            kickoff_utc=None,\n        )",
    "            kickoff_utc=None,\n            independent_source_count=5,\n        )",
)
write(engine_test_path, engine_test)


smoke_path = "backend/scripts/verify_core_engine.py"
smoke = read(smoke_path)
smoke = replace_once(
    smoke,
    "    EvidenceTierEnum,\n",
    "    EvidenceProviderEnum,\n    EvidenceTierEnum,\n",
    "smoke provider import",
)
smoke = replace_once(
    smoke,
    "        data_gaps=data_gaps or [],\n    )\n",
    '''        verified_evidence_providers=[
            EvidenceProviderEnum.ESPN,
            EvidenceProviderEnum.FOOTBALL_DATA_ORG,
            EvidenceProviderEnum.API_FOOTBALL,
            EvidenceProviderEnum.SPORTMONKS,
            EvidenceProviderEnum.THE_ODDS_API,
        ],
        data_gaps=data_gaps or [],
    )
''',
    "smoke provider fixture",
)
write(smoke_path, smoke)


provider_test_path = ROOT / "backend/tests/test_provider_provenance_contract.py"
provider_test_path.write_text(
    '''"""Provider-independence and public staking contract tests."""

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
''',
    encoding="utf-8",
)

# Consume the one-shot machinery in the resulting commit.
(ROOT / ".github/workflows/apply-runtime-contract-alignment.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
