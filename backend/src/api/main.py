import json
from fastapi import FastAPI
import logging
from .middleware import setup_middleware
from . import api_router
from .websocket import router as ws_router
from ..core.config import settings
from ..core.database import engine, Base
from ..core.cache import cache
from ..models.ensemble import SabiScoreEnsemble
from ..core.model_fetcher import fetch_models_if_needed
import threading
import time as _time
import asyncio
import os
from datetime import datetime

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
    """Filter Sentry events to reduce noise"""
    # Skip 404 errors
    if event.get('exception'):
        for exception in event['exception']['values']:
            if '404' in str(exception.get('value', '')):
                return None
    return event

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global model instance
model_instance = None
# Simple flag to avoid concurrent background loads
model_load_in_progress = False

# Initialize database tables on import
try:
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
except Exception as e:
    logger.error(f"Database initialization error: {e}")

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

# Create FastAPI app with custom JSON encoder
app = FastAPI(
    title="SabiScore API",
    description="AI-Powered Football Betting Intelligence Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Apply custom JSON encoder to the app
app.json_encoder = CustomJSONEncoder

# Initialize cache and model state
app.state.cache = cache
app.state.model_instance = None
app.state.model_load_error_message = None

# Proactively trigger a background model load at startup (non-blocking)
def _startup_trigger_model_load():
    try:
        # Attempt to fetch models from MODEL_BASE_URL if needed (production/deploy flows)
        try:
            base = os.environ.get('MODEL_BASE_URL') or None
            token = os.environ.get('MODEL_FETCH_TOKEN') or None
            # dest_root is repo root (parent of backend)
            repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            if base:
                fetched = fetch_models_if_needed(base, repo_root, token)
                if fetched:
                    logger.info('Startup: model artifacts fetched/verified')
                else:
                    logger.warning('Startup: model artifact fetch failed or incomplete')
        except Exception:
            logger.exception('Startup: model fetch attempt failed')

        # Do not block startup - start background loader
        # Prefer asyncio background task so FastAPI/uvicorn lifecycles manage it
        # and the process won't exit if the thread daemon state changes.
        loop = None
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop is not None:
            # schedule async wrapper
            loop.create_task(_load_model_background_async())
        else:
            # fallback to existing threaded loader (kept for legacy/runtime cases)
            load_model_if_needed(start_background=True)
    except Exception:
        logger.exception("Startup: failed to trigger background model load")

app.add_event_handler("startup", _startup_trigger_model_load)
# Load models on first request
def _load_model_background():
    """Background loader for ML models. Sets global model_instance when done."""
    global model_instance, model_load_in_progress
    try:
        # reflect loading state on app.state for health checks
        try:
            app.state.model_load_in_progress = True
        except Exception:
            pass
        logger.info("Background: starting ML model load")
        # clear any previous error
        try:
            app.state.model_load_error_message = None
            app.state.model_load_attempts = 0
        except Exception:
            pass

        # Try loading with retries/backoff to handle temporary corruption or fetch latency.
        max_retries = 5
        delay_seconds = 5
        loaded = None

        for attempt in range(1, max_retries + 1):
            try:
                app.state.model_load_attempts = attempt
                logger.info(f"Model load attempt {attempt}/{max_retries}")
                loaded = SabiScoreEnsemble.load_latest_model(settings.models_path)
                if loaded is not None:
                    model_instance = loaded
                    app.state.model_instance = loaded
                    # clear error if successful
                    try:
                        app.state.model_load_error_message = None
                    except Exception:
                        pass
                    logger.info("Background: ML models loaded successfully")
                    break
            except Exception as e:
                # record the latest error and decide whether to retry
                logger.warning(f"Model load attempt {attempt} failed: {e}")
                try:
                    app.state.model_load_error_message = str(e)
                except Exception:
                    pass
                # If the error indicates that there are no valid model files (common in dev), stop retrying
                msg = str(e)
                if "No valid model files found" in msg or "No model files found" in msg:
                    logger.error("No valid model artifacts found on disk; aborting model load retries.")
                    # leave model_instance as None and expose error
                    break

                if attempt < max_retries:
                    sleep_time = delay_seconds * (2 ** (attempt - 1))
                    logger.info(f"Retrying model load in {sleep_time}s")
                    try:
                        _time.sleep(sleep_time)
                    except Exception:
                        pass
                    continue
                else:
                    logger.error(f"Model load failed after {max_retries} attempts")
                    # leave model_instance as None and expose error
                    break
    except Exception as e:
        logger.exception(f"Background: Failed to load ML models: {e}")
        model_instance = None
        try:
            app.state.model_instance = None
        except Exception:
            pass
        # expose the failure message for health checks and monitoring
        try:
            app.state.model_load_error_message = str(e)
        except Exception:
            pass
    finally:
        model_load_in_progress = False
        try:
            app.state.model_load_in_progress = False
        except Exception:
            pass


async def _load_model_background_async():
    """Async wrapper for the background loader so it can be scheduled in the event loop.

    This reuses the same logic as the threaded loader but uses asyncio.sleep for backoff
    to avoid blocking the event loop.
    """
    global model_instance, model_load_in_progress
    try:
        try:
            app.state.model_load_in_progress = True
        except Exception:
            pass

        logger.info("Async background: starting ML model load")
        app.state.model_load_error_message = None
        app.state.model_load_attempts = 0

        max_retries = 5
        delay_seconds = 5

        for attempt in range(1, max_retries + 1):
            try:
                app.state.model_load_attempts = attempt
                logger.info(f"Async model load attempt {attempt}/{max_retries}")
                loaded = SabiScoreEnsemble.load_latest_model(settings.models_path)
                if loaded is not None:
                    model_instance = loaded
                    app.state.model_instance = loaded
                    app.state.model_load_error_message = None
                    logger.info("Async background: ML models loaded successfully")
                    break
            except Exception as e:
                logger.warning(f"Async model load attempt {attempt} failed: {e}")
                try:
                    app.state.model_load_error_message = str(e)
                except Exception:
                    pass
                msg = str(e)
                if "No valid model files found" in msg or "No model files found" in msg:
                    logger.error("No valid model artifacts found on disk; aborting async model load retries.")
                    break

                if attempt < max_retries:
                    sleep_time = delay_seconds * (2 ** (attempt - 1))
                    logger.info(f"Async retrying model load in {sleep_time}s")
                    try:
                        await asyncio.sleep(sleep_time)
                    except Exception:
                        pass
                    continue
                else:
                    logger.error(f"Async model load failed after {max_retries} attempts")
                    break
    except Exception as e:
        logger.exception(f"Async background: Failed to load ML models: {e}")
        model_instance = None
        try:
            app.state.model_instance = None
        except Exception:
            pass
        try:
            app.state.model_load_error_message = str(e)
        except Exception:
            pass
    finally:
        model_load_in_progress = False
        try:
            app.state.model_load_in_progress = False
        except Exception:
            pass


def load_model_if_needed(start_background: bool = True):
    """Lazy load model on first request.

    Behavior:
    - If model is already loaded, return it.
    - If not loaded and a background load is not running, optionally start a background loader
      and return None immediately (the caller should then handle a missing model gracefully).
    - This keeps first-request TTFB small while still triggering model population.
    """
    global model_instance, model_load_in_progress

    if model_instance is not None:
        return model_instance

    # If another thread is already loading, return None immediately
    if model_load_in_progress:
        logger.debug("Model load already in progress, returning None")
        return None

    # Start background loader unless caller explicitly asked to block
    if start_background:
        try:
            model_load_in_progress = True
            try:
                app.state.model_load_in_progress = True
                # clear old error while starting a fresh load attempt
                app.state.model_load_error_message = None
            except Exception:
                pass
            t = threading.Thread(target=_load_model_background, name="sabiscore-model-loader", daemon=True)
            t.start()
            logger.info("Triggered background ML model load")
        except Exception as e:
            model_load_in_progress = False
            try:
                app.state.model_load_in_progress = False
            except Exception:
                pass
            logger.exception(f"Failed to start background model loader: {e}")
        return None

    # Blocking load (not used by default) - fall back to old behavior
    try:
        logger.info("Loading ML models (blocking)...")
        model_instance = SabiScoreEnsemble.load_latest_model(settings.models_path)
        app.state.model_instance = model_instance
        logger.info("ML models loaded successfully (blocking)")
    except Exception as e:
        logger.exception(f"Failed to load ML models: {e}")
        model_instance = None
        app.state.model_instance = None
    return model_instance

# Setup middleware
setup_middleware(app)

# Provide helper to access loaded model without creating circular imports
def get_loaded_model(default=None):
    instance = getattr(app.state, "model_instance", None)
    if instance is not None and getattr(instance, "is_trained", False):
        return instance
    if model_instance is not None and getattr(model_instance, "is_trained", False):
        return model_instance
    return default

# Include routers
app.include_router(api_router, prefix=getattr(settings, 'API_V1_STR', '/api/v1'), tags=["API"])
app.include_router(ws_router, tags=["WebSocket"])

# Include health check routes at root level for container orchestration
from .endpoints.health import router as health_router
app.include_router(health_router)


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
