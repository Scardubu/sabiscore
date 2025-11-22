# API module initialization
from fastapi import APIRouter

# Import the aggregated router from the endpoints package (endpoints/__init__.py)
from .endpoints import router as modular_router

# Import legacy standalone routes from legacy_endpoints.py file
from .legacy_endpoints import router as legacy_router

# Import monitoring endpoints for health checks and metrics
from .endpoints.monitoring import router as monitoring_router


api_router = APIRouter()

# Include monitoring routes (health checks, metrics)
api_router.include_router(monitoring_router)

# Include legacy routes before the modular ones so that compatibility
# endpoints (e.g., /matches/search) take precedence over catch-all
# parameterized routes defined in the modular router.
api_router.include_router(legacy_router)

# Include the new modular routes (matches, predictions, odds)
api_router.include_router(modular_router)


__all__ = ["api_router"]
