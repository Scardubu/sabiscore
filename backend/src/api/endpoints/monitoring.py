"""
Enhanced health check endpoint with comprehensive system status.
"""
import logging
import os
import psutil
from fastapi import APIRouter, Response, Request
from datetime import datetime, timezone
from typing import Dict, Any
import time
from sqlalchemy import text
from pathlib import Path

from ...core.cache import cache
from ...core.database import engine, get_db_status
from ...core.config import settings
from ...core.model_fetcher import DEFAULT_LEAGUES
from ...db.session import check_db_connection

try:
    from ...connectors.source_registry import registry_summary as _v4_registry_summary
    _V4_REGISTRY_AVAILABLE = True
except ImportError:
    _v4_registry_summary = None  # type: ignore[assignment]
    _V4_REGISTRY_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter(tags=["monitoring"])

# Track startup time for uptime calculation
_startup_time = time.time()


def _resolve_required_leagues() -> list[str]:
    raw = (os.environ.get("ACTIVE_LEAGUES") or "").strip()
    if not raw:
        return list(DEFAULT_LEAGUES)

    leagues = [part.strip().lower() for part in raw.split(",") if part.strip()]
    return leagues or list(DEFAULT_LEAGUES)


def _discover_model_artifacts() -> Dict[str, Any]:
    candidates: list[Path] = [settings.models_path, settings.phase7_models_path]
    explicit_model_path = getattr(settings, "model_path", None)
    if explicit_model_path:
        candidates.append(Path(explicit_model_path))

    files: list[str] = []
    for base in candidates:
        try:
            if base.is_file() and base.suffix in {".pkl", ".joblib"} and base.stat().st_size >= 10_240:
                files.append(str(base))
            elif base.exists() and base.is_dir():
                for pattern in ("*.pkl", "*.joblib"):
                    for path in base.glob(pattern):
                        try:
                            if path.stat().st_size >= 10_240:
                                files.append(str(path))
                        except Exception:
                            continue
        except Exception:
            continue

    return {
        "count": len(files),
        "files": sorted(set(files))[:20],
    }


@router.get("/health")
def health_check() -> Dict[str, Any]:
    """
    Comprehensive health check endpoint for monitoring and load balancers.
    
    Returns:
        200: All systems operational
        503: Degraded state (some dependencies unavailable)
    """
    db_status = get_db_status()
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
            "status": "healthy" if not db_status["using_fallback"] else "degraded",
            "message": "Connected" if not db_status["using_fallback"] else "Using SQLite fallback",
            "type": db_status["url_type"]
        }
        if db_status["using_fallback"]:
            degraded = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "message": str(e),
            "type": db_status["url_type"]
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
        discovered = _discover_model_artifacts()
        if discovered["count"] > 0:
            health_status["components"]["ml_models"] = {
                "status": "healthy",
                "message": f"Model artifacts available ({discovered['count']})",
                "models_path": str(settings.models_path),
                "phase7_models_path": str(settings.phase7_models_path),
                "available_artifacts": discovered["files"],
            }
        else:
            health_status["components"]["ml_models"] = {
                "status": "degraded",
                "message": "No model artifacts found",
                "models_path": str(settings.models_path),
                "phase7_models_path": str(settings.phase7_models_path),
                "available_artifacts": [],
            }
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

    # V4 / Phase 9 source registry — informational only, never sets degraded=True
    if _V4_REGISTRY_AVAILABLE and _v4_registry_summary is not None:
        try:
            summary = _v4_registry_summary(settings)
            health_status["components"]["v4_sources"] = {
                "status": "informational",
                **summary,
            }
        except Exception as _v4_exc:
            logger.debug("V4 source registry summary failed: %s", _v4_exc)

    # Set overall status
    if degraded:
        health_status["status"] = "degraded"
    
    return health_status


