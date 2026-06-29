"""Database URL normalization shared by runtime and Alembic."""

from __future__ import annotations


def get_sync_database_url(url: str) -> str:
    """Return a synchronous SQLAlchemy URL using installed production drivers."""
    if "+aiosqlite" in url:
        return url.replace("+aiosqlite", "", 1)
    if "+asyncpg" in url:
        return url.replace("+asyncpg", "+psycopg", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url
