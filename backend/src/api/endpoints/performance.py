"""Model performance and value bet scan endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_async_session
from ...services.upcoming_match_service import UpcomingMatchService

router = APIRouter(tags=["performance"])


class ValueBetScanFixture(BaseModel):
    match_id: str
    home_team: str
    away_team: str
    league: str
    kickoff_utc: str
    edge_pct: float
    confidence: Optional[float] = None
    outcome: Optional[str] = None
    model_prob: Optional[float] = None
    implied_prob: Optional[float] = None
    created_at: Optional[str] = None


class ValueBetScanResponse(BaseModel):
    fixtures: List[ValueBetScanFixture]
    total: int
    days: int
    data_gap: bool = False
    generated_at: str


@router.get("/value-bet-scan", response_model=ValueBetScanResponse)
async def value_bet_scan(
    days: int = Query(7, ge=1, le=14),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_async_session),
) -> ValueBetScanResponse:
    service = UpcomingMatchService()
    payload = await service.get_upcoming_matches_with_predictions(
        db,
        league=None,
        days_ahead=days,
        limit=200,
        include_value_bets=True,
    )

    rows: List[ValueBetScanFixture] = []
    for match in payload.get("upcoming_matches", []):
        value_bets = match.get("value_bets") or []
        if not value_bets:
            continue

        try:
            best = max(value_bets, key=lambda v: float(v.get("edge_pct", 0.0)))
            edge = float(best.get("edge_pct", 0.0))
        except Exception:
            continue

        if edge <= 0:
            continue

        predictions = match.get("predictions") or {}
        confidence = predictions.get("confidence")
        outcome = best.get("market") or best.get("outcome")
        model_prob = best.get("fair_probability") or best.get("model_prob")
        implied_prob = best.get("implied_probability") or best.get("implied_prob")
        odds = best.get("odds")
        if implied_prob is None and odds and float(odds) > 0:
            implied_prob = round(1.0 / float(odds), 4)

        rows.append(
            ValueBetScanFixture(
                match_id=str(match.get("id", "")),
                home_team=str(match.get("home_team", "")),
                away_team=str(match.get("away_team", "")),
                league=str(match.get("league", "")),
                kickoff_utc=str(match.get("match_date", "")),
                edge_pct=edge,
                confidence=float(confidence) if confidence is not None else None,
                outcome=str(outcome) if outcome else None,
                model_prob=float(model_prob) if model_prob is not None else None,
                implied_prob=float(implied_prob) if implied_prob is not None else None,
                created_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    rows.sort(key=lambda row: row.edge_pct, reverse=True)
    rows = rows[:limit]

    # data_gap=True when the service returned no matches or none had predictions
    data_gap = len(payload.get("upcoming_matches", [])) == 0 or (
        len(rows) == 0 and any(
            bool(m.get("predictions")) for m in payload.get("upcoming_matches", [])
        )
    )

    return ValueBetScanResponse(
        fixtures=rows,
        total=len(rows),
        days=days,
        data_gap=data_gap,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/model-performance")
async def model_performance(
    league: Optional[str] = Query(None),
    window: int = Query(30, ge=7, le=180),
) -> Dict[str, Any]:
    # Placeholder contract for rolling accuracy chart while persistence tables are wired.
    return {
        "league": league,
        "window": window,
        "series": [],
        "baseline_accuracy": 0.528,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/model-performance/summary")
async def model_performance_summary() -> Dict[str, Any]:
    # Placeholder contract for hero stats while bet_history aggregation is integrated.
    return {
        "accuracy_30d": 0.0,
        "accuracy_season": 0.0,
        "clv_30d": 0.0,
        "bets_tracked": 0,
        "roi_30d": 0.0,
        "generated_at": datetime.utcnow().isoformat(),
    }
