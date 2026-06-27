import sys
import os
from pathlib import Path

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./sabiscore_test.db")
os.environ.setdefault("ALLOW_SQLITE_FALLBACK", "true")

# Ensure `src` package is importable when running tests
BASE_DIR = Path(__file__).resolve().parent
SRC_PATH = BASE_DIR / "src"

if SRC_PATH.exists():
    sys.path.insert(0, str(SRC_PATH))
else:
    sys.path.insert(0, str(BASE_DIR / "src"))
