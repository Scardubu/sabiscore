# PHASE 2 COMPREHENSIVE ANALYSIS & IMPLEMENTATION PLAN

**Status**: Ready for execution  
**Date**: May 30, 2026  
**Target**: Fixture data integration + upcoming match predictions

---

## EXECUTIVE SUMMARY

Phase 2 builds on Phase 1's draw calibration fixes by integrating live fixture data and enabling **end-to-end upcoming match predictions** with:
- Real-time fixture fetching (Football-Data.org v4 API)
- Resilient fallback to database (if API unavailable)
- Feature engineering for upcoming matches (using defaults for missing historical data)
- Value bet edge detection (Kelly % + CLV in NGN)
- Frontend integration via `/api/v1/upcoming` endpoint

**Current State**: ~70% infrastructure already exists
- ✅ FootballDataAPIClient (backend/src/data/loaders/football_data_api.py)
- ✅ UpcomingMatchService (backend/src/services/upcoming_match_service.py)
- ✅ Feature engineering pipeline (transformers.py + feature_engineer.py)
- ✅ Prediction API (backend/src/api/routes/predictions.py)
- ⚠️ Missing: /api/v1/upcoming endpoint + feature projection for upcoming matches

---

## CODEBASE ARCHITECTURE OVERVIEW

### Layered Structure

```
┌─────────────────────────────────────────┐
│ Frontend (apps/web/src/app/api/predict) │ ← predict/route.ts (proxies to backend)
└────────────────┬────────────────────────┘
                 │ HTTP/REST
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ FastAPI Backend (backend/src/main.py)                           │
├─────────────────────────────────────────────────────────────────┤
│ API Routes Layer (api/routes/predictions.py)                    │
│  - POST /api/v1/predictions/predict ✅ EXISTING                 │
│  - GET  /api/v1/upcoming ⚠️ NEEDS CREATION                     │
├─────────────────────────────────────────────────────────────────┤
│ Services Layer                                                  │
│  - UpcomingMatchService ✅ (with API-first + DB fallback)       │
│  - PredictionService ⚠️ (needs enhancement for upcoming)        │
│  - FeatureEngineerService ⚠️ (needs feature projection)         │
├─────────────────────────────────────────────────────────────────┤
│ Data Layer                                                      │
│  ├─ Loaders: football_data_api.py ✅ (FD.org v4 client)         │
│  ├─ Transformers: transformers.py ✅ (58-dim canonical schema)  │
│  ├─ Enrichment: feature_engineer.py ✅ (220-dim → 58-dim)       │
│  └─ Database: core/database.py ✅ (Match, Team, League, Odds)   │
├─────────────────────────────────────────────────────────────────┤
│ ML Models Layer                                                 │
│  ├─ Ensemble: ensemble.py ✅ (meta-learner with isotonic cal)   │
│  └─ Leagues: premier_league.py, la_liga.py, etc. ✅ (all 6)     │
├─────────────────────────────────────────────────────────────────┤
│ Infrastructure                                                  │
│  ├─ Cache: core/cache.py (Redis or in-memory)                   │
│  ├─ Database: PostgreSQL + SQLite fallback                      │
│  └─ Config: core/config.py (env vars + settings)                │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow for Upcoming Matches

```
┌──────────────────────────────────────────────────────────────────┐
│ Football-Data.org API (external)                                │
│ - Endpoint: /v4/competitions/{PL,PD,BL1,SA,FL1}/matches        │
│ - Params: dateFrom, dateTo, status=SCHEDULED                    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼ (FootballDataAPIClient._get_upcoming_matches)
┌────────────────────────────────────────────┐
│ UpcomingMatchService                       │
│ - Fetch upcoming matches (API-first)       │
│ - Cache layer (5 min TTL)                  │
│ - DB fallback if API fails                 │
└────────────────┬───────────────────────────┘
                 │ Normalized match list:
                 │ [{"id", "home_team", "away_team", "league", "match_date", ...}]
                 ▼
