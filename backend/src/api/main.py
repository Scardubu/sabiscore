import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
import logging
from .middleware import setup_middleware
from . import api_router
from .endpoints.monitoring import router as monitoring_router_root
from .websocket import router as ws_router
from ..core.config import settings
from ..core.cache import cache
from ..core.model_fetcher import DEFAULT_LEAGUES, load_ensemble_per_league
from ..db.session import init_db, close_db
import os
from datetime import datetime, timezone

# Sentry integration for error tracking
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1,  # 10% of requests for performance monitoring
        profiles_sample_rate=0.1,  # 10% for profiling
        environment=settings.app_env,
        release=f"sabiscore@{os.getenv('APP_VERSION', '1.0.0')}",
        before_send=lambda event, hint: _filter_sentry_event(event, hint),
    )
    logging.info("Sentry error tracking initialized")

def _filter_sentry_event(event, hint):
    """Filter Sentry events to reduce noise and redact secrets."""
    sensitive = ("token", "secret", "api_key", "apikey", "authorization", "password", "key")

    def _redact(value):
        if isinstance(value, dict):
            return {
                k: ("[REDACTED]" if any(s in str(k).lower() for s in sensitive) else _redact(v))
                for k, v in value.items()
            }
        if isinstance(value, list):
            return [_redact(item) for item in value]
        if isinstance(value, str) and any(marker in value.lower() for marker in ("apikey=", "api_key=", "token=", "authorization")):
            return "[REDACTED]"
        return value

    # Skip 404 errors
    if event.get('exception'):
        for exception in event['exception']['values']:
            if '404' in str(exception.get('value', '')):
                return None
    return _redact(event)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global model instance
model_instance = None
# Simple flag to avoid concurrent background loads
model_load_in_progress = False

# Custom JSON encoder that handles various non-serializable types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, 'isoformat') and callable(getattr(obj, 'isoformat')):
            return obj.isoformat()
        if hasattr(obj, '__dict__'):
            return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
        if hasattr(obj, 'dict') and callable(getattr(obj, 'dict')):
            return obj.dict()
        if hasattr(obj, 'model_dump') and callable(getattr(obj, 'model_dump')):
            return obj.model_dump()
        return str(obj)  # Fallback to string representation

# Global model instance
model_instance = None
# Simple flag to avoid concurrent background loads
model_load_in_progress = False

# Lifespan context manager for modern FastAPI startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan handler for startup and shutdown events."""
    global model_instance, model_load_in_progress
    
    # === STARTUP ===
    logger.info("Starting SabiScore API...")
    
    # Initialize cache and model state
    app.state.cache = cache
    app.state.model_instance = None
    app.state.models = {}
    app.state.models_loaded = False
    app.state.model_version = None
    app.state.leagues_loaded = []
    app.state.model_load_error_message = None
    app.state.model_load_in_progress = True
    app.state.model_load_attempts = 0
    
    # Initialize async database
    try:
        await init_db()
        logger.info("Async database initialized")
    except Exception:
        logger.exception("Startup: failed to initialize async database")
    
    # Strict model initialization (blocking) - startup must fail if models are unavailable.
    try:
        _startup_load_models_strict(app)
    except Exception:
        logger.exception("Startup: strict model initialization failed")
        try:
            await close_db()
        except Exception:
            logger.exception("Startup rollback: failed to close async database")
        raise RuntimeError("Startup aborted: model initialization failed")
    
    # V4 / Phase 9 source registry — informational startup log
    try:
        from ..connectors.source_registry import registry_summary as _v4_registry_summary
        logger.info("V4 source registry: %s", _v4_registry_summary(settings))
    except Exception as _v4_exc:
        logger.debug("V4 source registry unavailable at startup: %s", _v4_exc)

    logger.info("SabiScore API startup complete")
    
    yield  # Server is running
    
    # === SHUTDOWN ===
    logger.info("Shutting down SabiScore API...")
    
    try:
        await close_db()
        logger.info("Async database closed")
    except Exception:
        logger.exception("Shutdown: failed to close async database")
    
    logger.info("SabiScore API shutdown complete")

