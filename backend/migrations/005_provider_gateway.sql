-- Provider gateway, canonical identity, and coherent market snapshot tables.

CREATE TABLE IF NOT EXISTS provider_request_summaries (
    id SERIAL PRIMARY KEY,
    provider VARCHAR NOT NULL,
    operation VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    trust_tier VARCHAR NOT NULL,
    acquired_at TIMESTAMP NOT NULL,
    provider_timestamp TIMESTAMP NULL,
    quota_limit INTEGER NULL,
    quota_remaining INTEGER NULL,
    quota_reset_at TIMESTAMP NULL,
    quota_cost INTEGER NULL,
    warnings JSON NULL,
    error_code VARCHAR NULL,
    raw_snapshot_id VARCHAR NULL,
    response_hash VARCHAR NULL
);
CREATE INDEX IF NOT EXISTS ix_provider_request_provider_time ON provider_request_summaries(provider, acquired_at);
CREATE INDEX IF NOT EXISTS ix_provider_request_status ON provider_request_summaries(status);

CREATE TABLE IF NOT EXISTS provider_capabilities (
    id SERIAL PRIMARY KEY,
    provider VARCHAR NOT NULL,
    competition VARCHAR NOT NULL,
    season VARCHAR NULL,
    fixtures BOOLEAN DEFAULT FALSE,
    standings BOOLEAN DEFAULT FALSE,
    lineups BOOLEAN DEFAULT FALSE,
    injuries BOOLEAN DEFAULT FALSE,
    team_statistics BOOLEAN DEFAULT FALSE,
    player_statistics BOOLEAN DEFAULT FALSE,
    odds BOOLEAN DEFAULT FALSE,
    xg BOOLEAN DEFAULT FALSE,
    provider_predictions BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMP NOT NULL,
    notes JSON NULL
);
CREATE INDEX IF NOT EXISTS ix_provider_capability_provider_comp ON provider_capabilities(provider, competition);

CREATE TABLE IF NOT EXISTS provider_quota_observations (
    id SERIAL PRIMARY KEY,
    provider VARCHAR NOT NULL,
    observed_at TIMESTAMP NOT NULL,
    quota_limit INTEGER NULL,
    quota_remaining INTEGER NULL,
    quota_reset_at TIMESTAMP NULL,
    quota_cost INTEGER NULL,
    source VARCHAR NULL
);
CREATE INDEX IF NOT EXISTS ix_provider_quota_provider_time ON provider_quota_observations(provider, observed_at);

CREATE TABLE IF NOT EXISTS canonical_competitions (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    coverage_tier VARCHAR NOT NULL DEFAULT 'STANDARD',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS canonical_teams (
    id VARCHAR PRIMARY KEY,
    competition_id VARCHAR REFERENCES canonical_competitions(id),
    name VARCHAR NOT NULL,
    normalized_name VARCHAR NOT NULL,
    country VARCHAR NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS ix_canonical_teams_competition_name ON canonical_teams(competition_id, name);

CREATE TABLE IF NOT EXISTS canonical_fixtures (
    id VARCHAR PRIMARY KEY,
    competition_id VARCHAR REFERENCES canonical_competitions(id),
    season VARCHAR NULL,
    home_team_id VARCHAR REFERENCES canonical_teams(id),
    away_team_id VARCHAR REFERENCES canonical_teams(id),
    kickoff_utc TIMESTAMP NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'scheduled',
    venue_id VARCHAR NULL,
    reconciliation_status VARCHAR NOT NULL DEFAULT 'UNKNOWN',
    reconciliation_confidence FLOAT NULL,
    evidence JSON NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS ix_canonical_fixtures_comp_kickoff ON canonical_fixtures(competition_id, kickoff_utc);

CREATE TABLE IF NOT EXISTS provider_event_mappings (
    id SERIAL PRIMARY KEY,
    provider VARCHAR NOT NULL,
    provider_event_id VARCHAR NOT NULL,
    canonical_fixture_id VARCHAR REFERENCES canonical_fixtures(id),
    competition VARCHAR NOT NULL,
    reconciliation_status VARCHAR NOT NULL,
    reconciliation_confidence FLOAT NULL,
    evidence JSON NULL,
    checked_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_provider_event_provider_id ON provider_event_mappings(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS ix_provider_event_fixture ON provider_event_mappings(canonical_fixture_id);

CREATE TABLE IF NOT EXISTS market_snapshots (
    id SERIAL PRIMARY KEY,
    canonical_fixture_id VARCHAR NOT NULL REFERENCES canonical_fixtures(id),
    provider VARCHAR NOT NULL,
    bookmaker VARCHAR NOT NULL,
    market_type VARCHAR NOT NULL DEFAULT '1X2',
    home_odds FLOAT NOT NULL,
    draw_odds FLOAT NOT NULL,
    away_odds FLOAT NOT NULL,
    provider_timestamp TIMESTAMP NULL,
    captured_at TIMESTAMP NOT NULL,
    coherent BOOLEAN NOT NULL DEFAULT TRUE,
    executable BOOLEAN NOT NULL DEFAULT FALSE,
    provenance JSON NULL
);
CREATE INDEX IF NOT EXISTS ix_market_snapshots_fixture_time ON market_snapshots(canonical_fixture_id, captured_at);
CREATE INDEX IF NOT EXISTS ix_market_snapshots_bookmaker ON market_snapshots(bookmaker);
