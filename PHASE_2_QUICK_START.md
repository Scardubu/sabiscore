# 🚀 Phase 2 Quick Start Guide

## Installation (5 minutes)

```bash
# 1. Navigate to backend
cd backend

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install Playwright browsers (required for Understat scraper)
playwright install chromium

# 4. Initialize database schema
python -m src.cli.data_pipeline init-db
```

## Quick Commands

### Load Historical Data (15-20 minutes for 3 leagues)

```bash
# EPL, La Liga, Bundesliga - Last 2 seasons
python -m src.cli.data_pipeline load-historical \
  -l E0 -l SP1 -l D1 \
  -s 2324 -s 2425

# Expected: ~2,280 matches loaded
```

### Scrape xG Data (5-10 minutes)

```bash
# Scrape xG for recent matches
python -m src.cli.data_pipeline scrape-xg --days 7
```

### Generate Features (10-15 minutes for 100 matches)

```bash
# Enrich 100 matches with 220 features
python -m src.cli.data_pipeline enrich-features --limit 100
```

### Check Pipeline Status

```bash
python -m src.cli.data_pipeline pipeline-status
```

**Sample output**:
```
📊 Data Pipeline Status

Matches:
  Total: 2,280
  Finished: 2,280
  With xG: 1,150
  With features: 100

Odds records: 45,600

Recent scraping jobs:
  ✅ football_data_co_uk - historical_load (2,280 records)
  ✅ understat - incremental_update (120 records)
```

## Live Match Polling (Testing)

```bash
# Start ESPN live polling (8s updates)
python -m src.cli.data_pipeline poll-live --league EPL --interval 8

# Output (live matches only):
# [14:23:15] Man City 2-1 Liverpool (67')
# [14:23:23] Arsenal 0-0 Chelsea (45'+2)
# Press Ctrl+C to stop
```

## Environment Variables

Create `.env` in `backend/`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sabiscore
# or use SQLite for testing:
# DATABASE_URL=sqlite:///./sabiscore.db

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=true

# Scraping (optional)
SCRAPER_MAX_CONCURRENT=8
SCRAPER_CACHE_TTL=20

# API Keys (optional - for Phase 2.1)
# ESPN_API_KEY=your_key
# OPTA_API_KEY=your_key
# BETFAIR_APP_KEY=your_key
```

## Python Usage Examples

### Load Historical Data

```python
import asyncio
from backend.src.data.loaders import FootballDataLoader

async def main():
    loader = FootballDataLoader()
    results = await loader.load_all_historical(
        leagues=["E0", "SP1", "D1"],
        seasons=["2324", "2425"],
    )
    print(f"Loaded {sum(results.values())} matches")

asyncio.run(main())
```

### Scrape xG from Understat

```python
import asyncio
from backend.src.data.loaders import UnderstatLoader

async def main():
    async with UnderstatLoader() as loader:
        matches = await loader.fetch_league_matches("EPL", "2024")
        print(f"Found {len(matches)} matches")
        
        if matches:
            xg_data = await loader.fetch_match_xg(matches[0]["id"])
            print(f"xG: {xg_data['home_xg']} - {xg_data['away_xg']}")

asyncio.run(main())
```

### Generate Features

```python
from backend.src.data.enrichment import FeatureEngineer
from backend.src.core.database import session_scope, Match

with session_scope() as db_session:
    engineer = FeatureEngineer(db_session)
    
    # Get a match
    match = db_session.query(Match).first()
    
    # Generate 220 features
    features = engineer.generate_features(match.id)
    print(f"Generated {len(features)} features")
    
    # Save to database
    vector = engineer.save_features(match.id, features)
    print(f"Saved feature vector ID: {vector.id}")
```

### Poll Live Matches

```python
import asyncio
from backend.src.data.connectors import ESPNConnector

async def main():
    async with ESPNConnector(poll_interval=8) as connector:
        matches = await connector.fetch_scoreboard("EPL")
        
        for match in matches:
            print(f"{match['home_team']} {match['home_score']}-{match['away_score']} {match['away_team']}")

asyncio.run(main())
```

## Database Queries

### Check Match Count by League

```sql
SELECT 
  l.name AS league,
  COUNT(*) AS total_matches,
  SUM(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END) AS finished
FROM matches m
JOIN leagues l ON m.league_id = l.id
GROUP BY l.name
ORDER BY total_matches DESC;
```

### Find Matches with xG Data

```sql
SELECT 
  m.id,
  ht.name AS home_team,
  at.name AS away_team,
  m.home_score,
  m.away_score,
  hs.expected_goals AS home_xg,
  as_stats.expected_goals AS away_xg
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
LEFT JOIN match_stats hs ON m.id = hs.match_id AND hs.team_id = m.home_team_id
LEFT JOIN match_stats as_stats ON m.id = as_stats.match_id AND as_stats.team_id = m.away_team_id
WHERE hs.expected_goals IS NOT NULL
LIMIT 10;
```

### View Recent Feature Vectors

```sql
SELECT 
  fv.match_id,
  ht.name AS home_team,
  at.name AS away_team,
  fv.home_form_5,
  fv.away_form_5,
  fv.home_xg_avg_5,
  fv.away_xg_avg_5,
  fv.market_panic_score,
  fv.timestamp
FROM feature_vectors fv
JOIN matches m ON fv.match_id = m.id
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
ORDER BY fv.timestamp DESC
LIMIT 10;
```

## Troubleshooting

### Playwright Installation Issues

```bash
# If playwright install fails, try:
python -m playwright install chromium

# Or manually:
playwright install chromium --with-deps
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
psql -h localhost -U postgres -d sabiscore

# Or use SQLite for testing
# Edit .env:
DATABASE_URL=sqlite:///./sabiscore.db
```

### Import Errors

```bash
# Make sure you're in the backend directory
cd backend

# Run commands with -m flag
python -m src.cli.data_pipeline --help
```

### Rate Limiting

If you encounter rate limiting from data sources:

```bash
# Increase delay in .env
RATE_LIMIT_DELAY=2.0
RATE_LIMIT_REQUESTS=30
```

## Performance Tips

1. **Use caching**: Understat loader caches for 20s
2. **Parallel loading**: FootballDataLoader uses async I/O
3. **Batch features**: Generate features in batches of 100
4. **Database indexes**: Already optimized in schema
5. **Redis cache**: Enable for 85%+ hit rate

## Next Steps

Once Phase 2 is running:

1. **Verify data quality**: Check `scraping_logs` table
2. **Monitor pipeline**: Run `pipeline-status` regularly
3. **Set up cron jobs**: Automate daily scraping
4. **Proceed to Phase 3**: ML Model Ops

---

**Need help?** Check `PHASE_2_COMPLETE.md` for detailed documentation.
