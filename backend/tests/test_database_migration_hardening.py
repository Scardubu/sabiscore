from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"

SCAN_ROOTS = [
    BACKEND / "src",
    BACKEND / "scripts",
    BACKEND / "alembic",
]
SCAN_FILES = [
    ROOT / ".env.example",
    ROOT / ".env.production.example",
    BACKEND / ".env.example",
]
FORBIDDEN_SCHEMA_PATTERNS = [
    "Base.metadata." + "create_all",
    "Base.metadata." + "drop_all",
    "AUTO_CREATE" + "_TABLES",
]
TEXT_SUFFIXES = {".py", ".sh", ".ini", ".env", ".example", ".toml", ".yml", ".yaml"}


def _tracked_hardening_files():
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
                yield path
    for path in SCAN_FILES:
        if path.exists():
            yield path


def test_no_runtime_script_or_alembic_file_contains_direct_schema_creation():
    for path in _tracked_hardening_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in FORBIDDEN_SCHEMA_PATTERNS:
            assert pattern not in text, f"Retired schema-management path found in {path.relative_to(ROOT)}"


def test_baseline_migration_is_explicit_and_orm_free():
    migration = BACKEND / "alembic" / "versions" / "0001_baseline_schema.py"
    text = migration.read_text(encoding="utf-8")

    assert "from src.core.database import Base" not in text
    assert "import Base" not in text
    assert "Base.metadata" not in text
    assert "op.create_table(" in text
    assert "op.create_index(" in text
    assert "op.drop_index(" in text
    assert "op.drop_table(" in text


def test_sqlite_fallback_requires_explicit_opt_in_outside_tests(monkeypatch):
    from src.core.config import Settings

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./local.db")
    monkeypatch.setenv("ALLOW_SQLITE_FALLBACK", "false")

    settings = Settings()

    assert settings.app_env == "development"
    assert settings.database_url.startswith("sqlite")
    assert settings.allow_sqlite_fallback is False

def test_sync_database_url_uses_installed_psycopg3_driver():
    from src.core.database_url import get_sync_database_url

    assert get_sync_database_url("postgresql://user:pass@db/app") == (
        "postgresql+psycopg://user:pass@db/app"
    )
    assert get_sync_database_url("postgres://user:pass@db/app") == (
        "postgresql+psycopg://user:pass@db/app"
    )
    assert get_sync_database_url("postgresql+asyncpg://user:pass@db/app") == (
        "postgresql+psycopg://user:pass@db/app"
    )
    assert get_sync_database_url("postgresql+psycopg://user:pass@db/app") == (
        "postgresql+psycopg://user:pass@db/app"
    )
    assert get_sync_database_url("sqlite+aiosqlite:///local.db") == "sqlite:///local.db"

