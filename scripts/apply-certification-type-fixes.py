#!/usr/bin/env python3
"""Apply only the remaining v1.3 runtime hardening changes atomically."""

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


# Certified engine: absent provenance is incomplete, one provider is HOLD.
path = "backend/src/services/betting_intelligence.py"
text = read(path)
text = replace_once(
    text,
    "    independent_source_count = len(set(request.verified_evidence_providers))\n",
    "    verified_providers = list(dict.fromkeys(request.verified_evidence_providers))\n    independent_source_count = len(verified_providers)\n    if model is not None and market is not None and independent_source_count == 0:\n        gaps.append(\"DATA_GAP: evidence_provider_provenance\")\n",
    "provider provenance gap",
)
text = replace_once(
    text,
    "    # A single provider (or absent provider provenance) can never produce an\n    # execution verdict. Independent ownership, not row count, is the unit.\n    if independent_source_count <= 1:\n        return VerdictEnum.HOLD\n",
    "    # Unknown ownership is incomplete; one independent owner is capped at HOLD.\n    if independent_source_count <= 0:\n        return VerdictEnum.PARTIAL\n    if independent_source_count == 1:\n        return VerdictEnum.HOLD\n",
    "provider verdict ceiling",
)
text = replace_once(
    text,
    "    risks: List[str] = list(request.known_risks[:3])\n",
    "    risks: List[str] = list(request.known_risks[:3])\n    if independent_source_count == 1:\n        risks.append(\"Single-provider evidence caps the verdict at HOLD.\")\n    elif 1 < independent_source_count < 4:\n        risks.append(\"Fewer than four independent providers prevents HIGH_CONVICTION.\")\n",
    "provider risk explanations",
)
text = replace_once(
    text,
    '            "providers": [provider.value for provider in request.verified_evidence_providers],\n',
    '            "providers": [provider.value for provider in verified_providers],\n',
    "summary verified providers",
)
text = replace_once(
    text,
    "        verified_evidence_providers=request.verified_evidence_providers,\n",
    "        verified_evidence_providers=verified_providers,\n",
    "result verified providers",
)
write(path, text)


# Public policy surface documents the enforceable source-diversity and staking rules.
path = "backend/src/api/endpoints/betting_intelligence.py"
text = read(path)
text = replace_once(
    text,
    '            "ucl_coverage": "SOFT - HIGH_CONVICTION excluded until dedicated model validated",\n',
    '            "source_diversity": {\n                "minimum_for_execution": 2,\n                "minimum_for_high_conviction": 4,\n                "single_provider_ceiling": "HOLD",\n            },\n            "staking_display": "Quarter-Kelly only; Full Kelly is never returned",\n            "ucl_coverage": "SOFT - HIGH_CONVICTION excluded until dedicated model validated",\n',
    "policy source diversity",
)
write(path, text)


# Compatibility core must use the same public staking policy and cannot claim
# HIGH_CONVICTION because its input schema has no provider ownership provenance.
path = "backend/src/services/core_engine.py"
text = read(path)
text = replace_once(text, '"""Deterministic SabiScore Core Engine v2.1 evaluator."""', '"""Deterministic SabiScore Core Engine v2.2 evaluator."""', "core doc version")
text = replace_once(text, 'ENGINE_VERSION = "2.1.0-prod"', 'ENGINE_VERSION = "2.2.0-prod"', "core engine version")
text = replace_once(text, "CORE_KELLY_FRACTION = 0.125", "CORE_KELLY_FRACTION = 0.25", "core Kelly fraction")
text = replace_once(text, "CORE_MAX_KELLY_CAP = 0.025", "CORE_MAX_KELLY_CAP = 0.05", "core Kelly cap")
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
    "compatibility high-conviction cap",
)
text = replace_once(text, '        return "2.5u"', '        return "5u"', "compatibility stake label")
write(path, text)


