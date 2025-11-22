"""Aggregated API routers and compatibility exports for tests."""

from fastapi import APIRouter

# Re-export helpers expected by legacy tests so patching works without dragging
# in the heavy legacy endpoints module when importing ``src.api.endpoints``.
# These names are thin aliases and do not introduce circular imports.
from ...core.cache import cache  # noqa: F401  (re-export)
from ...core.database import check_database_health, get_db  # noqa: F401
from ..legacy_endpoints import _load_model_from_app  # noqa: F401

# Aggregate sub-routers inside the endpoints package so imports like
# ``from src.api.endpoints import router`` resolve to a complete router that
# includes all modularized endpoints.
router = APIRouter()

# Import sub-routers (these live in the same directory)
from .matches import router as matches_router  # noqa: E402
from .predictions import router as predictions_router  # noqa: E402
from .odds import router as odds_router  # noqa: E402

# Include sub-routers without adding additional prefixes here. The application
# will apply the API version prefix (e.g. /api/v1) at the app level.
router.include_router(matches_router)
router.include_router(predictions_router)
router.include_router(odds_router)

__all__ = [
	"router",
	"cache",
	"check_database_health",
	"get_db",
	"_load_model_from_app",
]