┌────────────────────────────────────────────────────────────────┐
│ Feature Projection Service (TO CREATE)                          │
│ - For each match:                                               │
│   1. Fetch historical stats (if any)                            │
│   2. Use DEFAULT_FEATURE_VALUES_58 for missing data             │
│   3. Project to canonical 58-dim schema                         │
│ Output: 58-dimensional feature vector per match                 │
└────────────────────┬───────────────────────────────────────────┘
                     │ 58-dim vectors
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ ML Prediction Layer                                             │
│ - Select league-specific model (e.g., PremierLeagueModel)       │
│ - Load league model + meta-learner                              │
│ - predict() → [P(home), P(draw), P(away)]                       │
│ - (All with isotonic calibration from Phase 1) ✅               │
└────────────────────┬───────────────────────────────────────────┘
                     │ Calibrated probabilities
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ Edge Detection & Value Bet Scoring (TO CREATE)                  │
│ - Compare predicted vs market probabilities                     │
│ - Calculate edge: (pred_prob - market_prob) * 100              │
│ - Kelly stake: edge / (odds - 1)                                │
│ - CLV: (pred_prob * odds - 1) * 100 cents                       │
└────────────────────┬───────────────────────────────────────────┘
                     │ Predictions + value bets
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ GET /api/v1/upcoming (Response) (TO CREATE)                     │
│ {                                                               │
│   "upcoming_matches": [                                         │
│     {                                                           │
│       "match_id": "fd-123456",                                  │
│       "home_team": "Arsenal",                                   │
│       "away_team": "Chelsea",                                   │
│       "league": "Premier League",                               │
│       "match_date": "2026-05-31T15:00:00Z",                    │
│       "predictions": {                                          │
│         "home_win": 0.48,                                       │
│         "draw": 0.22,                                           │
│         "away_win": 0.30                                        │
│       },                                                        │
│       "odds": {                                                 │
│         "home_win": 2.10,                                       │
│         "draw": 3.40,                                           │
│         "away_win": 3.80                                        │
│       },                                                        │
│       "value_bets": [                                           │
│         {                                                       │
│           "outcome": "draw",                                    │
│           "edge_pct": 8.5,                                      │
│           "kelly_stake_pct": 4.2,                               │
│           "clv_cents": 28.9,                                    │
│           "recommended_stake_ngn": 5000                         │
│         }                                                       │
│       ],                                                        │
│       "has_value": true,                                        │
│       "source": "football-data.org"                             │
│     }                                                           │
│   ],                                                            │
│   "total": 15,                                                  │
│   "cache_hit": false,                                           │
│   "ttl_seconds": 300                                            │
│ }                                                               │
└────────────────────────────────────────────────────────────────┘
```

---

## PHASE 2-A: FIXTURE DATA INTEGRATION

### Goals
1. ✅ Verify Football-Data.org API client is production-ready
2. ⚠️ Enhance UpcomingMatchService to handle prediction integration
3. ⚠️ Create feature projection service for upcoming matches
4. Create `/api/v1/upcoming` endpoint

### Current Implementation Status

**FootballDataAPIClient** (backend/src/data/loaders/football_data_api.py)
- ✅ **What's implemented**:
  - Async httpx client for Football-Data.org v4 API
  - Supports all 6 top competitions (PL, PD, BL1, SA, FL1, DED)
  - Normalize match data to common schema
  - Cache-aware retry logic (429 rate limit handling)
  - Mock mode for testing (if mock_mode=True in settings)
  
- ✅ **What's correct**:
  - Codepoint: Line 30-80 (get_upcoming_matches async method)
  - Auth via FOOTBALL_DATA_API_KEY env var
  - Returns normalized list: `[{"id", "home_team", "away_team", "league", "match_date", ...}]`
  - Timezone handling: UTC conversion
  - League code resolution (PL↔EPL, PD↔LaLiga, etc.)

**UpcomingMatchService** (backend/src/services/upcoming_match_service.py)
- ✅ **What's implemented**:
  - API-first pattern (tries FootballDataAPIClient first)
  - DB fallback (AsyncSession queries if API fails)
  - Caching via cache_manager (300s API, 180s DB)
  - Graceful error handling (FootballDataAPIError caught, falls back to DB)

- ⚠️ **What's missing**:
  - No predictions attached to matches
  - No feature engineering for upcoming matches
  - No value bet calculations
  - No odds integration (has_odds always False)
  - Returns raw match data only

### Phase 2-A Deliverables

**2-A.1: Feature Projection Service** (NEW)
File: `backend/src/services/upcoming_match_feature_service.py`

Purpose: Transform upcoming match data to 58-dimensional canonical feature vectors

```python
class UpcomingMatchFeatureService:
    """Project upcoming matches to 58-dimensional canonical feature space"""
    
    async def project_features_for_upcoming_match(
        self,
        match_dict: Dict[str, Any],
        db: AsyncSession,
        league_name: str,
    ) -> Dict[str, Any]:
        """
        Args:
            match_dict: From FootballDataAPIClient normalization
            db: Database session
            league_name: League name (e.g., "Premier League")
        
        Returns:
            {
                "match_id": "fd-123456",
                "home_team": "Arsenal",
                "away_team": "Chelsea",
                "features_58": [58-dimensional numpy array],
                "feature_names": [...],
                "data_quality": {
                    "historical_data_used": bool,
                    "defaults_count": int,
                    "is_synthetic": bool
                }
            }
        """
        # 1. Try to fetch historical stats from database
        home_stats = await self._get_team_historical_stats(match_dict["home_team"], db)
        away_stats = await self._get_team_historical_stats(match_dict["away_team"], db)
        
        # 2. Build feature dict (220-dim intermediate)
        features_220 = {
            "home_form_5": home_stats.get("form_5") or DEFAULT_FEATURE_VALUES_58["home_form_last5_home"],
            "away_form_5": away_stats.get("form_5") or DEFAULT_FEATURE_VALUES_58["away_form_last5_away"],
            # ... 218 more features
        }
        
        # 3. Project to canonical 58-dim
        features_58 = self._project_220_to_58(features_220)
        
        # 4. Return with quality metadata
        return {
            "match_id": match_dict["id"],
            "features_58": features_58,
            "data_quality": {...}
        }
