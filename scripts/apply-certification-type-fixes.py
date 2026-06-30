#!/usr/bin/env python3
"""Apply the reviewed v1.3 betting contract alignment atomically."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return content.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Versioned betting-intelligence engine
# ---------------------------------------------------------------------------
path = "backend/src/services/betting_intelligence.py"
text = read(path)
text = replace_once(text, "KELLY_FRACTION: float = 0.125             # one-eighth Kelly", "KELLY_FRACTION: float = 0.25              # Quarter-Kelly public default", "kelly fraction")
text = replace_once(text, "MAX_KELLY_CAP: float = 0.025              # 2.5% of bankroll", "MAX_KELLY_CAP: float = 0.05               # absolute 5% bankroll cap", "kelly cap")
text = replace_once(text, 'CONTRACT_VERSION: str = "1.2.0"', 'CONTRACT_VERSION: str = "1.3.0"', "contract version")
text = replace_once(text, 'POLICY_VERSION: str = "1.0"', 'POLICY_VERSION: str = "1.1"', "policy version")
text = replace_once(text, '            "full_kelly": round(fk, 6),\n', "", "remove public full kelly")
text = replace_once(
    text,
    "    high_conviction_edge: float = HIGH_CONVICTION_EDGE,\n) -> VerdictEnum:",
    "    high_conviction_edge: float = HIGH_CONVICTION_EDGE,\n    independent_source_count: int = 0,\n) -> VerdictEnum:",
    "verdict gate signature",
)
text = replace_once(
    text,
    "    if best_ev <= 0 or best_edge <= 0 or best_stake_fraction <= 0:\n        return VerdictEnum.NO_BET\n\n    # -- Gate 3: HOLD",
    "    if best_ev <= 0 or best_edge <= 0 or best_stake_fraction <= 0:\n        return VerdictEnum.NO_BET\n\n    # Provenance gate: unknown ownership is incomplete; one owner can never be executable.\n    if independent_source_count <= 0:\n        return VerdictEnum.PARTIAL\n    if independent_source_count == 1:\n        return VerdictEnum.HOLD\n\n    # -- Gate 3: HOLD",
    "provider ceiling",
)
text = replace_once(
    text,
    "        best_edge >= hc_edge_required\n        and not high_epistemic",
    "        best_edge >= hc_edge_required\n        and independent_source_count >= 4\n        and not high_epistemic",
    "high conviction source count",
)
text = replace_once(
    text,
    "    gaps: List[str] = list(request.data_gaps)  # start with caller-declared gaps\n    model = request.model\n    market = request.market\n",
    "    gaps: List[str] = list(request.data_gaps)  # start with caller-declared gaps\n    model = request.model\n    market = request.market\n    verified_providers = list(dict.fromkeys(request.verified_evidence_providers))\n    independent_source_count = len(verified_providers)\n    if model is not None and market is not None and independent_source_count == 0:\n        gaps.append(\"DATA_GAP: evidence_provider_provenance\")\n",
    "derive provider provenance",
)
text = replace_once(
    text,
    "        high_conviction_edge=high_conviction_edge,\n    )",
    "        high_conviction_edge=high_conviction_edge,\n        independent_source_count=independent_source_count,\n    )",
    "pass provider count",
)
text = replace_once(
    text,
    "    risks: List[str] = list(request.known_risks[:3])\n",
    "    risks: List[str] = list(request.known_risks[:3])\n    if independent_source_count == 1:\n        risks.append(\"Single-provider evidence caps the verdict at HOLD.\")\n    elif 1 < independent_source_count < 4:\n        risks.append(\"Fewer than four independent providers prevents HIGH_CONVICTION.\")\n",
    "provider risks",
)
text = replace_once(
    text,
    '            "availability": request.source_status.availability.value,\n        },\n        input_hash=input_hash,',
    '            "availability": request.source_status.availability.value,\n            "verified_providers": [provider.value for provider in verified_providers],\n            "independent_source_count": independent_source_count,\n        },\n        verified_evidence_providers=verified_providers,\n        independent_source_count=independent_source_count,\n        input_hash=input_hash,',
    "result provider provenance",
)
write(path, text)


# ---------------------------------------------------------------------------
# HTTP policy surface
# ---------------------------------------------------------------------------
path = "backend/src/api/endpoints/betting_intelligence.py"
text = read(path)
text = text.replace("CONTRACT VERSION: 1.1.0", "CONTRACT VERSION: 1.3.0")
text = replace_once(text, '        "contract_version": "1.2.0",', '        "contract_version": "1.3.0",', "endpoint contract version")
text = replace_once(text, '        "engine_version": "1.1.0",', '        "engine_version": "1.2.0",', "endpoint engine version")
text = replace_once(text, '        "policy_version": "1.0",', '        "policy_version": "1.1",', "endpoint policy version")
text = replace_once(
    text,
    '            "ucl_coverage": "SOFT - HIGH_CONVICTION excluded until dedicated model validated",\n',
    '            "source_diversity": {\n                "minimum_for_execution": 2,\n                "minimum_for_high_conviction": 4,\n                "single_provider_ceiling": "HOLD",\n            },\n            "staking_display": "Quarter-Kelly only; Full Kelly is never returned",\n            "ucl_coverage": "SOFT - HIGH_CONVICTION excluded until dedicated model validated",\n',
    "endpoint diversity policy",
)
text = replace_once(text, '        "engine_version": "1.1.0",\n        "engine_type": "deterministic",', '        "engine_version": "1.2.0",\n        "engine_type": "deterministic",', "health engine version")
write(path, text)


# ---------------------------------------------------------------------------
# Compatibility core: Quarter-Kelly, 5% cap, no unproven HIGH_CONVICTION
# ---------------------------------------------------------------------------
path = "backend/src/services/core_engine.py"
text = read(path)
text = replace_once(text, 'ENGINE_VERSION = "2.1.0-prod"', 'ENGINE_VERSION = "2.2.0-prod"', "core engine version")
text = replace_once(text, "CORE_KELLY_FRACTION = 0.125", "CORE_KELLY_FRACTION = 0.25", "core kelly fraction")
text = replace_once(text, "CORE_MAX_KELLY_CAP = 0.025", "CORE_MAX_KELLY_CAP = 0.05", "core kelly cap")
text = replace_once(
    text,
    '''    verdict = "ACTIONABLE"
    if (
        match.competition != "UCL"
        and model is not None
        and model.epistemic_uncertainty is not None
        and model.epistemic_uncertainty <= HIGH_CONVICTION_EPISTEMIC_MAX
        and signals is not None
        and signals.lineup_status == "CONFIRMED"
    ):
        verdict = "HIGH_CONVICTION"
    elif match.competition == "UCL":
        risks.append("UCL soft coverage caps the verdict at ACTIONABLE.")
''',
    '''    verdict = "ACTIONABLE"
    if match.competition == "UCL":
        risks.append("UCL soft coverage caps the verdict at ACTIONABLE.")
    else:
        risks.append(
            "Compatibility core input has no provider-ownership provenance; "
            "HIGH_CONVICTION is unavailable on this path."
        )
''',
    "core high conviction cap",
)
text = replace_once(text, '        return "2.5u"', '        return "5u"', "core stake label")
write(path, text)


# ---------------------------------------------------------------------------
# Frontend contract types
# ---------------------------------------------------------------------------
path = "apps/web/src/lib/betting-intelligence-api.ts"
text = read(path)
text = text.replace("Contract version: 1.1.0", "Contract version: 1.3.0")
text = replace_once(
    text,
    'export type EvidenceTier = "OK" | "LOW_EVIDENCE";\n',
    'export type EvidenceTier = "OK" | "LOW_EVIDENCE";\n\nexport type EvidenceProvider =\n  | "ESPN"\n  | "FOOTBALL_DATA_ORG"\n  | "API_FOOTBALL"\n  | "SPORTMONKS"\n  | "THE_ODDS_API";\n',
    "frontend provider type",
)
text = replace_once(text, "  source_status?: SourceStatusInput;\n", "  source_status?: SourceStatusInput;\n  verified_evidence_providers?: EvidenceProvider[];\n", "frontend request providers")
text = replace_once(text, "  full_kelly: number;\n", "", "frontend remove full kelly")
text = replace_once(
    text,
    "  source_summary?: Record<string, unknown>;\n",
    "  source_summary?: Record<string, unknown>;\n  verified_evidence_providers?: EvidenceProvider[];\n  independent_source_count?: number;\n",
    "frontend result providers",
)
text = replace_once(
    text,
    "    speculative_stake_cap: number;\n",
    "    speculative_stake_cap: number;\n    source_diversity?: {\n      minimum_for_execution: number;\n      minimum_for_high_conviction: number;\n      single_provider_ceiling: Verdict;\n    };\n    staking_display?: string;\n",
    "frontend policy diversity",
)
write(path, text)


# ---------------------------------------------------------------------------
# Strict analytics adapter: no fabricated timestamps, status, or uncertainty.
# ---------------------------------------------------------------------------
path = "backend/src/services/analytics.py"
text = read(path)
text = replace_once(text, "    EvidenceTierEnum,\n", "    EvidenceProviderEnum,\n    EvidenceTierEnum,\n", "analytics provider import")
text = replace_once(text, '            model_version=str(model_payload.get("model_version") or "certified-v1"),', '            model_version=str(model_payload["model_version"]),', "analytics model version")
text = replace_once(text, '            calibration_method=str(model_payload.get("calibration_method") or "backend_calibrated"),', '            calibration_method=str(model_payload["calibration_method"]),', "analytics calibration method")
text = replace_once(text, '            calibration_validated=bool(model_payload.get("calibration_validated", True)),', '            calibration_validated=bool(model_payload["calibration_validated"]),', "analytics calibration validated")
text = replace_once(text, '            epistemic_uncertainty=float(model_payload.get("epistemic_uncertainty", 0.12)),', '            epistemic_uncertainty=float(model_payload["epistemic_uncertainty"]),', "analytics epistemic")
text = replace_once(text, '            aleatoric_uncertainty=float(model_payload.get("aleatoric_uncertainty", 0.18)),', '            aleatoric_uncertainty=float(model_payload["aleatoric_uncertainty"]),', "analytics aleatoric")
text = replace_once(text, '            confidence_tier=EvidenceTierEnum(model_payload.get("confidence_tier") or EvidenceTierEnum.OK.value),', '            confidence_tier=EvidenceTierEnum(model_payload["confidence_tier"]),', "analytics confidence tier")
text = replace_once(text, '                captured_at=market_payload.get("captured_at") or datetime.now(timezone.utc),', '                captured_at=market_payload["captured_at"],', "analytics market timestamp")
text = replace_once(text, '            kickoff_utc=payload.get("kickoff_utc") or datetime.now(timezone.utc),', '            kickoff_utc=payload["kickoff_utc"],', "analytics kickoff")
text = replace_once(text, '                model_features_seconds=freshness_payload.get("model_features_seconds", 0),\n                market_seconds=freshness_payload.get("market_seconds", 0 if market else None),', '                model_features_seconds=freshness_payload.get("model_features_seconds"),\n                market_seconds=freshness_payload.get("market_seconds"),', "analytics freshness defaults")
text = replace_once(
    text,
    '''                model=SourceStatusEnum(source_payload.get("model") or SourceStatusEnum.VERIFIED.value),
                market=(
                    SourceStatusEnum(source_payload.get("market") or SourceStatusEnum.VERIFIED.value)
                    if market
                    else SourceStatusEnum.DATA_GAP
                ),
                team_metrics=SourceStatusEnum(source_payload.get("team_metrics") or SourceStatusEnum.VERIFIED.value),
                availability=SourceStatusEnum(source_payload.get("availability") or SourceStatusEnum.VERIFIED.value),
''',
    '''                model=SourceStatusEnum(source_payload.get("model") or SourceStatusEnum.DATA_GAP.value),
                market=SourceStatusEnum(source_payload.get("market") or SourceStatusEnum.DATA_GAP.value),
                team_metrics=SourceStatusEnum(source_payload.get("team_metrics") or SourceStatusEnum.DATA_GAP.value),
                availability=SourceStatusEnum(source_payload.get("availability") or SourceStatusEnum.DATA_GAP.value),
''',
    "analytics source status defaults",
)
text = replace_once(
    text,
    "            data_gaps=list(payload.get(\"data_gaps\") or []),\n",
    "            verified_evidence_providers=[\n                EvidenceProviderEnum(provider)\n                for provider in payload.get(\"verified_evidence_providers\", [])\n            ],\n            data_gaps=list(payload.get(\"data_gaps\") or []),\n",
    "analytics provider provenance",
)
write(path, text)


# ---------------------------------------------------------------------------
# Contract tests
# ---------------------------------------------------------------------------
path = "backend/tests/test_betting_intelligence_engine.py"
text = read(path)
text = replace_once(text, "    EvidenceTierEnum,\n", "    EvidenceProviderEnum,\n    EvidenceTierEnum,\n", "test provider import")
text = replace_once(
    text,
    "    data_gaps=None,\n) -> MatchAnalysisRequest:",
    "    data_gaps=None,\n    providers=_DEFAULT,\n) -> MatchAnalysisRequest:",
    "test request providers arg",
)
text = replace_once(
    text,
    "        data_gaps=data_gaps or [],\n    )",
    "        verified_evidence_providers=(\n            [\n                EvidenceProviderEnum.FOOTBALL_DATA_ORG,\n                EvidenceProviderEnum.API_FOOTBALL,\n                EvidenceProviderEnum.SPORTMONKS,\n                EvidenceProviderEnum.THE_ODDS_API,\n            ]\n            if providers is _DEFAULT\n            else providers\n        ),\n        data_gaps=data_gaps or [],\n    )",
    "test request provider values",
)
text = text.replace("            kickoff_utc=None,\n        )", "            kickoff_utc=None,\n            independent_source_count=4,\n        )")
append = '''\n\nclass TestProviderProvenanceAndPublicStaking:\n    def test_missing_provider_provenance_forces_partial(self):\n        result = analyze_match(_request(providers=[]))\n        assert result.verdict == VerdictEnum.PARTIAL\n        assert "DATA_GAP: evidence_provider_provenance" in result.data_gaps\n\n    def test_single_provider_caps_verdict_at_hold(self):\n        result = analyze_match(\n            _request(\n                model=_model(home=0.72, draw=0.18, away=0.10, epistemic=0.05),\n                providers=[EvidenceProviderEnum.FOOTBALL_DATA_ORG],\n            ),\n            causal_drivers=["elo_difference", "xg_differential"],\n        )\n        assert result.verdict == VerdictEnum.HOLD\n        assert result.independent_source_count == 1\n\n    def test_three_providers_cannot_reach_high_conviction(self):\n        result = analyze_match(\n            _request(\n                model=_model(home=0.72, draw=0.18, away=0.10, epistemic=0.05),\n                providers=[\n                    EvidenceProviderEnum.FOOTBALL_DATA_ORG,\n                    EvidenceProviderEnum.API_FOOTBALL,\n                    EvidenceProviderEnum.THE_ODDS_API,\n                ],\n            ),\n            causal_drivers=["elo_difference", "xg_differential"],\n        )\n        assert result.verdict != VerdictEnum.HIGH_CONVICTION\n        assert result.independent_source_count == 3\n\n    def test_public_staking_is_quarter_kelly_and_capped_at_five_percent(self):\n        result = analyze_match(\n            _request(model=_model(home=0.80, draw=0.12, away=0.08)),\n            causal_drivers=["elo_difference", "xg_differential"],\n        )\n        assert result.calculation_audit is not None\n        assert result.calculation_audit.kelly_fraction == pytest.approx(0.25)\n        assert result.calculation_audit.kelly_cap == pytest.approx(0.05)\n        assert result.stake_fraction <= 0.05 + 1e-9\n        for evaluation in result.all_market_evaluations or []:\n            assert "full_kelly" not in evaluation\n'''
if "class TestProviderProvenanceAndPublicStaking" not in text:
    text += append
write(path, text)

path = "backend/tests/test_core_engine.py"
text = read(path)
text = replace_once(text, "def test_high_conviction_is_allowed_for_clean_tier_one_fixture():", "def test_compatibility_core_caps_clean_fixture_at_actionable_without_provenance():", "core test name")
text = replace_once(text, '    assert result.verdict == "HIGH_CONVICTION"', '    assert result.verdict == "ACTIONABLE"', "core verdict expectation")
text = replace_once(text, "    assert result.stake_fraction == pytest.approx(0.025)\n    assert result.stake == \"2.5u\"", "    assert result.stake_fraction == pytest.approx(0.05)\n    assert result.stake == \"5u\"", "core stake expectations")
write(path, text)

# Consume this one-shot patch in the same commit.
Path(__file__).unlink(missing_ok=True)
