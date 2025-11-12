"""
Match endpoints for fetching upcoming matches and historical data
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from ...db.session import get_async_session
from ...core.database import Match, Team
from ...schemas.match import (
    MatchSummary,
    MatchListResponse,
    MatchDetailResponse
)
from ...core.cache import cache_manager
from ...utils.mock_data import mock_generator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/matches", tags=["matches"])

# Feature flag for mock data (set to False for production with real DB)
USE_MOCK_DATA = False


@router.get("/upcoming", response_model=MatchListResponse)
async def get_upcoming_matches(
    league: Optional[str] = Query(None, description="Filter by league (epl, bundesliga, laliga, etc)"),
    days_ahead: int = Query(7, ge=1, le=30, description="Number of days to look ahead"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of matches to return"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get upcoming matches for predictions
    
    Returns matches scheduled within the next N days, optionally filtered by league.
    Results are cached for 5 minutes to optimize performance.
    """
    try:
        # Check cache first
        cache_key = f"upcoming_matches:{league}:{days_ahead}:{limit}"
        cached_result = await cache_manager.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for upcoming matches (league={league})")
            return cached_result
        
        # Use mock data for development
        if USE_MOCK_DATA:
            logger.info("Using mock data generator for matches")
            mock_matches = mock_generator.generate_upcoming_matches(days=days_ahead, count=limit)
            
            # Filter by league if specified
            if league:
                mock_matches = [m for m in mock_matches if m['league'].upper() == league.upper()]
            
            # Transform to response format
            match_responses = [
                MatchSummary(
                    id=m['id'],
                    home_team=m['home_team'],
                    away_team=m['away_team'],
                    league=m['league'],
                    match_date=m['match_date'],
                    venue=m['venue'],
                    status=m['status'],
                    has_odds=True,
                )
                for m in mock_matches
            ]
            
            response = MatchListResponse(
                matches=match_responses,
                total=len(match_responses),
                league_filter=league,
                date_range_days=days_ahead
            )
            
            # Cache for 5 minutes
            await cache_manager.set(cache_key, response, ttl=300)
            
            logger.info(f"Generated {len(match_responses)} mock matches (league={league})")
            return response
        
        # Calculate date range
        now = datetime.utcnow()
        end_date = now + timedelta(days=days_ahead)
        
        # Build query
        query = select(Match).where(
            and_(
                Match.match_date >= now,
                Match.match_date <= end_date,
                Match.status == "scheduled"
            )
        )
        
        # Apply league filter if provided
        if league:
            query = query.where(Match.league_name == league.upper())
        
        # Order by date and limit results
        query = query.order_by(Match.match_date.asc()).limit(limit)
        
        # Execute query
        result = await db.execute(query)
        matches = result.scalars().all()
        
        # Transform to response format
        match_responses = [
            MatchSummary(
                id=str(match.id),
                home_team=match.home_team_name,
                away_team=match.away_team_name,
                league=match.league_name,
                match_date=match.match_date.isoformat(),
                venue=match.venue,
                status=match.status,
                has_odds=match.home_odds is not None,
            )
            for match in matches
        ]
        
        response = MatchListResponse(
            matches=match_responses,
            total=len(match_responses),
            league_filter=league,
            date_range_days=days_ahead
        )
        
        # Cache for 5 minutes
        await cache_manager.set(cache_key, response, ttl=300)
        
        logger.info(f"Fetched {len(match_responses)} upcoming matches (league={league})")
        return response
        
    except Exception as e:
        logger.error(f"Error fetching upcoming matches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming matches")


@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match_detail(
    match_id: str,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get detailed information about a specific match
    
    Includes team form, head-to-head history, odds movement, and prediction metadata.
    """
    try:
        # Check cache
        cache_key = f"match_detail:{match_id}"
        cached_result = await cache_manager.get(cache_key)
        if cached_result:
            return cached_result
        
        # Fetch match from database
        query = select(Match).where(Match.id == match_id)
        result = await db.execute(query)
        match = result.scalar_one_or_none()
        
        if not match:
            raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
        
        # Build detailed response
        response = MatchDetailResponse(
            id=str(match.id),
            home_team=match.home_team_name,
            away_team=match.away_team_name,
            league=match.league_name,
            match_date=match.match_date.isoformat(),
            venue=match.venue,
            status=match.status,
            odds={
                "home_win": match.home_odds,
                "draw": match.draw_odds,
                "away_win": match.away_odds,
            } if match.home_odds else None,
            referee=match.referee,
            season=match.season,
            round_number=match.round,
        )
        
        # Cache for 10 minutes
        await cache_manager.set(cache_key, response, ttl=600)
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching match detail for {match_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch match details")


@router.get("/league/{league_name}", response_model=MatchListResponse)
async def get_matches_by_league(
    league_name: str,
    status: Optional[str] = Query(None, description="Filter by status (scheduled, live, finished)"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Get all matches for a specific league
    
    Useful for league-specific analysis and historical performance tracking.
    """
    try:
        # Build query
        query = select(Match).where(Match.league_name == league_name.upper())
        
        if status:
            query = query.where(Match.status == status.lower())
        
        query = query.order_by(Match.match_date.desc()).limit(limit)
        
        # Execute
        result = await db.execute(query)
        matches = result.scalars().all()
        
        # Transform
        match_responses = [
            MatchSummary(
                id=str(match.id),
                home_team=match.home_team_name,
                away_team=match.away_team_name,
                league=match.league_name,
                match_date=match.match_date.isoformat(),
                venue=match.venue,
                status=match.status,
                has_odds=match.home_odds is not None,
            )
            for match in matches
        ]
        
        return MatchListResponse(
            matches=match_responses,
            total=len(match_responses),
            league_filter=league_name,
        )
        
    except Exception as e:
        logger.error(f"Error fetching matches for league {league_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch league matches")
