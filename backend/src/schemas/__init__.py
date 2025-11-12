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
    MatchDetail,
    MatchSummary,
)
from .prediction import PredictionCreate, PredictionResponse
from .odds import Odds, OddsCreate, OddsResponse
from .value_bet import ValueBetResponse

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
    "MatchSummary",
    
    # Prediction schemas
    "PredictionCreate",
    "PredictionResponse",
    "ValueBetResponse",
    
    # Odds schemas
    "Odds",
    "OddsCreate",
    "OddsResponse",
]