@router.get("/health/live")
def liveness_check(response: Response) -> Dict[str, str]:
    """
    Liveness probe for Kubernetes/container orchestration.
    Simple check that the service is running.
    """
    return {
        "status": "alive",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/ready")
def readiness_check(request: Request, response: Response) -> Dict[str, Any]:
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
        app_state = request.app.state
        required_leagues = _resolve_required_leagues()
        loaded_models = getattr(app_state, "models", {}) or {}
        models_loaded = bool(getattr(app_state, "models_loaded", False))
        leagues_loaded = sorted(set(getattr(app_state, "leagues_loaded", []) or list(loaded_models.keys())))
        model_version = getattr(app_state, "model_version", None)
        load_error = getattr(app_state, "model_load_error_message", None)
        load_in_progress = bool(getattr(app_state, "model_load_in_progress", False))
        missing_required = [league for league in required_leagues if league not in loaded_models]
        untrained = [
            league
            for league, model in loaded_models.items()
            if not getattr(model, "is_trained", False)
        ]

        if load_error:
            checks["models"] = {
                "status": "not_ready",
                "message": load_error,
                "models_loaded": False,
                "model_version": model_version,
                "required_leagues": required_leagues,
                "leagues_loaded": leagues_loaded,
                "load_in_progress": load_in_progress,
            }
            ready = False
        elif not models_loaded:
            checks["models"] = {
                "status": "not_ready",
                "message": "Strict startup model load has not completed",
                "models_loaded": False,
                "model_version": model_version,
                "required_leagues": required_leagues,
                "leagues_loaded": leagues_loaded,
                "load_in_progress": load_in_progress,
            }
            ready = False
        elif missing_required:
            checks["models"] = {
                "status": "not_ready",
                "message": f"Missing required league models: {', '.join(missing_required)}",
                "models_loaded": False,
                "model_version": model_version,
                "required_leagues": required_leagues,
                "leagues_loaded": leagues_loaded,
                "missing_required": missing_required,
                "load_in_progress": load_in_progress,
            }
            ready = False
        elif untrained:
            checks["models"] = {
                "status": "not_ready",
                "message": f"Untrained models loaded: {', '.join(untrained)}",
                "models_loaded": False,
                "model_version": model_version,
                "required_leagues": required_leagues,
                "leagues_loaded": leagues_loaded,
                "untrained_leagues": untrained,
                "load_in_progress": load_in_progress,
            }
            ready = False
        else:
            checks["models"] = {
                "status": "ready",
                "message": "Strict per-league models loaded",
                "models_loaded": True,
                "model_version": model_version,
                "required_leagues": required_leagues,
                "leagues_loaded": leagues_loaded,
                "load_in_progress": load_in_progress,
            }
    except Exception as e:
        logger.error(f"Model check failed: {e}")
        checks["models"] = {"status": "error", "message": str(e), "models_loaded": False}
        ready = False
    
    # Provide an explicit top-level models boolean and optional model_error
    models_status = checks.get("models", {})
    models_loaded_flag = bool(models_status.get("models_loaded", False))
    model_error_message = None
    if models_status.get("status") in ("not_ready", "error"):
        model_error_message = models_status.get("message")

    payload = {
        "status": "ok" if ready else "not_ready",
        "checks": checks,
        "models": models_status.get("model_version") if models_loaded_flag else None,
        "models_loaded": models_loaded_flag,
        "leagues_loaded": models_status.get("leagues_loaded", []),
        "required_leagues": models_status.get("required_leagues", []),
        "model_error": model_error_message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if not ready:
        response.status_code = 503

    return payload


# Alias /ready at root level for convenience (matches health.py contract)
@router.get("/ready")
def ready_alias(request: Request, response: Response) -> Dict[str, Any]:
    """Alias for /health/ready for backward compatibility."""
    return readiness_check(request, response)


@router.get("/metrics")
def metrics() -> Dict[str, Any]:
    """
    Prometheus-compatible metrics endpoint.
    Returns key application metrics for monitoring.
    """
    try:
        # Import metrics collector
        from ...monitoring.metrics import metrics_collector
        
        # Cache metrics
        cache_metrics = cache.metrics_snapshot()
        
        # System metrics
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # Application metrics
        uptime = int(time.time() - _startup_time)
        
        # Production metrics from collector
        production_metrics = metrics_collector.get_summary()
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": uptime,
            "cache": cache_metrics,
            "system": {
                "memory_percent": memory.percent,
                "memory_used_mb": memory.used // (1024 * 1024),
                "memory_available_mb": memory.available // (1024 * 1024),
                "cpu_percent": cpu_percent,
            },
            "production": production_metrics
        }
    except Exception as e:
        logger.error(f"Metrics collection failed: {e}")
        return {
            "error": "Failed to collect metrics",
            "timestamp": datetime.now(timezone.utc).isoformat()
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
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