# Backend-owned adapter may only propagate evidence supplied by its caller.
path = "backend/src/services/analytics.py"
text = read(path)
text = replace_once(text, "    EvidenceTierEnum,\n", "    EvidenceProviderEnum,\n    EvidenceTierEnum,\n", "analytics provider import")
text = replace_once(text, '            model_version=str(model_payload.get("model_version") or "certified-v1"),', '            model_version=str(model_payload["model_version"]),', "model version fallback")
text = replace_once(text, '            calibration_method=str(model_payload.get("calibration_method") or "backend_calibrated"),', '            calibration_method=str(model_payload["calibration_method"]),', "calibration fallback")
text = replace_once(text, '            calibration_validated=bool(model_payload.get("calibration_validated", True)),', '            calibration_validated=bool(model_payload["calibration_validated"]),', "calibration validation fallback")
text = replace_once(text, '            epistemic_uncertainty=float(model_payload.get("epistemic_uncertainty", 0.12)),', '            epistemic_uncertainty=float(model_payload["epistemic_uncertainty"]),', "epistemic fallback")
text = replace_once(text, '            aleatoric_uncertainty=float(model_payload.get("aleatoric_uncertainty", 0.18)),', '            aleatoric_uncertainty=float(model_payload["aleatoric_uncertainty"]),', "aleatoric fallback")
text = replace_once(text, '            confidence_tier=EvidenceTierEnum(model_payload.get("confidence_tier") or EvidenceTierEnum.OK.value),', '            confidence_tier=EvidenceTierEnum(model_payload["confidence_tier"]),', "confidence fallback")
text = replace_once(text, '                captured_at=market_payload.get("captured_at") or datetime.now(timezone.utc),', '                captured_at=market_payload["captured_at"],', "market timestamp fallback")
text = replace_once(text, '            kickoff_utc=payload.get("kickoff_utc") or datetime.now(timezone.utc),', '            kickoff_utc=payload["kickoff_utc"],', "kickoff fallback")
text = replace_once(
    text,
    '                model_features_seconds=freshness_payload.get("model_features_seconds", 0),\n                market_seconds=freshness_payload.get("market_seconds", 0 if market else None),',
    '                model_features_seconds=freshness_payload.get("model_features_seconds"),\n                market_seconds=freshness_payload.get("market_seconds"),',
    "freshness fallbacks",
)
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
    "source status fallbacks",
)
text = replace_once(
    text,
    '            data_gaps=list(payload.get("data_gaps") or []),\n',
    '            verified_evidence_providers=[\n                EvidenceProviderEnum(provider)\n                for provider in payload.get("verified_evidence_providers", [])\n            ],\n            data_gaps=list(payload.get("data_gaps") or []),\n',
    "analytics provider provenance",
)
write(path, text)


# Frontend policy type and compatibility-core expectations.
path = "apps/web/src/lib/betting-intelligence-api.ts"
text = read(path)
text = replace_once(
    text,
    "    speculative_stake_cap: number;\n",
    "    speculative_stake_cap: number;\n    source_diversity?: {\n      minimum_for_execution: number;\n      minimum_for_high_conviction: number;\n      single_provider_ceiling: Verdict;\n    };\n    staking_display?: string;\n",
    "frontend source diversity policy",
)
write(path, text)

path = "backend/tests/test_core_engine.py"
text = read(path)
text = replace_once(text, "def test_high_conviction_is_allowed_for_clean_tier_one_fixture():", "def test_compatibility_core_caps_clean_fixture_at_actionable_without_provenance():", "core test name")
text = replace_once(text, '    assert result.verdict == "HIGH_CONVICTION"', '    assert result.verdict == "ACTIONABLE"', "core verdict expectation")
text = replace_once(text, '    assert result.stake_fraction == pytest.approx(0.025)\n    assert result.stake == "2.5u"', '    assert result.stake_fraction == pytest.approx(0.05)\n    assert result.stake == "5u"', "core stake expectation")
write(path, text)

path = "backend/tests/test_provider_provenance_contract.py"
text = read(path)
if "test_missing_provider_provenance_is_partial" not in text:
    text += '''\n\ndef test_missing_provider_provenance_is_partial():\n    result = analyze_match(request_with([]), causal_drivers=["xg_differential"])\n    assert result.verdict == VerdictEnum.PARTIAL\n    assert "DATA_GAP: evidence_provider_provenance" in result.data_gaps\n'''
write(path, text)

# Consume all one-shot applier machinery in the same commit.
(ROOT / ".github/workflows/apply-certification-type-fixes.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
