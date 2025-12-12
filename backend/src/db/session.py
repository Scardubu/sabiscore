"""Async and sync database session management for the SabiScore backend."""

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ..core.config import settings
from ..core.database import Base, SessionLocal as SyncSessionLocal, is_using_fallback

logger = logging.getLogger(__name__)

# Re-export synchronous SessionLocal for Celery/background workers expecting it
SessionLocal = SyncSessionLocal

# Global async engine and session factory
async_engine: Optional[AsyncEngine] = None
AsyncSessionLocal: Optional[async_sessionmaker[AsyncSession]] = None

# SQLite fallback URL for async operations
SQLITE_FALLBACK_URL = "sqlite+aiosqlite:///./sabiscore_fallback.db"


def _get_async_database_url(raw_url: str) -> str:
    """Convert database URL to async-compatible format."""
    if raw_url.startswith("postgresql+asyncpg://"):
        return raw_url
    elif raw_url.startswith("postgres://"):
        return raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw_url.startswith("sqlite+aiosqlite://"):
        return raw_url
    elif raw_url.startswith("sqlite:///"):
        return raw_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    elif raw_url.startswith("sqlite://"):
        return raw_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return raw_url


async def _try_create_async_engine(database_url: str, engine_kwargs: Dict[str, Any]) -> AsyncEngine:
    """Create async engine and test connection."""
    eng = create_async_engine(database_url, **engine_kwargs)
    # Test the connection
    async with eng.begin() as conn:
        await conn.execute(text("SELECT 1"))
    return eng


async def init_db() -> None:
    """
    Initialize database engine and create tables.
    Called during application startup.
    Uses SQLite fallback if PostgreSQL is unavailable (matching sync engine behavior).
    """
    global async_engine, AsyncSessionLocal

    # Check if sync engine is already using fallback
    using_fallback = is_using_fallback()
    
    if using_fallback:
        # Sync engine already fell back to SQLite, use same for async
        logger.info("Sync engine using SQLite fallback, initializing async engine with SQLite")
        database_url = SQLITE_FALLBACK_URL
    else:
        database_url = _get_async_database_url(settings.database_url)

    use_null_pool = settings.app_env == "test" or database_url.startswith("sqlite")

    engine_kwargs: Dict[str, Any] = {
        "echo": settings.debug,
    }

    if use_null_pool or database_url.startswith("sqlite"):
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs.update(
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
            pool_timeout=settings.database_pool_timeout,
            pool_recycle=settings.database_pool_recycle,
        )

    try:
        async_engine = await _try_create_async_engine(database_url, engine_kwargs)
        logger.info(f"Async database engine created successfully ({'SQLite' if 'sqlite' in database_url else 'PostgreSQL'})")
    except Exception as e:
        if not database_url.startswith("sqlite"):
            # PostgreSQL failed, try SQLite fallback
            logger.warning(f"PostgreSQL async connection failed ({e}), falling back to SQLite")
            engine_kwargs["poolclass"] = NullPool
            engine_kwargs.pop("pool_pre_ping", None)
            engine_kwargs.pop("pool_size", None)
            engine_kwargs.pop("max_overflow", None)
            engine_kwargs.pop("pool_timeout", None)
            engine_kwargs.pop("pool_recycle", None)
            
            try:
                async_engine = await _try_create_async_engine(SQLITE_FALLBACK_URL, engine_kwargs)
                database_url = SQLITE_FALLBACK_URL
                logger.info("Async SQLite fallback database initialized")
            except Exception as fallback_error:
                logger.error(f"Both PostgreSQL and SQLite async fallback failed: {fallback_error}")
                raise
        else:
            logger.error(f"Failed to initialize SQLite async database: {e}", exc_info=True)
            raise

    # Create session factory
    AsyncSessionLocal = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    # Create tables
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}", exc_info=True)
        raise


async def close_db() -> None:
    """
    Close database connections and cleanup.
    Called during application shutdown.
    """
    global async_engine, AsyncSessionLocal

    if async_engine:
        try:
            await async_engine.dispose()
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error closing database: {e}", exc_info=True)
        finally:
            async_engine = None
            AsyncSessionLocal = None


async def check_db_connection() -> bool:
    """
    Verify database connection is working.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        async with get_db_session() as session:
            result = await session.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False


async def get_db_stats() -> Dict[str, Any]:
    """
    Get database connection pool statistics.
    
    Returns:
        Dictionary with pool statistics
    """
    if not async_engine:
        return {"status": "not_initialized"}

    pool = getattr(async_engine, "pool", None)
    if not pool or not hasattr(pool, "size"):
        return {"status": "unavailable"}

    stats = {
        "size": getattr(pool, "size", lambda: None)(),
        "checked_in": getattr(pool, "checkedin", lambda: None)(),
        "checked_out": getattr(pool, "checkedout", lambda: None)(),
        "overflow": getattr(pool, "overflow", lambda: None)(),
    }
    if stats["size"] is not None and stats["overflow"] is not None:
        stats["total"] = stats["size"] + stats["overflow"]
    return stats


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session with automatic cleanup.
    
    Usage:
        async with get_db_session() as session:
            result = await session.execute(...)
    
    Yields:
        AsyncSession: Database session
    """
    if AsyncSessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI endpoints to get database session.
    
    Usage:
        @app.get("/")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            result = await db.execute(...)
    
    Yields:
        AsyncSession: Database session
    """
    async with get_db_session() as session:
        yield session


# FastAPI dependency alias used across routers
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_db_session() as session:
        yield session
