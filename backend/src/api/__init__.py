# API module initialization
from fastapi import APIRouter

from .endpoints import matches, predictions

# Create main API router
api_router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
api_router.include_router(matches.router)
api_router.include_router(predictions.router)

__all__ = ['api_router']