```

**2-A.2: Enhanced Upcoming Match Service**
File: `backend/src/services/upcoming_match_service.py` (extend existing)

Add method:
```python
async def get_upcoming_matches_with_predictions(
    self,
    db: AsyncSession,
    prediction_service: PredictionService,
    league: Optional[str] = None,
    days_ahead: int = 7,
    limit: int = 20,
) -> Dict[str, Any]:
    """Fetch upcoming matches + predictions + value bets"""
    
    # 1. Get upcoming matches (API or DB)
    matches_response = await self.get_upcoming_matches(
        db, league, days_ahead, limit
    )
    
    # 2. For each match:
    for match in matches_response["matches"]:
        # Generate features
        features = await feature_service.project_features_for_upcoming_match(
            match, db, league
        )
        
        # Get predictions
        predictions = await prediction_service.predict(
            features, league
        )
        
        # Get odds + calculate value bets
        odds_data = await self._fetch_match_odds(match["id"])
        value_bets = self._calculate_value_bets(predictions, odds_data)
        
        # Attach to match
        match["predictions"] = predictions
        match["odds"] = odds_data
        match["value_bets"] = value_bets
        match["has_value"] = len(value_bets) > 0
    
    return matches_response
```

**2-A.3: Create `/api/v1/upcoming` Endpoint**
File: `backend/src/api/routes/upcoming_matches.py` (NEW)

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from ...services.upcoming_match_service import UpcomingMatchService
from ...core.database import get_db

router = APIRouter(prefix="/upcoming", tags=["upcoming"])

@router.get("/matches")
async def get_upcoming_matches(
    league: Optional[str] = Query(None, description="Filter by league (EPL, LaLiga, etc)"),
    days_ahead: int = Query(7, ge=1, le=30),
    limit: int = Query(20, ge=1, le=50),
    include_predictions: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """
    Get upcoming matches with optional predictions and value bets
    
    Returns:
    - Live fixture data from Football-Data.org (or DB fallback)
    - Predicted probabilities (if include_predictions=true)
    - Market odds + value bet recommendations
    - Quality metadata (data freshness, historical data used)
    """
    service = UpcomingMatchService()
    
    if include_predictions:
        response = await service.get_upcoming_matches_with_predictions(
            db, league=league, days_ahead=days_ahead, limit=limit
        )
    else:
        response = await service.get_upcoming_matches(
            db, league=league, days_ahead=days_ahead, limit=limit
        )
    
    return response
```

