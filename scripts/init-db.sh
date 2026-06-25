#!/bin/bash
set -e

echo "Initializing database..."

# Wait for PostgreSQL to be ready
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' >/dev/null 2>&1; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

# Create tables
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Leagues table
    CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        country VARCHAR(100),
        tier INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Teams table
    CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        short_name VARCHAR(10),
        country VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Matches table
    CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        home_team_id INTEGER REFERENCES teams(id),
        away_team_id INTEGER REFERENCES teams(id),
        league_id INTEGER REFERENCES leagues(id),
        match_date TIMESTAMP WITH TIME ZONE NOT NULL,
        home_goals INTEGER,
        away_goals INTEGER,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Odds table
    CREATE TABLE IF NOT EXISTS odds (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        match_id UUID REFERENCES matches(id),
        bookmaker VARCHAR(50) NOT NULL,
        home_win_odds DECIMAL(6, 2),
        draw_odds DECIMAL(6, 2),
        away_win_odds DECIMAL(6, 2),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Model predictions table
    CREATE TABLE IF NOT EXISTS predictions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        match_id UUID REFERENCES matches(id),
        model_name VARCHAR(50) NOT NULL,
        home_win_prob DECIMAL(5, 4),
        draw_prob DECIMAL(5, 4),
        away_win_prob DECIMAL(5, 4),
        confidence_score DECIMAL(5, 4),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- User accounts
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_superuser BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- User bets
    CREATE TABLE IF NOT EXISTS bets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        match_id UUID REFERENCES matches(id),
        prediction_id UUID REFERENCES predictions(id),
        bet_type VARCHAR(20) NOT NULL,  -- 'home_win', 'draw', 'away_win', 'over_2.5', etc.
        odds DECIMAL(6, 2) NOT NULL,
        stake DECIMAL(10, 2) NOT NULL,
        potential_win DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'won', 'lost', 'cancelled'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        settled_at TIMESTAMP WITH TIME ZONE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_matches_league_date ON matches(league_id, match_date);
    CREATE INDEX IF NOT EXISTS idx_odds_match_bookmaker ON odds(match_id, bookmaker);
    CREATE INDEX IF NOT EXISTS idx_predictions_match_model ON predictions(match_id, model_name);
    CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);

    -- Insert sample data (optional, for development)
    INSERT INTO leagues (name, country, tier) VALUES 
        ('Premier League', 'England', 1),
        ('La Liga', 'Spain', 1),
        ('Bundesliga', 'Germany', 1),
        ('Serie A', 'Italy', 1),
        ('Ligue 1', 'France', 1)
    ON CONFLICT (name) DO NOTHING;

    -- Create a function to update the updated_at timestamp
    CREATE OR REPLACE FUNCTION update_modified_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create triggers to automatically update the updated_at column
    CREATE TRIGGER update_teams_modtime
        BEFORE UPDATE ON teams
        FOR EACH ROW EXECUTE FUNCTION update_modified_column();

    CREATE TRIGGER update_matches_modtime
        BEFORE UPDATE ON matches
        FOR EACH ROW EXECUTE FUNCTION update_modified_column();

    CREATE TRIGGER update_users_modtime
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_modified_column();
EOSQL

echo "Database initialization complete!"
