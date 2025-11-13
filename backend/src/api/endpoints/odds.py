"""
Odds endpoints for fetching and tracking betting odds
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from ...db.session import get_async_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/odds", tags=["odds"])


@router.get("/health")
async def health_check():
    """Health check endpoint for odds service"""
    return {"status": "ok", "service": "odds"}