### Phase 2-A Integration Points

1. **Register endpoint** in `backend/src/api/main.py`:
   ```python
   from .routes import upcoming_matches
   app.include_router(upcoming_matches.router, prefix="/api/v1")
   ```

2. **Update frontend** `apps/web/src/app/api/upcoming/route.ts`:
   ```typescript
   export async function GET(request: NextRequest) {
     const backendUrl = resolveBackendBaseUrl();
     const params = new URLSearchParams({
       league: request.nextUrl.searchParams.get('league') || '',
       days_ahead: '7',
       include_predictions: 'true'
     });
     
     const response = await fetch(`${backendUrl}/api/v1/upcoming/matches?${params}`, {
       headers: { 'Authorization': `Bearer ${BACKEND_TOKEN}` }
     });
     return NextResponse.json(await response.json());
   }
   ```

---

## PHASE 2-B: UPCOMING MATCHES SERVICE

### Goals
1. Integrate predictions into match response
2. Calculate value bets + Kelly stakes
3. Format odds & probabilities in frontend-friendly format
4. Add caching layer (30s for predictions, vary by match)

### Implementation Details

**PredictionService Enhancement** (TO CREATE)
File: `backend/src/services/prediction_service.py`

```python
class PredictionService:
    """Generate predictions + value bets for matches"""
    
    async def predict(
        self,
        features_58: np.ndarray,
        league_name: str,
        match_id: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        Get calibrated probabilities from league-specific model
        
        Returns: {"home_win": 0.48, "draw": 0.22, "away_win": 0.30}
        """
        # 1. Load league-specific model (e.g., PremierLeagueModel)
        model = self._load_league_model(league_name)
        
        # 2. Scale features
        features_scaled = model.scaler.transform(features_58.reshape(1, -1))
        
        # 3. Get predictions from ensemble
        predictions = model.predict(features_scaled)
        
        # 4. Return calibrated probabilities (isotonic from Phase 1)
        return {
            "home_win": float(predictions[0]),
            "draw": float(predictions[1]),
            "away_win": float(predictions[2]),
            "model_version": "1.0.0",
            "calibration_method": "isotonic"  # Phase 1 improvement ✅
        }
    
    async def calculate_value_bets(
        self,
        predictions: Dict[str, float],
        market_odds: Dict[str, float],
        kelly_fraction: float = 0.25,
        min_edge_pct: float = 3.0,
    ) -> List[Dict[str, Any]]:
        """
        Identify value bets using Kelly criterion + CLV
        
        Edge calculation:
        - Market implied prob: 1/odds / (1/H + 1/D + 1/A)
        - Predicted prob: from model
        - Edge: (pred_prob - market_prob) * 100 %
        - Kelly stake: edge / (odds - 1)
        - CLV: (pred_prob * odds - 1) * 100 cents
        
        Returns only bets with edge >= min_edge_pct
        """
        value_bets = []
        
        for outcome in ["home_win", "draw", "away_win"]:
            pred_prob = predictions[outcome]
            odds = market_odds[outcome]
            
            # Market implied probability
            market_prob = 1.0 / odds
            
            # Calculate edge
            edge_pct = (pred_prob - market_prob) * 100
            
            # Only include if positive edge
            if edge_pct < min_edge_pct:
                continue
            
            # Kelly stake
            kelly_pct = (edge_pct / 100) / (odds - 1) * kelly_fraction
            
            # CLV (Closing Line Value)
            clv_cents = (pred_prob * odds - 1) * 100
            
            # Recommended stake in NGN (Nigerian Naira)
            base_stake_ngn = 10000  # 10k NGN base unit
            recommended_stake = base_stake_ngn * kelly_pct
            
            value_bets.append({
                "outcome": outcome,
                "edge_pct": round(edge_pct, 2),
                "kelly_stake_pct": round(kelly_pct * 100, 2),
                "clv_cents": round(clv_cents, 1),
                "recommended_stake_ngn": int(recommended_stake),
                "confidence": self._calculate_confidence(pred_prob, edge_pct),
            })
        
        return sorted(value_bets, key=lambda x: x["edge_pct"], reverse=True)
```

