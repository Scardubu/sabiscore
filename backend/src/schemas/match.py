# backend/src/schemas/match.py

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from .team import TeamResponse
from .league import LeagueResponse


class MatchBase(BaseModel):
    """Base match schema with common attributes"""
    home_team_id: str
    away_team_id: str
    league_id: str
    match_date: datetime
    home_goals: Optional[int] = None
    away_goals: Optional[int] = None
    status: str = "scheduled"


class MatchCreate(MatchBase):
    """Schema for creating a new match"""
    pass


class MatchUpdate(BaseModel):
    """Schema for updating a match - all fields optional"""
    home_team_id: Optional[str] = None
    away_team_id: Optional[str] = None
    league_id: Optional[str] = None
    match_date: Optional[datetime] = None
    home_goals: Optional[int] = None
    away_goals: Optional[int] = None
    status: Optional[str] = None


class MatchInDBBase(MatchBase):
    """Base schema for match stored in database"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Match(MatchInDBBase):
    """Standard match schema"""
    pass


class MatchResponse(BaseModel):
    """Basic match information for list views"""
    id: str
    home_team: str
    away_team: str
    league: str
    match_date: str
    venue: Optional[str] = None
    status: str = Field(description="Match status: scheduled, live, finished")
    has_odds: bool = Field(default=False, description="Whether odds data is available")
    
    class Config:
        from_attributes = True


class MatchDetailResponse(BaseModel):
    """Detailed match information including odds and metadata"""
    id: str
    home_team: str
    away_team: str
    league: str
    match_date: str
    venue: Optional[str] = None
    status: str
    odds: Optional[Dict[str, float]] = Field(
        default=None,
        description="Market odds: {home_win, draw, away_win}"
    )
    referee: Optional[str] = None
    season: Optional[str] = None
    round_number: Optional[int] = None
    
    class Config:
        from_attributes = True


class MatchListResponse(BaseModel):
    """Paginated list of matches with metadata"""
    matches: List[MatchResponse]
    total: int
    league_filter: Optional[str] = None
    date_range_days: Optional[int] = None
    
    class Config:
        from_attributes = True


class MatchResponse(MatchInDBBase):
    """Complete match response with nested team and league data"""
    home_team: TeamResponse
    away_team: TeamResponse
    league: LeagueResponse
    predictions: List[Dict[str, Any]] = []
    odds: List[Dict[str, Any]] = []


class MatchDetail(MatchResponse):
    """Alias for MatchResponse - for backward compatibility"""
    pass


# Backward compatibility aliases
MatchInDB = MatchInDBBase