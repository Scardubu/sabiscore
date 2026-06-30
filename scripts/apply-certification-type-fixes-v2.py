#!/usr/bin/env python3
"""Apply provider-cycle and evidence-ledger hardening transactionally."""

from __future__ import annotations

import py_compile
import shutil
import tempfile
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIAGNOSTIC = ROOT / "PROVIDER_LEDGER_PATCH_FAILURE.txt"
TARGETS = (
    "backend/src/providers/orchestrator.py",
    "backend/src/api/endpoints/fixtures.py",
    "apps/web/src/lib/betting-intelligence-api.ts",
    "apps/web/src/components/betting-intelligence-dashboard.tsx",
    "backend/tests/test_providers_gateway.py",
)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return content.replace(old, new, 1)


def patch(sandbox: Path) -> None:
    # Provider orchestrator -------------------------------------------------
    path = sandbox / "backend/src/providers/orchestrator.py"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '    FORECAST_ONLY = "FORECAST_ONLY"\n',
        '    FORECAST_ONLY = "FORECAST_ONLY"\n    PRODUCTION_CYCLE = "PRODUCTION_CYCLE"\n',
        "production profile enum",
    )
    text = replace_once(
        text,
        '        if profile == EvidenceProfile.FORECAST_ONLY:\n            return await self._collect_forecast_only(fixture, competition)\n',
        '        if profile == EvidenceProfile.FORECAST_ONLY:\n            return await self._collect_forecast_only(fixture, competition)\n        if profile == EvidenceProfile.PRODUCTION_CYCLE:\n            return await self._collect_production_cycle(\n                fixture, competition, canonical_fixture_id\n            )\n',
        "production profile routing",
    )
    marker = '''    async def _collect_discovery(
        self, fixture: dict[str, Any], competition: str
    ) -> list[ProviderResult]:
'''
    method = '''    async def _collect_production_cycle(
        self,
        fixture: dict[str, Any],
        competition: str,
        canonical_fixture_id: str | None,
    ) -> list[ProviderResult]:
        """Run the explicit user-triggered full evidence cycle concurrently.

        This is not used for background polling. It fans out across the standard,
        enriched, and market profiles while preserving each provider's quota and
        circuit-breaker behavior. Missing credentials remain structured gaps.
        """
        groups = await asyncio.gather(
            self._collect_prematch_standard(fixture, competition),
            self._collect_prematch_enriched(fixture, competition),
            self._collect_market_refresh(
                fixture, competition, canonical_fixture_id
            ),
        )
        return [result for group in groups for result in group]

'''
    text = replace_once(text, marker, method + marker, "production cycle method")
    path.write_text(text, encoding="utf-8")

    # Fixture API and evidence ledger --------------------------------------
    path = sandbox / "backend/src/api/endpoints/fixtures.py"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "from ...db.models import Match, Odds, Prediction\n",
        "from ...core.cache import cache\nfrom ...db.models import Match, Odds, Prediction\n",
        "cache import",
    )
    text = replace_once(
        text,
        "    CompetitionEnum,\n    EvidenceTierEnum,\n",
        "    CompetitionEnum,\n    EvidenceProviderEnum,\n    EvidenceTierEnum,\n",
        "provider enum import",
    )
    text = replace_once(
        text,
        "from ...providers import ProviderRegistry\n",
        "from ...providers import ProviderRegistry\nfrom ...providers.base import ProviderResult, ProviderStatus\n",
        "provider result import",
    )
    text = replace_once(
        text,
        "LINEUP_CRITICAL_MINUTES = 90\n",
        '''LINEUP_CRITICAL_MINUTES = 90
PROVIDER_EVIDENCE_TTL_SECONDS = 21600
_PROVIDER_OWNER_BY_ID = {
    "espn": EvidenceProviderEnum.ESPN,
    "football_data_org": EvidenceProviderEnum.FOOTBALL_DATA_ORG,
    "api_football": EvidenceProviderEnum.API_FOOTBALL,
    "sportmonks": EvidenceProviderEnum.SPORTMONKS,
    "the_odds_api": EvidenceProviderEnum.THE_ODDS_API,
}
_TEAM_METRIC_OPERATIONS = {"fixtures", "standings", "teams", "team_statistics"}
_AVAILABILITY_OPERATIONS = {"injuries", "lineups"}


def _provider_evidence_key(fixture_id: str) -> str:
    return f"fixture:provider-evidence:{fixture_id}"


def _load_provider_evidence(fixture_id: str) -> Dict[str, Any]:
    value = cache.get(_provider_evidence_key(fixture_id))
    return value if isinstance(value, dict) else {"providers": {}}


def _store_provider_results(
    fixture_id: str,
    profile: EvidenceProfile,
    results: List[ProviderResult],
) -> Dict[str, Any]:
    ledger = _load_provider_evidence(fixture_id)
    providers = dict(ledger.get("providers") or {})
    for result in results:
        owner = _PROVIDER_OWNER_BY_ID.get(result.provider)
        if owner is None:
            continue
        owner_key = owner.value
        entry = dict(providers.get(owner_key) or {})
        observations = list(entry.get("observations") or [])
        observation = {
            "operation": result.operation,
            "status": result.status.value,
            "acquired_at": result.acquired_at.isoformat(),
            "provider_timestamp": (
                result.provider_timestamp.isoformat()
                if result.provider_timestamp is not None
                else None
            ),
            "record_count": len(result.records),
            "warnings": list(result.warnings),
            "error_code": result.error_code,
            "profile": profile.value,
        }
        observations = [
            item
            for item in observations
            if not (
                item.get("operation") == result.operation
                and item.get("profile") == profile.value
            )
        ]
        observations.append(observation)
        verified = any(
            item.get("status") == ProviderStatus.VERIFIED.value
            and int(item.get("record_count") or 0) > 0
            for item in observations
        )
        providers[owner_key] = {
            "owner": owner_key,
            "verified": verified,
            "latest_acquired_at": result.acquired_at.isoformat(),
            "observations": observations[-20:],
        }
    ledger = {
        "fixture_id": fixture_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "providers": providers,
    }
    cache.set(
        _provider_evidence_key(fixture_id),
        ledger,
        ttl=PROVIDER_EVIDENCE_TTL_SECONDS,
    )
    return ledger


def _verified_provider_owners(ledger: Dict[str, Any]) -> List[EvidenceProviderEnum]:
    providers = ledger.get("providers") or {}
    verified: List[EvidenceProviderEnum] = []
    for owner in EvidenceProviderEnum:
        entry = providers.get(owner.value)
        if isinstance(entry, dict) and entry.get("verified") is True:
            verified.append(owner)
    return verified


def _operation_status(
    ledger: Dict[str, Any],
    operations: set[str],
) -> str:
    for entry in (ledger.get("providers") or {}).values():
        if not isinstance(entry, dict):
            continue
        for observation in entry.get("observations") or []:
            operation = str(observation.get("operation") or "").split(":", 1)[0]
            if (
                operation in operations
                and observation.get("status") == ProviderStatus.VERIFIED.value
                and int(observation.get("record_count") or 0) > 0
            ):
                return SourceStatusEnum.VERIFIED.value
    return SourceStatusEnum.DATA_GAP.value


def _provider_timeline(ledger: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for owner, entry in sorted((ledger.get("providers") or {}).items()):
        if not isinstance(entry, dict):
            continue
        observations = entry.get("observations") or []
        latest = observations[-1] if observations else {}
        rows.append(
            {
                "step": "provider_evidence",
                "provider": owner,
                "source": owner,
                "status": (
                    ProviderStatus.VERIFIED.value
                    if entry.get("verified")
                    else str(latest.get("status") or SourceStatusEnum.DATA_GAP.value)
                ),
                "timestamp": latest.get("acquired_at"),
                "operation": latest.get("operation"),
                "record_count": latest.get("record_count", 0),
            }
        )
    return rows
''',
        "provider evidence helpers",
    )
    text = replace_once(
        text,
        "    source_comparison: List[Dict[str, Any]] = Field(default_factory=list)\n",
        "    source_comparison: List[Dict[str, Any]] = Field(default_factory=list)\n    verified_evidence_providers: List[EvidenceProviderEnum] = Field(default_factory=list)\n    provider_evidence: List[Dict[str, Any]] = Field(default_factory=list)\n",
        "evidence response fields",
    )
    text = replace_once(
        text,
        "    profile: EvidenceProfile = EvidenceProfile.PREMATCH_STANDARD\n",
        "    profile: EvidenceProfile = EvidenceProfile.PRODUCTION_CYCLE\n",
        "refresh default profile",
    )
    text = replace_once(
        text,
        "    summary = _fixture_summary(fixture, odds, prediction)\n    data_gaps: List[str] = []\n",
        "    summary = _fixture_summary(fixture, odds, prediction)\n    ledger = _load_provider_evidence(fixture_id)\n    verified_providers = _verified_provider_owners(ledger)\n    team_metrics_status = _operation_status(ledger, _TEAM_METRIC_OPERATIONS)\n    availability_status = _operation_status(ledger, _AVAILABILITY_OPERATIONS)\n    data_gaps: List[str] = []\n    if not verified_providers:\n        data_gaps.append(\"DATA_GAP: evidence_provider_provenance\")\n",
        "load evidence ledger",
    )
    text = replace_once(
        text,
        '            "team_metrics": "DATA_GAP",\n            "availability": "DATA_GAP",\n',
        '            "team_metrics": team_metrics_status,\n            "availability": availability_status,\n',
        "ledger source statuses",
    )
    text = replace_once(
        text,
        '            {"step": "availability", "status": "DATA_GAP", "source": "lineup and injury provider unavailable"},\n        ],\n',
        '            {"step": "availability", "status": availability_status, "source": "provider evidence ledger"},\n            *_provider_timeline(ledger),\n        ],\n',
        "provider timeline rows",
    )
    text = replace_once(
        text,
        '            {"stage": "Team metrics", "state": model_status, "source": "model features", "timestamp": prediction.created_at if prediction else None, "reason": None if prediction else "model prediction missing"},\n            {"stage": "Availability", "state": "DATA_GAP", "source": None, "timestamp": None, "reason": "availability provider evidence not verified"},\n',
        '            {"stage": "Team metrics", "state": team_metrics_status, "source": "provider evidence ledger", "timestamp": ledger.get("updated_at"), "reason": None if team_metrics_status == "VERIFIED" else "team-metric provider evidence not verified"},\n            {"stage": "Availability", "state": availability_status, "source": "provider evidence ledger", "timestamp": ledger.get("updated_at"), "reason": None if availability_status == "VERIFIED" else "availability provider evidence not verified"},\n',
        "readiness ledger statuses",
    )
    text = replace_once(
        text,
        "        ],\n    )\n    return fixture, prediction, odds, evidence\n",
        "        ],\n        verified_evidence_providers=verified_providers,\n        provider_evidence=_provider_timeline(ledger),\n    )\n    return fixture, prediction, odds, evidence\n",
        "evidence ledger output",
    )
    text = replace_once(
        text,
        "    results = await orchestrator.collect(\n",
        "    results = await orchestrator.collect(\n",
        "refresh collect anchor",
    )
    text = replace_once(
        text,
        "        payload.profile,\n    )\n    return RefreshEvidenceResponse(\n",
        "        payload.profile,\n        canonical_fixture_id=fixture_id,\n    )\n    _store_provider_results(fixture_id, payload.profile, results)\n    return RefreshEvidenceResponse(\n",
        "persist refresh results",
    )
    text = replace_once(
        text,
        "        source_status=SourceStatusInput(\n",
        "        verified_evidence_providers=evidence.verified_evidence_providers,\n        source_status=SourceStatusInput(\n",
        "analysis provider provenance",
    )
    path.write_text(text, encoding="utf-8")

    # Web contract and default cycle ---------------------------------------
    path = sandbox / "apps/web/src/lib/betting-intelligence-api.ts"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "  source_comparison: Array<Record<string, unknown>>;\n",
        "  source_comparison: Array<Record<string, unknown>>;\n  verified_evidence_providers: EvidenceProvider[];\n  provider_evidence: Array<Record<string, unknown>>;\n",
        "frontend evidence ledger fields",
    )
    text = replace_once(
        text,
        '  profile = "PREMATCH_STANDARD",\n',
        '  profile = "PRODUCTION_CYCLE",\n',
        "frontend refresh default",
    )
    path.write_text(text, encoding="utf-8")

    path = sandbox / "apps/web/src/components/betting-intelligence-dashboard.tsx"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '      await refreshFixtureEvidence(selectedFixtureId, "PREMATCH_STANDARD");\n',
        '      await refreshFixtureEvidence(selectedFixtureId, "PRODUCTION_CYCLE");\n',
        "dashboard production refresh",
    )
    path.write_text(text, encoding="utf-8")

    # Focused provider-cycle regression test -------------------------------
    path = sandbox / "backend/tests/test_providers_gateway.py"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "from src.providers.registry import build_provider_registry\n",
        "from src.providers.registry import build_provider_registry\nfrom src.providers.orchestrator import EvidenceOrchestrator, EvidenceProfile\n",
        "orchestrator test import",
    )
    append = '''\n\n@pytest.mark.asyncio\nasync def test_production_cycle_fans_out_across_profile_groups(monkeypatch):\n    registry = build_provider_registry()\n    orchestrator = EvidenceOrchestrator(registry)\n\n    async def standard(_fixture, _competition):\n        return [\n            ProviderResult(\n                provider=\"football_data_org\",\n                operation=\"standings\",\n                status=ProviderStatus.VERIFIED,\n                trust_tier=TrustTier.OFFICIAL_AUTHENTICATED,\n                records=[{\"position\": 1}],\n            )\n        ]\n\n    async def enriched(_fixture, _competition):\n        return [\n            ProviderResult(\n                provider=\"api_football\",\n                operation=\"injuries\",\n                status=ProviderStatus.VERIFIED,\n                trust_tier=TrustTier.OFFICIAL_AUTHENTICATED,\n                records=[{\"player\": \"A\"}],\n            )\n        ]\n\n    async def market(_fixture, _competition, _canonical_fixture_id):\n        return [\n            ProviderResult(\n                provider=\"the_odds_api\",\n                operation=\"odds\",\n                status=ProviderStatus.VERIFIED,\n                trust_tier=TrustTier.OFFICIAL_AUTHENTICATED,\n                records=[{\"bookmaker\": \"Pinnacle\"}],\n            )\n        ]\n\n    monkeypatch.setattr(orchestrator, \"_collect_prematch_standard\", standard)\n    monkeypatch.setattr(orchestrator, \"_collect_prematch_enriched\", enriched)\n    monkeypatch.setattr(orchestrator, \"_collect_market_refresh\", market)\n\n    results = await orchestrator.collect(\n        {\"competition\": \"EPL\"},\n        EvidenceProfile.PRODUCTION_CYCLE,\n        canonical_fixture_id=\"fixture-1\",\n    )\n\n    assert [result.provider for result in results] == [\n        \"football_data_org\",\n        \"api_football\",\n        \"the_odds_api\",\n    ]\n'''
    if "test_production_cycle_fans_out_across_profile_groups" not in text:
        text += append
    path.write_text(text, encoding="utf-8")


try:
    with tempfile.TemporaryDirectory(prefix="sabiscore-provider-ledger-") as tmp_dir:
        sandbox = Path(tmp_dir) / "repo"
        shutil.copytree(
            ROOT,
            sandbox,
            ignore=shutil.ignore_patterns(".git", "node_modules", ".venv", "__pycache__"),
        )
        patch(sandbox)
        for relative in TARGETS:
            source = sandbox / relative
            if source.suffix == ".py":
                py_compile.compile(str(source), doraise=True)
        for relative in TARGETS:
            source = sandbox / relative
            destination = ROOT / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

    DIAGNOSTIC.unlink(missing_ok=True)
    Path(__file__).unlink(missing_ok=True)
except Exception as exc:
    DIAGNOSTIC.write_text(
        f"{type(exc).__name__}: {exc}\n\n{traceback.format_exc()}",
        encoding="utf-8",
    )