**Odds Integration** (TO CREATE)
File: `backend/src/services/odds_service.py`

```python
class OddsService:
    """Fetch and normalize odds from multiple bookmakers"""
    
    async def get_match_odds(
        self,
        match_id: str,
        home_team: str,
        away_team: str,
        match_date: datetime,
    ) -> Dict[str, Any]:
        """Fetch odds for upcoming match"""
        
        # 1. Try database (historical odds snapshots)
        db_odds = await self._get_odds_from_db(match_id)
        
        # 2. Try external odds APIs (Pinnacle, BetFair via connectors)
        # (already have connectors for these in backend/src/connectors/)
        live_odds = await self._get_live_odds(match_id, match_date)
        
        # 3. Normalize to [H, D, A] format
        normalized = {
            "home_win": live_odds.get("home_win", db_odds.get("home_win", 2.0)),
            "draw": live_odds.get("draw", db_odds.get("draw", 3.3)),
            "away_win": live_odds.get("away_win", db_odds.get("away_win", 2.8)),
            "source": "live" if live_odds else "database",
        }
        
        return normalized
```

**Response Format**

```python
# GET /api/v1/upcoming/matches?league=EPL&days_ahead=7
{
  "upcoming_matches": [
    {
      "match_id": "fd-631821",
      "home_team": "Arsenal",
      "away_team": "Chelsea",
      "league": "Premier League",
      "match_date": "2026-05-31T15:00:00Z",
      "venue": "Emirates Stadium",
      
      # Predictions (Phase 1: isotonic calibration ✅)
      "predictions": {
        "home_win": 0.483,
        "draw": 0.218,
        "away_win": 0.299,
        "model_version": "1.0.0",
        "calibration_method": "isotonic",
        "model_confidence": 0.87
      },
      
      # Market odds
      "odds": {
        "home_win": 2.10,
        "draw": 3.40,
        "away_win": 3.80,
        "source": "pinnacle",
        "timestamp": "2026-05-30T18:22:15Z"
      },
      
      # Value bets
      "value_bets": [
        {
          "outcome": "draw",
          "edge_pct": 8.5,
          "kelly_stake_pct": 4.2,
          "clv_cents": 28.9,
          "recommended_stake_ngn": 5000,
          "confidence": 0.81
        },
        {
          "outcome": "away_win",
          "edge_pct": 5.2,
          "kelly_stake_pct": 2.1,
          "clv_cents": 15.3,
          "recommended_stake_ngn": 2500,
          "confidence": 0.72
        }
      ],
      
      "has_value": true,
      "data_quality": {
        "historical_data_available": true,
        "feature_completeness_pct": 92.0,
        "defaults_used_count": 5,
        "is_synthetic": false
      },
      "source": "football-data.org"
    },
    // ... more matches
  ],
  
  "summary": {
    "total": 15,
    "matches_with_value": 7,
    "avg_edge_pct": 4.8,
    "cache_hit": false,
    "ttl_seconds": 300
  }
}
```

