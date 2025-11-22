"""Async and sync database session management for the SabiScore backend."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ..core.config import settings
from ..core.database import Base, SessionLocal as SyncSessionLocal

logger = logging.getLogger(__name__)

# Re-export synchronous SessionLocal for Celery/background workers expecting it
SessionLocal = SyncSessionLocal

# Global async engine and session factory
async_engine: Optional[AsyncEngine] = None
AsyncSessionLocal: Optional[async_sessionmaker[AsyncSession]] = None
_init_lock: Optional[asyncio.Lock] = None


async def init_db() -> None:
    """
    Initialize database engine and create tables.
    Called during application startup.
    """
    global async_engine, AsyncSessionLocal

    try:
        # Create async engine
        raw_url = settings.database_url

        if raw_url.startswith("postgresql+asyncpg://"):
            database_url = raw_url
        elif raw_url.startswith("postgres://"):
            database_url = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif raw_url.startswith("postgresql://"):
            database_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif raw_url.startswith("sqlite+aiosqlite://"):
            database_url = raw_url
        elif raw_url.startswith("sqlite:///"):
            database_url = raw_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        elif raw_url.startswith("sqlite://"):
            database_url = raw_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        else:
            database_url = raw_url

        use_null_pool = settings.app_env == "test" or database_url.startswith("sqlite")

        engine_kwargs: Dict[str, Any] = {
            "echo": settings.debug,
            "pool_pre_ping": True,
        }

        if use_null_pool:
            engine_kwargs["poolclass"] = NullPool
        else:
            engine_kwargs.update(
                pool_size=settings.database_pool_size,
                max_overflow=settings.database_max_overflow,
                pool_timeout=settings.database_pool_timeout,
                pool_recycle=settings.database_pool_recycle,
            )

        async_engine = create_async_engine(database_url, **engine_kwargs)

        # Create session factory
        AsyncSessionLocal = async_sessionmaker(
            async_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        
        # Create tables
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        raise


async def _ensure_async_session() -> None:
    """Lazily initialize the async session factory on first use."""

    global _init_lock

    if AsyncSessionLocal is not None:
        return

    if _init_lock is None:
        _init_lock = asyncio.Lock()

    async with _init_lock:
        if AsyncSessionLocal is None:
            await init_db()


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
        await _ensure_async_session()

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
