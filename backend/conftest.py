import sys
from pathlib import Path

# Ensure `src` package is importable when running tests
BASE_DIR = Path(__file__).resolve().parent
SRC_PATH = BASE_DIR / "src"

if SRC_PATH.exists():
    sys.path.insert(0, str(SRC_PATH))
else:
    sys.path.insert(0, str(BASE_DIR / "src"))