---

## IMPLEMENTATION ROADMAP

### Timeline

```
Phase 2-A: Fixture Data Integration
├─ 2-A.1: Feature Projection Service (backend/src/services/upcoming_match_feature_service.py)
│   └─ Estimated: 2-3 hours
│   └─ Keys: _get_team_historical_stats(), _project_220_to_58()
├─ 2-A.2: Extend UpcomingMatchService
│   └─ Estimated: 1-2 hours
│   └─ Add: get_upcoming_matches_with_predictions()
└─ 2-A.3: Create /api/v1/upcoming endpoint
    └─ Estimated: 1 hour
    └─ Routes: GET /upcoming/matches

Phase 2-B: Upcoming Matches Service  
├─ 2-B.1: PredictionService (backend/src/services/prediction_service.py)
│   └─ Estimated: 2-3 hours
│   └─ Keys: predict(), calculate_value_bets()
├─ 2-B.2: OddsService (backend/src/services/odds_service.py)
│   └─ Estimated: 1-2 hours
│   └─ Keys: get_match_odds(), normalization
├─ 2-B.3: Integrate into routes
│   └─ Estimated: 1 hour
│   └─ Dependency injection, caching
└─ 2-B.4: Frontend integration
    └─ Estimated: 1-2 hours
    └─ apps/web/src/app/api/upcoming/route.ts

Total: ~11-16 hours
```

### Execution Checklist

- [ ] **2-A.1: Feature Projection Service**
  - [ ] Create `backend/src/services/upcoming_match_feature_service.py`
  - [ ] Implement `project_features_for_upcoming_match()`
  - [ ] Implement `_get_team_historical_stats()` (DB queries)
  - [ ] Implement `_project_220_to_58()` (feature mapping)
  - [ ] Add unit tests
  - [ ] Verify 58-dimensional output matches CANONICAL_FEATURES_58

- [ ] **2-A.2: Extend UpcomingMatchService**
  - [ ] Add `get_upcoming_matches_with_predictions()` method
  - [ ] Integrate feature service
  - [ ] Integrate prediction service
  - [ ] Integrate odds service
  - [ ] Update caching strategy
  - [ ] Add error handling for partial failures

- [ ] **2-A.3: Create `/api/v1/upcoming` endpoint**
  - [ ] Create `backend/src/api/routes/upcoming_matches.py`
  - [ ] Implement GET `/matches` handler
  - [ ] Register router in main.py
  - [ ] Add query parameters validation
  - [ ] Add response schema (Pydantic)
  - [ ] Add OpenAPI documentation

- [ ] **2-B.1: PredictionService**
  - [ ] Create `backend/src/services/prediction_service.py`
  - [ ] Implement `predict()` method
  - [ ] Implement `calculate_value_bets()` method
  - [ ] Implement `_calculate_confidence()` helper
  - [ ] Load and cache league models
  - [ ] Unit tests

- [ ] **2-B.2: OddsService**
  - [ ] Create `backend/src/services/odds_service.py`
  - [ ] Implement `get_match_odds()` method
  - [ ] Integrate Pinnacle connector
  - [ ] Integrate database fallback
  - [ ] Odds normalization
  - [ ] Caching strategy

- [ ] **2-B.3: Integration & Caching**
  - [ ] Update main.py to include upcoming_matches router
  - [ ] Configure Redis caching (if available)
  - [ ] Set TTLs: 30s for predictions, 300s for fixtures
  - [ ] Error handling & graceful degradation

- [ ] **2-B.4: Frontend Integration**
  - [ ] Create `apps/web/src/app/api/upcoming/route.ts`
  - [ ] Proxy to backend `/api/v1/upcoming`
  - [ ] Update frontend components to consume endpoint
  - [ ] Display upcoming matches with predictions
  - [ ] Show value bet recommendations

---

## RISK MITIGATION

### Known Constraints

