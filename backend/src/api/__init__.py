# API module initialization
from fastapi import APIRouter

from .endpoints import router as main_router


api_router = APIRouter()
api_router.include_router(main_router)


__all__ = ["api_router"]
