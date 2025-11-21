"""
Enhanced health check endpoint with comprehensive system status.
"""
import json
import logging
import psutil
from fastapi import APIRouter, Response
from datetime import datetime
from typing import Dict, Any
import time
from sqlalchemy import text

from ...core.cache import cache
from ...core.database import engine
from ...core.config import settings
from ...db.session import check_db_connection

logger = logging.getLogger(__name__)
router = APIRouter(tags=["monitoring"])

# Track startup time for uptime calculation
_startup_time = time.time()


@router.get("/health")
def health_check() -> Dict[str, Any]:
    """
    Comprehensive health check endpoint for monitoring and load balancers.
    
    Returns:
        200: All systems operational
        503: Degraded state (some dependencies unavailable)
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "uptime_seconds": int(time.time() - _startup_time),
        "components": {}
    }
    
    degraded = False
    
    # Check database connectivity
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health_status["components"]["database"] = {
            "status": "healthy",
            "message": "Connected"
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "message": str(e)
        }
        degraded = True
    
    # Check cache connectivity
    try:
        cache_healthy = cache.ping()
        cache_metrics = cache.metrics_snapshot()
        health_status["components"]["cache"] = {
            "status": "healthy" if cache_healthy else "degraded",
            "message": "Connected" if cache_healthy else "Using fallback",
            "metrics": cache_metrics
        }
        if not cache_healthy:
            degraded = True
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        health_status["components"]["cache"] = {
            "status": "unhealthy",
            "message": str(e)
        }
        degraded = True
    
    # Check model availability
    try:
        from ...models.ensemble import SabiScoreEnsemble
        model_path = settings.models_path / "premier_league_ensemble.pkl"
        model_available = model_path.exists()
        
        health_status["components"]["ml_models"] = {
            "status": "healthy" if model_available else "degraded",
            "message": "Models loaded" if model_available else "Models not found",
            "models_path": str(settings.models_path)
        }
        if not model_available:
            degraded = True
    except Exception as e:
        logger.error(f"Model health check failed: {e}")
        health_status["components"]["ml_models"] = {
            "status": "unhealthy",
            "message": str(e)
        }
        degraded = True
    
    # System resource checks
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        memory_warning = memory.percent > 85
        disk_warning = disk.percent > 85
        
        health_status["components"]["resources"] = {
            "status": "healthy" if not (memory_warning or disk_warning) else "degraded",
            "memory_percent": memory.percent,
            "memory_available_mb": memory.available // (1024 * 1024),
            "disk_percent": disk.percent,
            "disk_free_gb": disk.free // (1024 * 1024 * 1024),
        }
        
        if memory_warning or disk_warning:
            degraded = True
    except Exception as e:
        logger.warning(f"Resource check failed: {e}")
        # Don't fail health check for resource monitoring issues
    
    # Set overall status
    if degraded:
        health_status["status"] = "degraded"

    # Provide backwards-compatible top-level keys expected by legacy
    # callers/tests so they don't have to drill into components.
    components = health_status.get("components", {})
    for legacy_key, component_key in (
        ("database", "database"),
        ("cache", "cache"),
        ("models", "ml_models"),
    ):
        if component_key in components:
            health_status[legacy_key] = components[component_key]
    
    return health_status


@router.get("/health/live")
def liveness_check(response: Response) -> Dict[str, str]:
    """
    Liveness probe for Kubernetes/container orchestration.
    Simple check that the service is running.
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/ready")
def readiness_check(response: Response) -> Dict[str, Any]:
    """
    Readiness probe for Kubernetes/container orchestration.
    Checks if service is ready to accept traffic.
    """
    ready = True
    checks = {}
    
    # Check database
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = {"status": "ready", "message": "Connected"}
    except Exception as e:
        logger.error(f"Database not ready: {e}")
        checks["database"] = {"status": "not_ready", "message": str(e)}
        ready = False
    
    # Check cache (degraded is acceptable)
    try:
        cache_healthy = cache.ping()
        checks["cache"] = {
            "status": "ready" if cache_healthy else "degraded",
            "message": "Connected" if cache_healthy else "Using in-memory fallback"
        }
    except Exception as e:
        logger.warning(f"Cache check failed: {e}")
        checks["cache"] = {"status": "degraded", "message": "Using in-memory fallback"}
    
    # Check models (critical for predictions)
    try:
        import os
        model_files = []
        models_dir = settings.models_path
        if models_dir.exists():
            model_files = [f for f in os.listdir(models_dir) if f.endswith('.pkl')]
        
        if model_files:
            checks["models"] = {
                "status": "healthy",
                "message": f"Found {len(model_files)} model(s)",
                "trained": True
            }
        else:
            checks["models"] = {
                "status": "not_ready",
                "message": "No trained models found",
                "trained": False
            }
            # Don't mark as not ready if SKIP_S3=true (development mode)
            skip_s3 = os.getenv('SKIP_S3', 'false').lower() in ('true', '1', 'yes')
            if not skip_s3:
                ready = False
    except Exception as e:
        logger.error(f"Model check failed: {e}")
        checks["models"] = {"status": "error", "message": str(e), "trained": False}
        ready = False
    
    # Provide an explicit top-level models boolean and optional model_error
    models_status = checks.get("models", {})
    models_loaded_flag = bool(models_status.get("trained", False))
    model_error_message = None
    if models_status.get("status") in ("not_ready", "error"):
        model_error_message = models_status.get("message")

    payload = {
        "status": "ready" if ready else "not_ready",
        "checks": checks,
        "models": models_loaded_flag,
        "model_error": model_error_message,
        "timestamp": datetime.utcnow().isoformat()
    }

    if not ready:
        response.status_code = 503

    return payload