1. **Feature Completeness for Upcoming Matches**
   - Many upcoming matches have < 5 historical matches (new season start)
   - Solution: Use DEFAULT_FEATURE_VALUES_58 (league averages)
   - Fallback: Mark matches with `is_synthetic: true` in metadata

2. **Real-time Odds Availability**
   - Football-Data.org doesn't provide live odds
   - Solution: Fallback to database snapshots or skip edge calculations
   - Mitigation: Only show value bets when live odds available

3. **API Rate Limiting**
   - Football-Data.org: ~200 calls/month on free tier
   - Solution: Cache aggressively (5 min TTL)
   - Fallback: Serve from DB if API unavailable

4. **League Model Availability**
   - Upcoming matches in 6 leagues (PL, LaLiga, Bundesliga, Serie A, Ligue 1, Championship)
   - All models trained in Phase 1 with isotonic calibration ✅
   - Unknown leagues: Use ensemble.py as fallback

### Validation Checkpoints

Before production deployment:

1. **Feature Dimension Consistency**
   - [ ] All 58 features present in projection output
   - [ ] No features outside [-5, 5] (z-score bounds)
   - [ ] Compare to CANONICAL_FEATURES_58 registry

2. **Prediction Quality**
   - [ ] Predicted probabilities sum to 1.0 (tolerance: ±0.01)
   - [ ] Draw predictions >= 0.15 (validation of Phase 1 fix)
   - [ ] Compare to validation set baseline

3. **Value Bet Calculation**
   - [ ] Edge calculation verified against odds
   - [ ] Kelly % in reasonable range (0-5% for typical bets)
   - [ ] Recommended stakes match risk profile

---

## DEPENDENCIES & ENVIRONMENT

### Required Environment Variables

```bash
# Football-Data.org API
FOOTBALL_DATA_API_KEY=your_api_key_here

# Backend configuration
SABISCORE_BACKEND_URL=http://localhost:8000
REQUEST_TIMEOUT=30

# Database
DATABASE_URL=postgresql://user:pass@localhost/sabiscore

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# Odds connectors
PINNACLE_API_KEY=...
BETFAIR_API_KEY=...
```

### Python Dependencies

Already in `backend/requirements.txt`:
- fastapi ✅
- sqlalchemy[asyncio] ✅
- httpx (async HTTP client) ✅
- pandas, numpy ✅
- scikit-learn ✅
- redis (optional) ✅

### External APIs

1. **Football-Data.org v4**
   - Endpoint: https://api.football-data.org/v4
   - Authentication: X-Auth-Token header
   - Rate limit: 200 calls/month (free tier)

2. **Pinnacle API** (existing connector)
   - Location: backend/src/connectors/pinnacle.py
   - Authentication: API key + credentials

3. **BetFair API** (existing connector)
   - Location: backend/src/connectors/betfair.py
   - Authentication: Session token

---

## NEXT STEPS

1. **Immediate** (next session):
   - [ ] Create `upcoming_match_feature_service.py` (2-A.1)
   - [ ] Extend `UpcomingMatchService` (2-A.2)
   - [ ] Create `/api/v1/upcoming` endpoint (2-A.3)

2. **Follow-up**:
   - [ ] Implement PredictionService (2-B.1)
   - [ ] Implement OddsService (2-B.2)
   - [ ] Integration testing
   - [ ] Frontend integration (2-B.4)

3. **Post-Phase 2**:
   - Phase 3: Model retraining pipeline with new fixture data
   - Phase 4: Production deployment + monitoring

---

## REFERENCE MATERIALS

- **Football-Data.org API docs**: https://www.football-data.org/
- **Existing implementations**:
  - FootballDataAPIClient: backend/src/data/loaders/football_data_api.py
  - UpcomingMatchService: backend/src/services/upcoming_match_service.py
  - Feature registry: backend/src/models/feature_registry.py (CANONICAL_FEATURES_58)
- **Phase 1 improvements**: Isotonic calibration in all 6 league models ✅

