"""SabiScore Core Engine v2.1 API endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from ...schemas.core_engine import CoreEngineAnalyzeRequest, CoreEngineResponse
from ...services.core_engine import analyze_core_matches


router = APIRouter(prefix="/core-engine", tags=["core-engine"])


@router.post("/analyze", response_model=CoreEngineResponse)
async def analyze_core_engine(payload: CoreEngineAnalyzeRequest) -> CoreEngineResponse:
    """Analyze supplied pre-match betting intelligence inputs without live fetches."""

    return analyze_core_matches(payload.matches)


__all__ = ["router"]
