# backend/src/main.py

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.routing import APIRoute
from contextlib import asynccontextmanager
import time
import logging

from .api import api_router
from .core.config import settings
try:
    from .core.logging import configure_logging
except Exception:  # Fallback if import fails in certain deploy environments
    import logging as _py_logging

    def configure_logging(level: str | None = None, format_string: str | None = None) -> None:  # type: ignore
        lvl = (level or "INFO").upper()
        fmt = (
            format_string
            or "%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s"
        )
        _py_logging.basicConfig(level=getattr(_py_logging, lvl, _py_logging.INFO), format=fmt)
from .core.middleware import (
    LoggingMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    CompressionMiddleware,
)
from .db.session import (
    init_db,
    close_db,
    check_db_connection,
    get_db_stats,
)

# Configure logging before app initialization
configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager for startup and shutdown events.
    Handles database initialization, connection verification, and cleanup.
    """
    # Startup: Initialize database
    logger.info("=" * 60)
    logger.info("Starting application startup sequence...")
    logger.info("=" * 60)
    
    try:
        # Initialize database tables
        await init_db()
        logger.info("✓ Database tables initialized")
        
        # Verify database connection
        if await check_db_connection():
            logger.info("✓ Database connection verified")
            
            # Log connection pool stats in development
            if settings.ENV == "development":
                stats = await get_db_stats()
                logger.info(f"Database pool stats: {stats}")
        else:
            logger.warning("⚠ Database connection check failed")
            
    except Exception as e:
        logger.error(f"✗ Error during startup: {e}", exc_info=True)
        raise
    
    logger.info("=" * 60)
    logger.info("✓ Application startup completed successfully")
    logger.info("=" * 60)
    
    yield
    
    # Shutdown: Close database connections
    logger.info("=" * 60)
    logger.info("Starting application shutdown sequence...")
    logger.info("=" * 60)
    
    try:
        await close_db()
        logger.info("✓ Database connections closed successfully")
    except Exception as e:
        logger.error(f"✗ Error during shutdown: {e}", exc_info=True)
    
    logger.info("=" * 60)
    logger.info("✓ Application shutdown completed")
    logger.info("=" * 60)


def custom_generate_unique_id(route: APIRoute) -> str:
    """
    Generate unique operation IDs for OpenAPI documentation.
    Uses tag and route name for better organization.
    """
    if route.tags:
        return f"{route.tags[0]}-{route.name}"
    return route.name


# Initialize FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV == "development" else None,
    lifespan=lifespan,
    generate_unique_id_function=custom_generate_unique_id,
    description="Football Prediction API with advanced analytics and odds comparison",
    contact={
        "name": "API Support",
        "email": "support@example.com",
    },
    openapi_tags=[
        {"name": "Root", "description": "Root and system endpoints"},
        {"name": "Health", "description": "Health check and monitoring endpoints"},
        {"name": "Auth", "description": "Authentication and authorization"},
        {"name": "Matches", "description": "Match data and operations"},
        {"name": "Predictions", "description": "Prediction operations"},
        {"name": "Odds", "description": "Odds comparison and operations"},
        {"name": "Users", "description": "User management"},
    ],
)


# Configure CORS middleware (must be first)
# Use the unified accessor from settings which normalises CSV/JSON env values
try:
    cors_origins = settings.cors_origins
except Exception:
    cors_origins = getattr(settings, 'cors_allowed_origins', [])

if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip('/') for origin in cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time", "X-Request-ID", "X-API-Version"],
    )
    logger.info(f"CORS enabled for origins: {cors_origins}")
else:
    logger.warning("No CORS origins configured; requests from browsers may be blocked")


# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)
logger.info("Security headers middleware enabled")

# Add compression middleware for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)
logger.info("GZip compression middleware enabled (minimum_size=1000)")

# Add compression tracking middleware
app.add_middleware(CompressionMiddleware)

# Add rate limiting middleware (optional - configure in settings)
if getattr(settings, 'ENABLE_RATE_LIMITING', False):
    rate_limit = getattr(settings, 'RATE_LIMIT_PER_MINUTE', 60)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=rate_limit)
    logger.info(f"Rate limiting enabled: {rate_limit} requests/minute")
else:
    logger.info("Rate limiting disabled")

# Add logging middleware
app.add_middleware(LoggingMiddleware)
logger.info("Request logging middleware enabled")


# Add request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """
    Middleware to track request processing time.
    Adds X-Process-Time header to all responses.
    """
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response


# Include API routes
app.include_router(api_router, prefix=settings.API_V1_STR)
logger.info(f"API routes registered with prefix: {settings.API_V1_STR}")


# Root endpoint
@app.get(
    "/",
    tags=["Root"],
    summary="API Root",
    description="Returns basic information about the API",
    response_description="Basic API information"
)
async def root():
    """Root endpoint with basic system information."""
    return {
        "message": "SabiScore API is running",
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENV,
        "docs": "/docs" if settings.ENV != "production" else None,
        "api_prefix": settings.API_V1_STR,
        "status": "operational",
    }


# Health check endpoint
@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
    description="Health check endpoint for load balancers and monitoring",
    response_description="Health status"
)
async def health_check():
    """
    Health check endpoint.
    Returns the status of the application and database connection.
    """
    # Check database connection
    db_healthy = await check_db_connection()
    
    return {
        "status": "healthy" if db_healthy else "degraded",
        "version": settings.VERSION,
        "environment": settings.ENV,
        "database": "connected" if db_healthy else "disconnected",
    }


# Readiness check endpoint
@app.get(
    "/health/ready",
    tags=["Health"],
    summary="Readiness Check",
    description="Readiness check for Kubernetes and orchestration systems",
    response_description="Readiness status"
)
async def readiness_check():
    """
    Readiness check endpoint.
    Indicates if the application is ready to receive traffic.
    Checks database connectivity.
    """
    # Check if database is ready
    db_ready = await check_db_connection()
    
    if not db_ready:
        return {
            "status": "not_ready",
            "version": settings.VERSION,
            "reason": "Database connection unavailable",
        }
    
    return {
        "status": "ready",
        "version": settings.VERSION,
        "environment": settings.ENV,
    }


# Liveness check endpoint
@app.get(
    "/health/live",
    tags=["Health"],
    summary="Liveness Check",
    description="Liveness check for Kubernetes and orchestration systems",
    response_description="Liveness status"
)
async def liveness_check():
    """
    Liveness check endpoint.
    Indicates if the application is running.
    Does not check dependencies.
    """
    return {
        "status": "alive",
        "version": settings.VERSION,
        "environment": settings.ENV,
    }


# Database stats endpoint (development/staging only)
@app.get(
    "/stats/database",
    tags=["Health"],
    summary="Database Statistics",
    description="Database connection pool statistics (development only)",
    include_in_schema=settings.ENV != "production"
)
async def database_stats():
    """
    Get database connection pool statistics.
    Only available in development and staging environments.
    """
    if settings.ENV == "production":
        return {"error": "Endpoint not available in production"}
    
    try:
        stats = await get_db_stats()
        return {
            "database_pool": stats,
            "environment": settings.ENV,
        }
    except Exception as e:
        logger.error(f"Error getting database stats: {e}")
        return {"error": "Failed to retrieve database statistics"}


# Application info endpoint
@app.get(
    "/info",
    tags=["Root"],
    summary="Application Information",
    description="Detailed application configuration and environment information",
    include_in_schema=settings.ENV != "production"
)
async def app_info():
    """
    Get detailed application information.
    Only available in development and staging environments.
    """
    if settings.ENV == "production":
        return {"error": "Endpoint not available in production"}
    
    return {
        "application": {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENV,
        },
        "api": {
            "prefix": settings.API_V1_STR,
            "docs": "/docs",
            "redoc": "/redoc" if settings.ENV == "development" else None,
        },
        "features": {
            "rate_limiting": getattr(settings, 'ENABLE_RATE_LIMITING', False),
            "cors_enabled": bool(cors_origins),
        },
    }


if __name__ == "__main__":
    import uvicorn
    
    # Run with uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENV == "development",
        log_level="info",
        access_log=True,
    )