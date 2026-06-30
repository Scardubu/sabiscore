from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_, func
from typing import List, Optional, Dict, Any
import logging
import time
import json
from pathlib import Path
from datetime import datetime

from ..core.database import (
    get_db,
    check_database_health,
    Match,
    Team,
)
from ..core.cache import cache
from ..core.config import settings
from ..schemas.requests import InsightsRequest
from ..schemas.responses import (
    ErrorResponse,
    MatchSearchResponse,
    HealthResponse,
    CacheMetricsResponse,
)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # avoid importing heavy ML dependencies at import time during tests
    from ..models.ensemble import SabiScoreEnsemble  # pragma: no cover - only for type checking

logger = logging.getLogger(__name__)

router = APIRouter()

def _http_error(status_code: int, detail: str, error_code: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=ErrorResponse(detail=detail, error_code=error_code).model_dump(mode="json"),
    )


def _load_model_from_app(request: Request) -> Optional["SabiScoreEnsemble"]:
    model = getattr(request.app.state, "model_instance", None)
    if model is not None and getattr(model, "is_trained", False):
        return model

    # Do not import api.main here (it defines a FastAPI app and causes side-effects
    # when imported). Rely on request.app.state which is populated by the running
    # application process to access loaded model instances.
    return None


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request, db: Session = Depends(get_db)):
    """Enhanced health check with database and cache status"""
    start_time = time.time()

    try:
        # Test database connection
        db_healthy = check_database_health()

        # Test cache connection
        cache_healthy = cache.ping()

        # Test model availability using in-memory instance
        model_instance = getattr(request.app.state, "model_instance", None)
        models_healthy = bool(model_instance and getattr(model_instance, "is_trained", False))
        # indicate if a background model load is in progress
        model_loading = bool(getattr(request.app.state, "model_load_in_progress", False))
        model_error = getattr(request.app.state, "model_load_error_message", None)

        metrics_snapshot = cache.metrics_snapshot()
        latency_ms = (time.time() - start_time) * 1000

        status = "healthy" if all([db_healthy, cache_healthy, models_healthy]) else "degraded"

        return HealthResponse(
            status=status,
            database=db_healthy,
            models=models_healthy,
            model_loading=model_loading,
            model_error=model_error,
            cache=cache_healthy,
            cache_metrics=CacheMetricsResponse(**metrics_snapshot),
            latency_ms=latency_ms,
        )

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        latency_ms = (time.time() - start_time) * 1000
        return HealthResponse(
            status="unhealthy",
            database=False,
            models=False,
            model_loading=False,
            model_error=None,
            cache=False,
            cache_metrics=None,
            latency_ms=latency_ms,
        )

@router.get("/matches/search", response_model=List[MatchSearchResponse])
async def search_matches(
    q: str = Query(..., description="Search query for teams or matches", min_length=2),
    league: Optional[str] = Query(None, description="Filter by league"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    db: Session = Depends(get_db),
):
    """Search for matches with filtering, pagination, and caching."""
    query = q.strip()
    if not query:
        raise _http_error(400, "Query must not be empty", "VALIDATION_ERROR")

    cache_key = f"matches:search:{query.lower()}:{league or '*'}:{limit}"
    cached_results = cache.get(cache_key)
    if cached_results is not None:
        return [MatchSearchResponse(**item) for item in cached_results]

    try:
        home_team = aliased(Team)
        away_team = aliased(Team)

        stmt = (
            db.query(Match, home_team, away_team)
            .join(home_team, Match.home_team_id == home_team.id)
            .join(away_team, Match.away_team_id == away_team.id)
        )

        like_pattern = f"%{query}%"
        stmt = stmt.filter(
            or_(
                func.lower(home_team.name).like(func.lower(like_pattern)),
                func.lower(away_team.name).like(func.lower(like_pattern)),
            )
        )

        if league:
            stmt = stmt.filter(func.lower(Match.league_id) == league.lower())

        stmt = stmt.order_by(Match.match_date.asc()).limit(limit)

        results = []
        for match, home, away in stmt.all():
            results.append(
                MatchSearchResponse(
                    id=str(match.id),
                    home_team=home.name,
                    away_team=away.name,
                    league=match.league_id,
                    match_date=match.match_date.isoformat() if match.match_date else None,
                    venue=match.venue or "",
                )
            )

        payload = [result.model_dump() for result in results]
        cache.set(cache_key, payload, ttl=300)
        return results

    except Exception:
        logger.exception("Match search failed", extra={"query": query, "league": league})
        # Graceful degrade: return an empty list on backend errors to keep UX responsive
        return []

@router.post("/insights", deprecated=True)
async def generate_insights(
    request: Request,
    body: InsightsRequest,
    db: Session = Depends(get_db),
):
    """Retired legacy endpoint; use the certified betting-intelligence API."""
    del request, body, db
    raise _http_error(
        410,
        "This legacy insights endpoint is disabled because it could not enforce "
        "the zero-fabrication contract. Use /api/v1/betting-intelligence/analyze.",
        "LEGACY_INSIGHTS_DISABLED",
    )


@router.get("/models/status")
async def model_status(league: Optional[str] = None):
    """Return model training metadata sourced from the models directory."""

    cache_key = f"model-status:{league or '*'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        metadata_file = settings.models_path / "models_metadata.json"
        if metadata_file.exists():
            with metadata_file.open("r", encoding="utf-8") as fh:
                metadata = json.load(fh)
        else:
            metadata = _fallback_model_metadata()

        if league:
            league_key = league.upper()
            league_meta = metadata.get("models", {}).get(league_key)
            if not league_meta:
                raise _http_error(404, f"No metadata available for league '{league}'", "MODEL_METADATA_NOT_FOUND")
            response = {"models_loaded": True, "league": league_key, **league_meta}
        else:
            response = {
                "models_loaded": bool(list(Path(settings.models_path).glob("*_ensemble.pkl"))),
                **metadata,
            }

        cache.set(cache_key, response, ttl=3600)
        return response

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Model status check failed", extra={"league": league})
        raise _http_error(500, "Failed to get model status", "MODEL_STATUS_ERROR") from exc


def _fallback_model_metadata() -> Dict[str, Any]:
    """Construct metadata summary when models_metadata.json is missing."""
    models = {}
    for model_file in Path(settings.models_path).glob("*_ensemble_metadata.json"):
        try:
            with model_file.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            league_key = model_file.stem.replace("_ensemble_metadata", "").upper()
            models[league_key] = data
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Failed to read metadata file %s: %s", model_file, exc)

    return {
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "models": models,
    }


@router.get("/metrics/cache", response_model=CacheMetricsResponse)
async def cache_metrics():
    """Expose cache metrics and current circuit breaker state."""

    metrics = cache.metrics_snapshot()
    return CacheMetricsResponse(**metrics)


@router.get("/metrics", include_in_schema=False)
async def system_metrics(request: Request):
    """System-wide metrics for monitoring."""
    from ..core.cache import cache

    try:
        # Database connection count (approximation)
        db_connections = 1  # Placeholder - implement actual count if available

        # Cache hit rate
        cache_hit_rate = getattr(cache, 'hit_rate', lambda: 0.85)()

        # Model version
        model = _load_model_from_app(request)
        model_version = getattr(model, 'version', '1.0.0') if model else 'unloaded'

        return {
            "db_connections": db_connections,
            "cache_hit_rate": cache_hit_rate,
            "model_version": model_version,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        return {
            "error": "Metrics unavailable",
            "timestamp": datetime.utcnow().isoformat()
        }


# Note: Modular routers are already included via api/__init__.py
# No need to duplicate them here in legacy_endpoints
