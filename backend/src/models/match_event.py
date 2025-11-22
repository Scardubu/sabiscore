# backend/src/models/match_event.py
from typing import Any, Dict, List, Optional
from enum import Enum

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Boolean, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import AsyncSession

from .base import Base

class EventType(str, Enum):
    GOAL = "goal"
    YELLOW_CARD = "yellow_card"
    RED_CARD = "red_card"
    SUBSTITUTION = "substitution"
    PENALTY = "penalty"
    PENALTY_MISSED = "penalty_missed"
    OWN_GOAL = "own_goal"
    INJURY = "injury"
    OTHER = "other"

class MatchEvent(Base):
    __tablename__ = "match_events"

    id = Column(String(36), primary_key=True, index=True)
    match_id = Column(String(36), ForeignKey("matches.id"), nullable=False)
    event_type = Column(SQLEnum(EventType), nullable=False)
    minute = Column(Integer, nullable=False)  # Match minute when the event occurred
    team_id = Column(String(36), ForeignKey("teams.id"), nullable=True)  # Team the event is for
    player_id = Column(String(36), ForeignKey("players.id"), nullable=True)  # Player involved
    player2_id = Column(String(36), ForeignKey("players.id"), nullable=True)  # Second player (e.g., assister, sub)
    is_home = Column(Boolean, nullable=False)  # Whether the event is for the home team
    description = Column(String(255), nullable=True)  # Additional description
    event_metadata = Column(JSONB, nullable=True)  # Additional event data
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    match = relationship("Match", back_populates="events")
    team = relationship("Team")
    player = relationship("Player", foreign_keys=[player_id])
    player2 = relationship("Player", foreign_keys=[player2_id])

    def __repr__(self) -> str:
        return f"<MatchEvent {self.event_type} @ {self.minute}' ({self.match_id})>"

    @classmethod
    async def get_match_events(
        cls,
        db: "AsyncSession",
        match_id: str,
        event_type: Optional[EventType] = None,
        team_id: Optional[str] = None,
    ) -> List["MatchEvent"]:
        """Get all events for a match, optionally filtered by type and team"""
        query = select(cls).where(cls.match_id == match_id)
        
        if event_type:
            query = query.where(cls.event_type == event_type)
        if team_id:
            query = query.where(cls.team_id == team_id)
            
        query = query.order_by(cls.minute.asc(), cls.created_at.asc())
        
        result = await db.execute(query)
        return result.scalars().all()

    @classmethod
    async def get_goals(
        cls,
        db: "AsyncSession",
        match_id: str,
        team_id: Optional[str] = None,
    ) -> List["MatchEvent"]:
        """Get all goal events for a match"""
        return await cls.get_match_events(
            db, match_id, event_type=EventType.GOAL, team_id=team_id
        )

    @classmethod
    async def get_cards(
        cls,
        db: "AsyncSession",
        match_id: str,
        card_type: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> List["MatchEvent"]:
        """Get all card events for a match, optionally filtered by card type"""
        query = select(cls).where(
            (cls.match_id == match_id) &
            (cls.event_type.in_([EventType.YELLOW_CARD, EventType.RED_CARD]))
        )
        
        if card_type:
            query = query.where(cls.event_type == card_type)
        if team_id:
            query = query.where(cls.team_id == team_id)
            
        query = query.order_by(cls.minute.asc(), cls.created_at.asc())
        
        result = await db.execute(query)
        return result.scalars().all()

    @classmethod
    async def get_substitutions(
        cls,
        db: "AsyncSession",
        match_id: str,
        team_id: Optional[str] = None,
    ) -> List["MatchEvent"]:
        """Get all substitution events for a match"""
        return await cls.get_match_events(
            db, match_id, event_type=EventType.SUBSTITUTION, team_id=team_id
        )
        """Get all substitution events for a match"""
        return