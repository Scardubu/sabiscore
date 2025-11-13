"""
Prediction endpoints for generating match predictions and value bets
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging
from datetime import datetime

from ...db.session import get_async_session
from ...services.prediction import PredictionService
from ...schemas.prediction import (
    MatchPredictionRequest,
    PredictionResponse,
    PredictionCreate
)
from ...schemas.value_bet import ValueBetResponse
from ...core.database import Prediction as PredictionModel
from ...core.cache import cache_manager
from ...utils.mock_data import mock_generator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predictions", tags=["predictions"])

# Feature flag for mock predictions (set to False for production with trained models)
USE_MOCK_PREDICTIONS = False


@router.post("/", response_model=PredictionResponse)
async def create_prediction(
    request: MatchPredictionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Generate comprehensive match prediction with value bet analysis
    
    Pipeline:
    1. Fetch historical data (180k+ matches)
    2. Engineer 220+ features
    3. Run ensemble models (RF, XGBoost, LightGBM)
    4. Apply Platt calibration
    5. Detect value bets (min edge: 4.2%)
    6. Calculate Smart Kelly stakes (⅛ Kelly)
    
    Target: <150ms response time @ 10k CCU
    """
    try:
        # Check if using mock predictions
        if USE_MOCK_PREDICTIONS:
            logger.info(f"Generating mock prediction for {request.home_team} vs {request.away_team}")
            
            # Create mock match data
            mock_match = {
                'id': request.match_id or f"mock_{request.home_team}_{request.away_team}",
                'home_team': request.home_team,
                'away_team': request.away_team,
                'league': request.league,
                'match_date': datetime.utcnow().isoformat(),
                'venue': f"{request.home_team} Stadium",
                'status': 'scheduled',
                'home_odds': request.odds.get('home_win') if request.odds else 2.10,
                'draw_odds': request.odds.get('draw') if request.odds else 3.40,
                'away_odds': request.odds.get('away_win') if request.odds else 3.50,
            }
            
            # Generate prediction
            result = mock_generator.generate_prediction(mock_match)
            
            logger.info(f"Mock prediction generated: confidence={result['confidence']}")
            return PredictionResponse(**result)
        
        # Initialize prediction service
        prediction_service = PredictionService(
            db_session=db
        )
        
        # Generate prediction
        logger.info(f"Generating prediction for {request.home_team} vs {request.away_team}")
        start_time = datetime.utcnow()
        
        result = await prediction_service.predict_match(
            match_id=request.match_id or f"{request.home_team}_{request.away_team}_{datetime.utcnow().isoformat()}",
            request=request
        )
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        logger.info(f"Prediction generated in {processing_time:.1f}ms")
        
        # Save to database in background
        background_tasks.add_task(
            _save_prediction_to_db,
            db=db,
            prediction_data=result,
            match_id=request.match_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate prediction: {str(e)}"
        )


