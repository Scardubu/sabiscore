"""Health check and readiness probe endpoints for orchestration and monitoring."""

import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cache_manager
from ...core.config import settings
from ...db.session import get_async_session

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """
    Basic liveness probe - returns OK if service is running.
    
    Used by container orchestrators (Kubernetes, Docker) to determine
    if the service should be restarted.
    """
    return {
        "status": "healthy",
        "service": "sabiscore-api",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.app_env,
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(
    response: Response,
    db: AsyncSession = Depends(get_async_session),
) -> Dict[str, Any]:
    """
    Comprehensive readiness probe - checks all critical dependencies.
    
    Returns 200 if ready to accept traffic, 503 if not ready.
    Checks:
    - Database connectivity
    - Redis cache availability
    - Model loading status (if applicable)
    
    Used by load balancers to route traffic only to healthy instances.
    """
    checks: Dict[str, Any] = {
        "database": {"status": "unknown", "latency_ms": None},
        "cache": {"status": "unknown", "latency_ms": None},
        "models": {"status": "unknown", "loaded": False},
    }
    
    all_healthy = True

    # Check database
    try:
        start = datetime.utcnow()
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        latency = (datetime.utcnow() - start).total_seconds() * 1000
        checks["database"] = {
            "status": "healthy",
            "latency_ms": round(latency, 2),
            "url": settings.database_url.split("@")[-1] if "@" in settings.database_url else "sqlite",
        }
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        checks["database"] = {"status": "unhealthy", "error": str(exc)}
        all_healthy = False

    # Check cache
    try:
        start = datetime.utcnow()
        test_key = "health:check"
        cache_manager.set(test_key, "ok", ttl=5)
        result = cache_manager.get(test_key)
        latency = (datetime.utcnow() - start).total_seconds() * 1000
        
        if result == "ok":
            checks["cache"] = {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "backend": "redis" if settings.redis_host else "memory",
            }
        else:
            checks["cache"] = {"status": "degraded", "message": "cache read/write mismatch"}
            
    except Exception as exc:
        logger.error("Cache health check failed: %s", exc)
        checks["cache"] = {"status": "unhealthy", "error": str(exc)}
        # Cache failure is non-critical - don't fail readiness
        checks["cache"]["status"] = "degraded"

    # Check model loading status from app state
    try:
        from fastapi import Request
        # Note: We can't access request context here easily without passing it through
        # For now, check if models directory exists and has artifacts
        models_path = settings.models_path
        if models_path.exists():
            model_files = list(models_path.glob("*_ensemble.pkl"))
            if model_files:
                checks["models"] = {
                    "status": "healthy",
                    "loaded": True,
                    "count": len(model_files),
                    "models": [f.stem for f in model_files],
                }
            else:
                checks["models"] = {
                    "status": "degraded",
                    "loaded": False,
                    "message": "No model artifacts found",
                }
        else:
            checks["models"] = {
                "status": "degraded",
                "loaded": False,
                "message": "Models directory missing",
            }
    except Exception as exc:
        logger.warning("Model check failed: %s", exc)
        checks["models"] = {"status": "unknown", "error": str(exc)}

    # Determine overall status (models degrade readiness when missing)
    models_status = checks.get("models", {}).get("status")
    if not all_healthy or models_status != "healthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        # expose why we're unhealthy for easier diagnostics
        reason = "models" if models_status != "healthy" else "dependencies"
        overall_status = f"unhealthy:{reason}"
    elif any(check.get("status") == "degraded" for check in checks.values()):
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
        "ready": all_healthy and models_status == "healthy",
    }


@router.get("/metrics")
async def metrics_endpoint() -> Dict[str, Any]:
    """
    Prometheus-compatible metrics endpoint.
    
    Returns key operational metrics:
    - Request counts
    - Error rates
    - Model performance
    - Cache hit rates
    """
    # TODO: Integrate with prometheus_client for proper metrics
    # For now, return basic stats
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": 0,  # TODO: Track actual uptime
        "predictions_total": 0,
        "predictions_errors_total": 0,
        "cache_hits_total": 0,
        "cache_misses_total": 0,
        "database_connections_active": 0,
    }


@router.get("/startup")
async def startup_status() -> Dict[str, Any]:
    """
    Startup probe - indicates if application has finished initializing.
    
    Returns info about initialization status including:
    - Model loading progress
    - Database migrations
    - Cache warmup
    """
    models_path = settings.models_path
    metadata_path = models_path / "models_metadata.json"
    
    initialization = {
        "models_loaded": metadata_path.exists(),
        "database_ready": True,  # Assumed if we got here
        "cache_ready": True,
    }
    
    if metadata_path.exists():
        try:
            import json
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            initialization["models_metadata"] = metadata
        except Exception as exc:
            logger.warning("Failed to read model metadata: %s", exc)
    
    all_ready = all(initialization.values())
    
    return {
        "status": "ready" if all_ready else "initializing",
        "timestamp": datetime.utcnow().isoformat(),
        "initialization": initialization,
    }
