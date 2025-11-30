import asyncio
import sys
import os
from datetime import datetime, timedelta
import uuid

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from src.core.database import (
    get_db,
    engine,
    Base,
    League,
    Team,
    Match,
    Odds,
    LeagueStanding,
    MatchStats,
)
from src.services.data_processing import DataProcessingService

def setup_test_data(db):
    league_id = "test-league"

    league = League(id=league_id, name="Test League", country="Testland")
    db.add(league)

    # Create teams
    home_team_id = str(uuid.uuid4())
    away_team_id = str(uuid.uuid4())
    
    home_team = Team(id=home_team_id, name="Test Home FC", country="Testland", league_id=league_id)
    away_team = Team(id=away_team_id, name="Test Away FC", country="Testland", league_id=league_id)
    
    db.add(home_team)
    db.add(away_team)
    
    # Create past matches for form
    for i in range(5):
        match_id = str(uuid.uuid4())
        match = Match(
            id=match_id,
            league_id=league_id,
            home_team_id=home_team_id,
            away_team_id=away_team_id,
            match_date=datetime.utcnow() - timedelta(days=10 + i),
            home_score=2,
            away_score=1,
            status="FINISHED",
        )
        db.add(match)
        
        # Add stats
        h_stats = MatchStats(
            match_id=match_id,
            team_id=home_team_id,
            expected_goals=1.5
        )
        a_stats = MatchStats(
            match_id=match_id,
            team_id=away_team_id,
            expected_goals=0.8
        )
        db.add(h_stats)
        db.add(a_stats)
        
    # Create a future match with odds to exercise the market data query
    future_match_id = str(uuid.uuid4())
    future_match = Match(
        id=future_match_id,
        league_id=league_id,
        home_team_id=home_team_id,
        away_team_id=away_team_id,
        match_date=datetime.utcnow() + timedelta(days=1),
        status="SCHEDULED",
    )
    db.add(future_match)
    
    odds = Odds(
        match_id=future_match_id,
        bookmaker="TestBookie",
        home_win=2.0,
        draw=3.2,
        away_win=3.5,
        timestamp=datetime.utcnow()
    )
    db.add(odds)
    
    # Create standings
    h_standing = LeagueStanding(
        league=league_id,
        team_id=home_team_id,
        position=1,
        points=30,
        played=10,
        won=9,
        drawn=1,
        lost=0,
        goals_for=25,
        goals_against=5,
        goal_difference=20,
        updated_at=datetime.utcnow()
    )
    
    a_standing = LeagueStanding(
        league=league_id,
        team_id=away_team_id,
        position=2,
        points=25,
        played=10,
        won=8,
        drawn=1,
        lost=1,
        goals_for=20,
        goals_against=8,
        goal_difference=12,
        updated_at=datetime.utcnow()
    )
    
    db.add(h_standing)
    db.add(a_standing)
    
    db.commit()
    return home_team_id, away_team_id, league_id

async def test_service():
    print("Setting up database...")
    if engine.url.get_backend_name() == "sqlite":
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = next(get_db())
    try:
        print("Seeding data...")
        h_id, a_id, league_id = setup_test_data(db)
        
        print("Initializing service...")
        service = DataProcessingService(db)
        
        print("Fetching features...")
        features = await service.get_match_features(h_id, a_id, league_id)
        
        print("Features retrieved successfully!")
        print(f"Feature count: {len(features)}")
        print(f"Sample keys: {list(features.keys())[:5]}")
        
        # Verify specific features
        assert features['home_position'] == 1
        assert features['away_position'] == 2
        assert 'home_win_odds' in features
        
        print("Verification passed!")
        
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_service())
