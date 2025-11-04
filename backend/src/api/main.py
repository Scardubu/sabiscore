import json
from fastapi import FastAPI
import logging
from .middleware import setup_middleware
from .endpoints import router
from .websocket import router as ws_router
from ..core.config import settings
from ..core.database import engine, Base
from ..core.cache import cache
from ..models.ensemble import SabiScoreEnsemble
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

# Load models on first request
def load_model_if_needed():
    """Lazy load model on first request"""
    global model_instance
    if model_instance is None:
        try:
            logger.info("Loading ML models...")
            model_instance = SabiScoreEnsemble.load_latest_model(settings.models_path)
            app.state.model_instance = model_instance
            logger.info("ML models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load ML models: {e}")
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
app.include_router(router, prefix="/api/v1", tags=["API"])
app.include_router(ws_router, tags=["WebSocket"])


@app.get("/")
async def root():
    return {
        "message": "Welcome to SabiScore API",
        "docs": "/docs",
        "health": "/api/v1/health"
    }
