# SabiScore API Documentation

## Overview

The SabiScore API provides RESTful endpoints for football match analysis and betting insights. Built with FastAPI, it offers automatic OpenAPI documentation and comprehensive error handling.

**Base URL**: `http://localhost:8000/api/v1`

## Authentication

Currently, the API is open for development. In production, implement JWT-based authentication.

## Endpoints

### Health Check

**GET** `/health`

Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "database": true,
  "models": true,
  "cache": true
}
```

### Match Search

**GET** `/matches/search`

Search for matches and teams.

**Query Parameters:**
- `q` (string, required): Search query
- `league` (string, optional): League filter

**Response:**
```json
[
  {
    "id": "1",
    "home_team": "Manchester City",
    "away_team": "Liverpool",
    "league": "EPL",
    "match_date": "2024-10-26T15:00:00Z",
    "venue": "Etihad Stadium"
  }
]
```

### Generate Insights

**POST** `/insights`

Generate comprehensive betting insights for a match.

**Request Body:**
```json
{
  "matchup": "Manchester City vs Liverpool",
  "league": "EPL"
}
```

**Response:**
```json
{
  "matchup": "Manchester City vs Liverpool",
  "league": "EPL",
  "predictions": {
    "home_win_prob": 0.65,
    "draw_prob": 0.20,
    "away_win_prob": 0.15,
    "prediction": "home_win",
    "confidence": 78.5
  },
  "xg_analysis": {
    "home_xg": 2.1,
    "away_xg": 1.3,
    "total_xg": 3.4,
    "xg_difference": 0.8
  },
  "value_analysis": [
    {
      "bet_type": "home_win",
      "market_odds": 2.10,
      "expected_odds": 1.54,
      "expected_value": 0.12,
      "confidence": 78.5,
      "recommendation": "Consider"
    }
  ],
  "monte_carlo": {
    "simulations_run": 10000,
    "home_win_prob": 0.652,
    "draw_prob": 0.198,
    "away_win_prob": 0.150
  },
  "scenarios": [
    {
      "name": "Most Likely",
      "probability": 0.65,
      "home_score": 2,
      "away_score": 1,
      "result": "home_win"
    }
  ],
  "explanation": {
    "feature_importance": {
      "home_attack_strength": 0.15,
      "away_defense_strength": 0.12,
      "home_win_rate": 0.10
    }
  },
  "risk_assessment": {
    "risk_level": "low",
    "confidence_score": 78.5,
    "value_available": true,
    "recommendation": "Proceed"
  },
  "narrative": "Our model predicts Home Win with 79% confidence...",
  "generated_at": "2024-10-25T20:00:00.000Z"
}
```

### Model Status

**GET** `/models/status`

Get information about trained models and their performance.

**Response:**
```json
{
  "models_loaded": true,
  "last_trained": "2024-10-25T10:00:00Z",
  "accuracy": 0.732,
  "leagues_supported": ["EPL", "La Liga", "Bundesliga", "Serie A", "Ligue 1", "UCL"]
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "detail": "Error description",
  "error_code": "VALIDATION_ERROR"
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `SERVICE_UNAVAILABLE`: Backend service error
- `RATE_LIMITED`: Too many requests

## Rate Limiting

- **60 requests per minute** per IP address
- Applied to all endpoints
- Returns HTTP 429 when exceeded

## Data Models

### Matchup
String format: `"Home Team vs Away Team"`

### League Codes
- `EPL`: Premier League
- `La Liga`: La Liga
- `Bundesliga`: Bundesliga
- `Serie A`: Serie A
- `Ligue 1`: Ligue 1
- `UCL`: UEFA Champions League

### Bet Types
- `home_win`: Home team to win
- `draw`: Match to end in draw
- `away_win`: Away team to win
- `over_under`: Over/under goals line
- `btts`: Both teams to score

## WebSocket Support

Real-time updates are planned for future implementation using WebSockets for live match data.

## SDKs and Libraries

### JavaScript Client

```javascript
import APIClient from './api-client.js';

const api = new APIClient();
const insights = await api.generateInsights("Man City vs Liverpool", "EPL");
```

### Python Client

```python
import requests

response = requests.post("http://localhost:8000/api/v1/insights",
    json={"matchup": "Man City vs Liverpool", "league": "EPL"}
)
insights = response.json()
```

## Versioning

API versioning follows semantic versioning:
- `/api/v1/` - Current stable version
- Breaking changes will increment the major version

## Monitoring

### Health Checks
- `/health`: Basic service health
- `/metrics`: Prometheus metrics (planned)

### Logging
All requests are logged with timing and error information.

## Security

### Headers
All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### CORS
Configured for frontend domain access with credentials support.