@router.get("/ready")
def readiness_check_shortcut(response: Response) -> Dict[str, Any]:
    """Legacy alias for /health/ready used by older probes."""
    return readiness_check(response)


@router.get("/readiness")
def readiness_check_alias(response: Response) -> Dict[str, Any]:
    """Additional alias to preserve backwards compatibility."""
    return readiness_check(response)


@router.get("/metrics")
def metrics() -> Dict[str, Any]:
    """
    Prometheus-compatible metrics endpoint.
    Returns key application metrics for monitoring.
    """
    try:
        # Cache metrics
        cache_metrics = cache.metrics_snapshot()
        
        # System metrics
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # Application metrics
        uptime = int(time.time() - _startup_time)
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": uptime,
            "cache": cache_metrics,
            "system": {
                "memory_percent": memory.percent,
                "memory_used_mb": memory.used // (1024 * 1024),
                "memory_available_mb": memory.available // (1024 * 1024),
                "cpu_percent": cpu_percent,
            }
        }
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        return {
            "error": "Failed to collect metrics",
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/internal/smoke")
async def smoke_check() -> Dict[str, Any]:
    """
    Lightweight smoke endpoint for deployment automation.
    Reports database connectivity, models loaded flag, and app version.
    """
    db_ok = False
    try:
        db_ok = await check_db_connection()
    except Exception as e:
        logger.warning(f"Smoke DB check failed: {e}")

    # Models: prefer app.state if available
    try:
        models_flag = False
        model_instance = getattr(__import__('...api.main', fromlist=['app']).app.state, 'model_instance', None)
        if model_instance is not None and getattr(model_instance, 'is_trained', False):
            models_flag = True
        else:
            # fallback: check for .pkl files in models directory
            import os
            models_dir = settings.models_path
            if models_dir and models_dir.exists():
                pkl_files = [f for f in os.listdir(models_dir) if f.endswith('.pkl')]
                models_flag = len(pkl_files) > 0
    except Exception:
        models_flag = False

    return {
        "db_connected": db_ok,
        "models_loaded": models_flag,
        "version": os.getenv('APP_VERSION', '1.0.0'),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/startup")
def startup_status() -> Dict[str, Any]:
    """Report model metadata and initialization progress for orchestration hooks."""
    models_path = settings.models_path
    metadata_path = models_path / "models_metadata.json"

    initialization = {
        "models_loaded": metadata_path.exists(),
        "database_ready": True,
        "cache_ready": True,
    }

    if metadata_path.exists():
        try:
            with metadata_path.open("r", encoding="utf-8") as fh:
                initialization["models_metadata"] = json.load(fh)
        except Exception as exc:
            logger.warning("Failed to read model metadata: %s", exc)

    all_ready = all(value for key, value in initialization.items() if isinstance(value, bool))

    return {
        "status": "ready" if all_ready else "initializing",
        "timestamp": datetime.utcnow().isoformat(),
        "initialization": initialization,
    }