def _resolve_active_leagues() -> tuple[str, ...]:
    raw = (os.environ.get("ACTIVE_LEAGUES") or "").strip()
    if not raw:
        return DEFAULT_LEAGUES

    leagues = tuple(
        part.strip().lower()
        for part in raw.split(",")
        if part.strip()
    )
    return leagues or DEFAULT_LEAGUES


def _prime_prediction_service_cache(models: dict) -> None:
    """Prime class-level prediction cache with eagerly loaded league models."""
    try:
        from ..services.prediction import PredictionService as MatchPredictionService

        now_ts = datetime.now(timezone.utc).timestamp()
        with MatchPredictionService._cache_lock:
            MatchPredictionService._ensemble_cache = dict(models)
            MatchPredictionService._metadata_cache = {
                league: (model.model_metadata or {}) for league, model in models.items()
            }
            MatchPredictionService._cache_access_times = {
                league: now_ts for league in models
            }
    except Exception as exc:
        logger.warning("Startup: could not prime prediction cache: %s", exc)


def _startup_load_models_strict(app: FastAPI) -> None:
    """Load one validated ensemble per league before serving requests."""
    global model_instance, model_load_in_progress

    app.state.model_load_in_progress = True
    app.state.model_load_attempts = int(getattr(app.state, "model_load_attempts", 0)) + 1
    model_load_in_progress = True

    model_base_url = (os.environ.get("MODEL_BASE_URL") or "").strip() or None
    fetch_token = (os.environ.get("MODEL_FETCH_TOKEN") or "").strip() or None
    model_version = (os.environ.get("ACTIVE_BASELINE_VERSION") or "v5_phase7").strip() or "v5_phase7"
    leagues = _resolve_active_leagues()

    local_dirs = [
        settings.phase7_models_path,
        settings.models_path,
        settings.models_path.parent / "backend" / "models",
    ]

    models = load_ensemble_per_league(
        model_base_url=model_base_url,
        version=model_version,
        local_model_dirs=local_dirs,
        leagues=leagues,
        fetch_token=fetch_token,
    )

    if not models:
        raise RuntimeError("No league models loaded during startup")

    app.state.models = dict(models)
    app.state.leagues_loaded = sorted(models.keys())
    app.state.model_version = model_version
    app.state.models_loaded = True
    app.state.model_load_error_message = None
    app.state.model_load_in_progress = False

    default_league = "epl" if "epl" in models else app.state.leagues_loaded[0]
    model_instance = models[default_league]
    app.state.model_instance = model_instance
    model_load_in_progress = False

    _prime_prediction_service_cache(models)
    logger.info(
        "Startup: strict model initialization complete (%s, leagues=%s)",
        model_version,
        ", ".join(app.state.leagues_loaded),
    )

# Create FastAPI app with custom JSON encoder and lifespan
app = FastAPI(
    title="SabiScore API",
    description="AI-Powered Football Betting Intelligence Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Apply custom JSON encoder to the app
app.json_encoder = CustomJSONEncoder


def load_model_if_needed(start_background: bool = True):
    """Deprecated lazy-loader shim.

    Models are now loaded eagerly at startup through strict readiness gates.
    """
    del start_background  # no-op
    instance = getattr(app.state, "model_instance", None)
    if instance is not None and getattr(instance, "is_trained", False):
        return instance

    logger.warning("load_model_if_needed called but strict startup model load is incomplete")
    return None

# Setup middleware
setup_middleware(app)

# Provide helper to access loaded model without creating circular imports
def get_loaded_model(default=None):
    models = getattr(app.state, "models", {}) or {}
    if "epl" in models and getattr(models["epl"], "is_trained", False):
        return models["epl"]

    instance = getattr(app.state, "model_instance", None)
    if instance is not None and getattr(instance, "is_trained", False):
        return instance
    if model_instance is not None and getattr(model_instance, "is_trained", False):
        return model_instance
    return default

# Include routers
app.include_router(api_router, prefix=getattr(settings, 'API_V1_STR', '/api/v1'), tags=["API"])
app.include_router(ws_router, tags=["WebSocket"])

# Include monitoring/health check routes at root level for container orchestration
# Use monitoring router which has /health, /health/live, /health/ready, /metrics
app.include_router(monitoring_router_root, tags=["monitoring"])


@app.get("/")
async def root():
    return {
        "message": "Welcome to SabiScore API",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
        "startup": "/startup",
    }
