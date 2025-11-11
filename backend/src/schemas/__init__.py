# backend/src/schemas/__init__.py

from .user import User, UserCreate, UserInDB, UserUpdate, UserResponse
from .token import Token, TokenPayload
from .team import TeamResponse
from .league import LeagueResponse
from .match import (
    Match, 
    MatchCreate, 
    MatchUpdate, 
    MatchInDB,
    MatchInDBBase,
    MatchResponse,
    MatchDetail
)
from .prediction import Prediction, PredictionCreate, PredictionResponse
from .odds import Odds, OddsCreate, OddsResponse

# Re-export all schemas
__all__ = [
    # User schemas
    "User",
    "UserCreate",
    "UserInDB",
    "UserUpdate",
    "UserResponse",
    
    # Authentication schemas
    "Token",
    "TokenPayload",
    
    # Team schemas
    "TeamResponse",
    
    # League schemas
    "LeagueResponse",
    
    # Match schemas
    "Match",
    "MatchCreate",
    "MatchUpdate",
    "MatchInDB",
    "MatchInDBBase",
    "MatchResponse",
    "MatchDetail",
    
    # Prediction schemas
    "Prediction",
    "PredictionCreate",
    "PredictionResponse",
    
    # Odds schemas
    "Odds",
    "OddsCreate",
    "OddsResponse",
]