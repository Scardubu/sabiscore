import sys
from pathlib import Path
import pytest
from unittest.mock import MagicMock, patch
import os

# Set test environment variables before any imports
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379"

# Ensure `src` package is importable when running tests
BASE_DIR = Path(__file__).resolve().parent
SRC_PATH = BASE_DIR / "src"

if SRC_PATH.exists():
    sys.path.insert(0, str(SRC_PATH))
else:
    sys.path.insert(0, str(BASE_DIR / "src"))


@pytest.fixture(scope="session", autouse=True)
def mock_heavy_imports():
    """Mock optional heavy ML libraries only when they are missing.

    The original implementation replaced real packages (sklearn, lightgbm, etc.)
    with MagicMocks even when they were installed, which caused AutoGluon to emit
    MagicMock values that could not be pickled during SOTA ensemble tests. The
    updated shim now inspects each module first and only injects a MagicMock when
    the real dependency is *not* available on the current machine.
    """

    mocked_modules = []
    heavy_modules = [
        "sklearn",
        "sklearn.ensemble",
        "sklearn.linear_model",
        "sklearn.preprocessing",
        "sklearn.model_selection",
        "sklearn.metrics",
        "sklearn.calibration",
        "xgboost",
        "lightgbm",
        "catboost",
        "h2o",
    ]

    for module_name in heavy_modules:
        if module_name in sys.modules:
            continue
        try:
            __import__(module_name)
        except ImportError:
            sys.modules[module_name] = MagicMock(name=f"mock_{module_name}")
            mocked_modules.append(module_name)

    yield

    for module_name in mocked_modules:
        sys.modules.pop(module_name, None)
