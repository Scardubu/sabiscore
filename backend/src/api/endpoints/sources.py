"""GET /api/v1/sources/freshness — expose source registry freshness summary."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

from ...connectors.source_registry import build_source_registry, registry_summary
from ...core.config import settings

router = APIRouter(prefix="/sources", tags=["sources"])

# Runtime staleness tracking — populated by background enrichment tasks.
# Keys are source names, values are epoch timestamps of last successful check.
_last_checked: Dict[str, float] = {}

_LIVE_THRESHOLD_S = 60
_RECENT_THRESHOLD_S = 3600


def _freshness_status(source_name: str) -> str:
    ts = _last_checked.get(source_name)
    if ts is None:
        return "DATA_GAP"
    age = time.time() - ts
    if age < _LIVE_THRESHOLD_S:
        return "LIVE"
    if age < _RECENT_THRESHOLD_S:
        return "RECENT"
    return "STALE"


class SourceFreshnessItem(BaseModel):
    name: str
    category: str
    enabled: bool
    official_api: bool
    request_time_safe: bool
    freshness_status: str
    notes: str
    data_gaps: List[str]
    generated_at: str


def record_source_check(source_name: str) -> None:
    """Called by enrichment tasks to mark a source as recently checked."""
    _last_checked[source_name] = time.time()


@router.get("/freshness", response_model=List[SourceFreshnessItem])
async def get_sources_freshness() -> List[SourceFreshnessItem]:
    """Return per-source freshness status for all registered V4 sources."""
    registry = build_source_registry(settings=settings)
    now = datetime.now(timezone.utc).isoformat()
    items: List[SourceFreshnessItem] = []
    for source in registry:
        status = _freshness_status(source.name)
        gaps: List[str] = []
        if not source.enabled:
            gaps.append("source_disabled")
        if status == "DATA_GAP":
            gaps.append("never_checked")
        elif status == "STALE":
            gaps.append("stale_data")
        items.append(
            SourceFreshnessItem(
                name=source.name,
                category=source.category,
                enabled=source.enabled,
                official_api=source.official_api,
                request_time_safe=source.request_time_safe,
                freshness_status=status,
                notes=source.notes,
                data_gaps=gaps,
                generated_at=now,
            )
        )
    return items


@router.get("/summary", response_model=Dict[str, Any])
async def get_sources_summary() -> Dict[str, Any]:
    """Return aggregate registry summary (total / enabled / request-time-safe counts)."""
    registry = build_source_registry(settings=settings)
    summary = registry_summary(registry)
    summary["generated_at"] = datetime.now(timezone.utc).isoformat()
    return summary


__all__ = ["router", "record_source_check"]
