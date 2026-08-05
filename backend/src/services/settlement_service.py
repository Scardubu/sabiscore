"""Compose the settlement-join pipeline: sync recent results, then validate
predictions against them.

get_settled_predictions() (repositories/fixtures.py) and walk_forward_validate()
(models/model_registry.py) were both correct and unit-tested but had zero
production callers — see docs/DEBT.md item 2. This module is that caller,
invoked periodically from api/main.py's background task.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..models.model_registry import ModelRegistry

logger = logging.getLogger(__name__)

_last_result: dict[str, Any] = {"outcome": "never_run", "consecutive_failures": 0}
_registry_instance: "ModelRegistry | None" = None


def get_walk_forward_registry() -> "ModelRegistry":
    """Memoized ModelRegistry — its constructor does real I/O (mkdir + a
    metadata.json read); walk_forward_validate() doesn't touch self, so one
    process-lifetime instance is safe to share across ticks and requests.
    """
    global _registry_instance
    if _registry_instance is None:
        from ..core.config import settings
        from ..models.model_registry import ModelRegistry

        registry_path = str(settings.models_path / "_walk_forward_registry")
        _registry_instance = ModelRegistry(registry_path=registry_path)
    return _registry_instance


def last_settlement_result() -> dict[str, Any]:
    """Sync accessor for /health — a copy, never the live dict (health_check()
    is a sync function; this must never be awaited or block on I/O)."""
    return dict(_last_result)


async def run_settlement_pass() -> dict[str, Any]:
    """sync_settled_results() -> get_settled_predictions() -> walk_forward_validate(),
    against one session. Never raises — every failure lands in the returned/stored
    dict, matching the swallow-and-log convention run_fixture_sync() already uses.
    """
    global _last_result

    from ..db.session import AsyncSessionLocal

    checked_at = datetime.now(timezone.utc).isoformat()

    if AsyncSessionLocal is None:
        _last_result = {
            **_last_result,
            "outcome": "db_not_ready",
            "checked_at": checked_at,
        }
        return _last_result

    try:
        from .fixture_sync_service import sync_settled_results
        from ..repositories.fixtures import get_settled_predictions

        async with AsyncSessionLocal() as session:
            sync_counts = await sync_settled_results(session)
            records = await get_settled_predictions(session)

        # Pure Python, no DB — deliberately outside the session block above.
        validation = get_walk_forward_registry().walk_forward_validate(records)

        _last_result = {
            "outcome": "ok",
            "checked_at": checked_at,
            "sync": sync_counts,
            "settled_predictions_total": len(records),
            "walk_forward": validation,
            "consecutive_failures": 0,
        }
    except Exception as exc:
        logger.exception("settlement_pass: unhandled error")
        consecutive_failures = int(_last_result.get("consecutive_failures", 0)) + 1
        _last_result = {
            "outcome": "error",
            "checked_at": checked_at,
            "message": str(exc),
            "consecutive_failures": consecutive_failures,
        }

    return _last_result
