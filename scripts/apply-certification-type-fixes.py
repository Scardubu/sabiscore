"""Centralize synchronous database URL normalization for Psycopg 3."""

from pathlib import Path

helper = Path("backend/src/core/database_url.py")
if helper.exists():
    raise RuntimeError("database URL helper already exists")
helper.write_text('''"""Database URL normalization shared by runtime and Alembic."""\n\nfrom __future__ import annotations\n\n\ndef get_sync_database_url(url: str) -> str:\n    """Return a synchronous SQLAlchemy URL using installed production drivers."""\n    if "+aiosqlite" in url:\n        return url.replace("+aiosqlite", "", 1)\n    if "+asyncpg" in url:\n        return url.replace("+asyncpg", "+psycopg", 1)\n    if url.startswith("postgresql://"):\n        return url.replace("postgresql://", "postgresql+psycopg://", 1)\n    if url.startswith("postgres://"):\n        return url.replace("postgres://", "postgresql+psycopg://", 1)\n    return url\n''')

runtime = Path("backend/src/core/database.py")
text = runtime.read_text()
old_import = "from .config import settings\n"
new_import = "from .config import settings\nfrom .database_url import get_sync_database_url\n"
if text.count(old_import) != 1:
    raise RuntimeError("runtime database import contract changed")
text = text.replace(old_import, new_import, 1)
old_helper = '''def _get_sync_database_url(url: str) -> str:\n    """\n    Convert async database URL to sync URL for synchronous engine.\n    Handles aiosqlite -> sqlite, asyncpg -> psycopg, etc.\n    """\n    if "+aiosqlite" in url:\n        return url.replace("+aiosqlite", "")\n    if "+asyncpg" in url:\n        return url.replace("+asyncpg", "+psycopg")\n    return url\n\n\n'''
if text.count(old_helper) != 1:
    raise RuntimeError("runtime database URL helper contract changed")
text = text.replace(old_helper, "", 1)
if text.count("_sync_url = _get_sync_database_url(settings.database_url)") != 1:
    raise RuntimeError("runtime database URL assignment changed")
text = text.replace(
    "_sync_url = _get_sync_database_url(settings.database_url)",
    "_sync_url = get_sync_database_url(settings.database_url)",
    1,
)
runtime.write_text(text)

alembic = Path("backend/alembic/env.py")
text = alembic.read_text()
old_import = "from src.core.database import Base\n"
new_import = "from src.core.database import Base\nfrom src.core.database_url import get_sync_database_url\n"
if text.count(old_import) != 1:
    raise RuntimeError("Alembic database import contract changed")
text = text.replace(old_import, new_import, 1)
old_helper = '''def _sync_database_url(url: str) -> str:\n    if "+aiosqlite" in url:\n        return url.replace("+aiosqlite", "")\n    if "+asyncpg" in url:\n        return url.replace("+asyncpg", "+psycopg")\n    return url\n\n\n'''
if text.count(old_helper) != 1:
    raise RuntimeError("Alembic URL helper contract changed")
text = text.replace(old_helper, "", 1)
if text.count("_sync_database_url(settings.database_url)") != 2:
    raise RuntimeError("Alembic URL call count changed")
text = text.replace(
    "_sync_database_url(settings.database_url)",
    "get_sync_database_url(settings.database_url)",
)
alembic.write_text(text)

tests = Path("backend/tests/test_database_migration_hardening.py")
text = tests.read_text()
addition = '''\n\ndef test_sync_database_url_uses_installed_psycopg3_driver():\n    from src.core.database_url import get_sync_database_url\n\n    assert get_sync_database_url("postgresql://user:pass@db/app") == (\n        "postgresql+psycopg://user:pass@db/app"\n    )\n    assert get_sync_database_url("postgres://user:pass@db/app") == (\n        "postgresql+psycopg://user:pass@db/app"\n    )\n    assert get_sync_database_url("postgresql+asyncpg://user:pass@db/app") == (\n        "postgresql+psycopg://user:pass@db/app"\n    )\n    assert get_sync_database_url("postgresql+psycopg://user:pass@db/app") == (\n        "postgresql+psycopg://user:pass@db/app"\n    )\n    assert get_sync_database_url("sqlite+aiosqlite:///local.db") == "sqlite:///local.db"\n'''
if "test_sync_database_url_uses_installed_psycopg3_driver" in text:
    raise RuntimeError("database URL regression test already exists")
tests.write_text(text.rstrip() + addition + "\n")

Path(__file__).unlink()
