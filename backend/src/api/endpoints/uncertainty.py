"""Uncertainty endpoint for prediction-level uncertainty payloads."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...core.cache import cache_manager
from ...services.uncertainty_service import UncertaintyService


router = APIRouter(prefix="/predictions", tags=["uncertainty"])
_uncertainty_service = UncertaintyService()


@router.get("/{match_id}/uncertainty")
async def get_prediction_uncertainty(match_id: str):
    cache_key = f"prediction:{match_id}"
    cached = cache_manager.get(cache_key)
    if not isinstance(cached, dict):
        raise HTTPException(
            status_code=404,
            detail="Prediction not found in cache. Generate a prediction first.",
        )

    existing_uncertainty = cached.get("uncertainty")
    if isinstance(existing_uncertainty, dict):
        return {
            "match_id": match_id,
            "uncertainty": existing_uncertainty,
        }

    predictions = cached.get("predictions")
    confidence = cached.get("confidence")
    if not isinstance(predictions, dict) or confidence is None:
        raise HTTPException(
            status_code=422,
            detail="Stored prediction does not contain enough data for uncertainty decomposition.",
        )

    breakdown = _uncertainty_service.decompose_from_probabilities(
        predictions,
        float(confidence),
    )

    return {
        "match_id": match_id,
        "uncertainty": _uncertainty_service.to_dict(breakdown),
    }
