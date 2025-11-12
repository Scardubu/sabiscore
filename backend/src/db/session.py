"""
Database session management for SabiScore backend.
Handles database connection pooling, initialization, and lifecycle management.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from .config import settings

logger = logging.getLogger(__name__)

# Create declarative base for models
Base = declarative_base()

# Global engine and session maker
engine: Optional[object] = None
AsyncSessionLocal: Optional[async_sessionmaker] = None


async def init_db() -> None:
    """
    Initialize database engine and create tables.
    Called during application startup.
    """
    global engine, AsyncSessionLocal
    
    try:
        # Create async engine
        database_url = settings.DATABASE_URL
        
        # Convert postgres:// to postgresql+asyncpg://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        engine = create_async_engine(
            database_url,
            echo=settings.DEBUG,
            poolclass=NullPool if settings.ENV == "test" else None,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        
        # Create session factory
        AsyncSessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
        
        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        raise


async def close_db() -> None:
    """
    Close database connections and cleanup.
    Called during application shutdown.
    """
    global engine
    
    if engine:
        try:
            await engine.dispose()
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error closing database: {e}", exc_info=True)


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


async def get_db_stats() -> Dict[str, any]:
    """
    Get database connection pool statistics.
    
    Returns:
        Dictionary with pool statistics
    """
    if not engine:
        return {"status": "not_initialized"}
    
    pool = engine.pool
    return {
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "total": pool.size() + pool.overflow(),
    }


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
