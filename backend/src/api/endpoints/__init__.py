from fastapi import APIRouter
from typing import List
import logging

logger = logging.getLogger(__name__)

# Aggregate sub-routers inside the endpoints package so imports like
# `from .endpoints import router` resolve to this package's router.
router = APIRouter()

# Import sub-routers (these live in the same directory)
from .auth import router as auth_router  # noqa: E402
from .matches import router as matches_router  # noqa: E402
from .predictions import router as predictions_router  # noqa: E402
from .odds import router as odds_router  # noqa: E402
from .value_bets import router as value_bets_router  # noqa: E402
from .health import router as health_router  # noqa: E402

# Ultra predictions are optional - depends on catboost/xgboost/lightgbm
try:
    from .ultra_predictions import router as ultra_predictions_router  # noqa: E402
    _ultra_available = True
except ImportError as e:
    logger.warning(f"Ultra predictions endpoint not available: {e}")
    ultra_predictions_router = None
    _ultra_available = False

# Include sub-routers without adding additional prefixes here. The application
# will apply the API version prefix (e.g. /api/v1) at the app level.
router.include_router(auth_router)
router.include_router(matches_router)
router.include_router(predictions_router)
router.include_router(odds_router)
router.include_router(value_bets_router)
router.include_router(health_router)

if _ultra_available and ultra_predictions_router is not None:
    router.include_router(ultra_predictions_router)
    logger.info("✅ Ultra predictions endpoint enabled")

__all__ = ["router"]
