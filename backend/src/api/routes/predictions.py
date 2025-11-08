# backend/src/api/routes/predictions.py
"""
API routes for model predictions and edge detection
Integrates with existing Sabiscore FastAPI app
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
from datetime import datetime

from ...core.database import get_db
from ...models.orchestrator import orchestrator

router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])


class PredictionRequest(BaseModel):
    """Request model for match predictions"""
    league: str = Field(..., description="League name (epl, laliga, bundesliga, seriea, ligue1)")
    match_id: str = Field(..., description="Unique match identifier")
    home_team: str
    away_team: str
    match_date: datetime
    
    # Optional enriched features (will use defaults if not provided)
    home_form_last_5: Optional[List[float]] = None
    away_form_last_5: Optional[List[float]] = None
    home_goals_scored_l5: Optional[int] = None
    away_goals_scored_l5: Optional[int] = None
    home_xg_l5: Optional[float] = None
    away_xg_l5: Optional[float] = None
    
    # Odds (for edge calculation)
    odds_home: Optional[float] = None
    odds_draw: Optional[float] = None
    odds_away: Optional[float] = None


class EdgeResponse(BaseModel):
    """Response model for value bet edges"""
    outcome: str
    edge_pct: float
    kelly_stake_pct: float
    clv_cents: float
    confidence: float
    recommended_stake_ngn: float


class PredictionResponse(BaseModel):
    """Response model for predictions"""
    match_id: str
    league: str
    home_team: str
    away_team: str
    predictions: Dict[str, float]
    value_bets: List[EdgeResponse]
    has_edge: bool
    timestamp: str
    model_version: str


@router.post("/predict", response_model=PredictionResponse)
async def predict_match(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Generate predictions for a match with optional edge detection
    
    Returns:
    - Calibrated probabilities for Home/Draw/Away
    - Value bet recommendations if odds provided
    - Kelly stake recommendations in NGN
    """
    
    # Build match data dict
    match_data = {
        'match_id': request.match_id,
        'home_team': request.home_team,
        'away_team': request.away_team,
        'match_date': request.match_date,
        
        # Use provided features or fetch from database
        'home_form_last_5': request.home_form_last_5 or [],
        'away_form_last_5': request.away_form_last_5 or [],
        'home_goals_scored_l5': request.home_goals_scored_l5 or 0,
        'away_goals_scored_l5': request.away_goals_scored_l5 or 0,
        'home_xg_l5': request.home_xg_l5 or 0,
        'away_xg_l5': request.away_xg_l5 or 0,
    }
    
    # Build odds dict if provided
    odds = None
    if request.odds_home and request.odds_draw and request.odds_away:
        odds = {
            'home_win': request.odds_home,
            'draw': request.odds_draw,
            'away_win': request.odds_away
        }
    
    # Get prediction from orchestrator
    try:
        result = orchestrator.predict(request.league, match_data, odds)
        
        if 'error' in result:
            raise HTTPException(status_code=500, detail=result['error'])
        
        # Format value bets for response
        value_bets = []
        if 'value_bets' in result:
            for outcome, edge_data in result['value_bets'].items():
                # Convert to NGN (assuming 1000 NGN bankroll)
                stake_ngn = (edge_data['kelly_stake_pct'] / 100) * 1000
                
                value_bets.append(EdgeResponse(
                    outcome=outcome,
                    edge_pct=edge_data['edge_pct'],
                    kelly_stake_pct=edge_data['kelly_stake_pct'],
                    clv_cents=edge_data['clv_cents'],
                    confidence=edge_data['confidence'],
                    recommended_stake_ngn=round(stake_ngn, 2)
                ))
        
        return PredictionResponse(
            match_id=result['match_id'],
            league=result['league'],
            home_team=request.home_team,
            away_team=request.away_team,
            predictions=result['predictions'],
            value_bets=value_bets,
            has_edge=result.get('has_edge', False),
            timestamp=result['timestamp'],
            model_version=result['model_version']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/update-result")
async def update_match_result(
    match_id: str,
    league: str,
    home_score: int,
    away_score: int,
    background_tasks: BackgroundTasks
):
    """
    Update model calibration with actual match result
    Triggers live recalibration in background
    """
    
    # Determine result code
    if home_score > away_score:
        result = 0  # Home win
    elif home_score == away_score:
        result = 1  # Draw
    else:
        result = 2  # Away win
    
    # Update calibration asynchronously
    background_tasks.add_task(
        orchestrator.live_calibration_update,
        league,
        match_id,
        result
    )
    
    return {
        'status': 'success',
        'match_id': match_id,
        'result_code': result,
        'message': 'Calibration update queued'
    }


@router.get("/model-stats/{league}")
async def get_model_stats(league: str):
    """Get training metadata and performance stats for a league model"""
    
    league_key = orchestrator.get_league_key(league)
    
    # Fetch metadata from Redis
    metadata_key = f"model:{league_key}:metadata"
    metadata = orchestrator.redis.get(metadata_key)
    
    if not metadata:
        raise HTTPException(status_code=404, detail="Model not trained yet")
    
    import json
    stats = json.loads(metadata)
    
    # Add calibration status
    calib_key = f"calib:{league_key}:home_win"
    has_calibration = orchestrator.redis.exists(calib_key)
    
    stats['live_calibration_active'] = bool(has_calibration)
    stats['league'] = league
    
    return stats


@router.get("/health")
async def health_check():
    """Check if all models are loaded and ready"""
    
    status = {}
    for league_key, model in orchestrator.models.items():
        status[league_key] = {
            'loaded': True,
            'trained': model.is_trained
        }
    
    all_ready = all(s['trained'] for s in status.values())
    
    return {
        'status': 'healthy' if all_ready else 'training_required',
        'models': status,
        'redis_connected': orchestrator.redis.ping()
    }