@router.get("/{match_id}", response_model=PredictionResponse)
async def get_prediction(
    match_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Retrieve existing prediction for a match
    
    Returns cached prediction if available (< 1 hour old),
    otherwise returns 404 prompting client to generate new prediction.
    """
    try:
        # Check cache first
        cache_key = f"prediction:{match_id}"
        cached_result = cache_manager.get(cache_key)
        
        if cached_result:
            logger.info(f"Cache hit for prediction {match_id}")
            if isinstance(cached_result, dict):
                return PredictionResponse(**cached_result)
            return cached_result
        
        # Fetch from database
        from sqlalchemy import select
        query = select(PredictionModel).where(PredictionModel.match_id == match_id)
        result = await db.execute(query)
        prediction = result.scalar_one_or_none()
        
        if not prediction:
            raise HTTPException(
                status_code=404,
                detail=f"No prediction found for match {match_id}. Generate a new prediction."
            )
        
        # Check if prediction is stale (> 1 hour old)
        age_minutes = (datetime.utcnow() - prediction.created_at).total_seconds() / 60
        if age_minutes > 60:
            raise HTTPException(
                status_code=410,
                detail=f"Prediction is {age_minutes:.0f} minutes old. Generate a fresh prediction."
            )
        
        # Transform to response format
        response = PredictionResponse(
            match_id=prediction.match_id,
            home_team=prediction.home_team,
            away_team=prediction.away_team,
            league=prediction.league,
            predictions={
                'home_win': prediction.home_win_prob,
                'draw': prediction.draw_prob,
                'away_win': prediction.away_win_prob,
            },
            confidence=prediction.confidence,
            brier_score=prediction.brier_score,
            value_bets=prediction.value_bets or [],
            metadata={
                'model_version': prediction.model_version,
                'created_at': prediction.created_at.isoformat(),
                'age_minutes': int(age_minutes),
            }
        )
        
        # Cache for 30 minutes
        cache_manager.set(cache_key, response, ttl=1800)
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prediction for {match_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch prediction")


@router.get("/value-bets/today", response_model=list[ValueBetResponse])
async def get_todays_value_bets(
    min_edge: float = 0.042,  # 4.2% minimum
    min_confidence: float = 0.70,  # 70% confidence
    league: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get all value bets for today's matches
    
    Filters:
    - min_edge: Minimum edge threshold (default: 4.2%)
    - min_confidence: Minimum model confidence (default: 70%)
    - league: Optional league filter
    
    Returns sorted by edge (highest first)
    """
    try:
        # Use mock data for development
        if USE_MOCK_PREDICTIONS:
            logger.info("Generating mock value bets for today")
            value_bets = mock_generator.generate_value_bets_today(count=limit)
            
            # Filter by league if specified
            if league:
                value_bets = [vb for vb in value_bets if vb['league'].upper() == league.upper()]
            
            # Apply confidence filter
            value_bets = [vb for vb in value_bets if vb['confidence'] >= min_confidence]
            
            responses = [ValueBetResponse(**vb) for vb in value_bets]
            logger.info(f"Generated {len(responses)} mock value bets")
            return responses
        
        # Check cache
        cache_key = f"value_bets:today:{min_edge}:{min_confidence}:{league}"
        cached_result = cache_manager.get(cache_key)
        
        if cached_result:
            return cached_result
        
        # Fetch from database
        from sqlalchemy import select, and_
        from ...models.bet import ValueBet
        from datetime import datetime, timedelta
        
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0)
        today_end = today_start + timedelta(days=1)
        
        query = select(ValueBet).where(
            and_(
                ValueBet.match_date >= today_start,
                ValueBet.match_date < today_end,
                ValueBet.edge_ngn >= min_edge * 10000,  # Convert to Naira
                ValueBet.confidence >= min_confidence,
                ValueBet.status == "active"
            )
        )
        
        if league:
            query = query.where(ValueBet.league == league.upper())
        
        query = query.order_by(ValueBet.edge_ngn.desc()).limit(limit)
        
        result = await db.execute(query)
        value_bets = result.scalars().all()
        
        # Transform to response
        responses = [
            ValueBetResponse(
                match_id=str(bet.match_id),
                home_team=bet.home_team,
                away_team=bet.away_team,
                bet_type=bet.bet_type,
                recommended_odds=bet.recommended_odds,
                market_odds=bet.market_odds,
                edge_ngn=bet.edge_ngn,
                edge_percent=bet.edge_percent,
                kelly_stake_ngn=bet.kelly_stake_ngn,
                confidence=bet.confidence,
                league=bet.league,
            )
            for bet in value_bets
        )
        
        # Cache for 10 minutes
        cache_manager.set(cache_key, responses, ttl=600)
        
        logger.info(f"Found {len(responses)} value bets for today")
        return responses
        
    except Exception as e:
        logger.error(f"Error fetching value bets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch value bets")


async def _save_prediction_to_db(
    db: AsyncSession,
    prediction_data: PredictionResponse,
    match_id: Optional[str]
):
    """Background task to save prediction to database"""
    try:
        prediction = PredictionModel(
            match_id=match_id or prediction_data.match_id,
            home_team=prediction_data.home_team,
            away_team=prediction_data.away_team,
            league=prediction_data.league,
            home_win_prob=prediction_data.predictions['home_win'],
            draw_prob=prediction_data.predictions['draw'],
            away_win_prob=prediction_data.predictions['away_win'],
            confidence=prediction_data.confidence,
            brier_score=prediction_data.brier_score,
            model_version=prediction_data.metadata.get('model_version', '3.0'),
            value_bets=prediction_data.value_bets,
        )
        
        db.add(prediction)
        await db.commit()
        logger.info(f"Saved prediction to database: {match_id}")
        
    except Exception as e:
        logger.error(f"Failed to save prediction to DB: {e}")
        await db.rollback()
