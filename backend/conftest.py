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
    """Mock heavy ML libraries before they're imported to speed up tests."""
    # Mock sklearn components that take long to import
    mock_sklearn = MagicMock()
    sys.modules['sklearn'] = mock_sklearn
    sys.modules['sklearn.ensemble'] = MagicMock()
    sys.modules['sklearn.linear_model'] = MagicMock()
    sys.modules['sklearn.preprocessing'] = MagicMock()
    sys.modules['sklearn.model_selection'] = MagicMock()
    sys.modules['sklearn.metrics'] = MagicMock()
    sys.modules['sklearn.calibration'] = MagicMock()
    
    # Mock other heavy imports
    sys.modules['xgboost'] = MagicMock()
    sys.modules['lightgbm'] = MagicMock()
    sys.modules['catboost'] = MagicMock()
    sys.modules['h2o'] = MagicMock()
    
    yield
    
    # Cleanup after tests
    for module in ['sklearn', 'sklearn.ensemble', 'sklearn.linear_model', 
                   'sklearn.preprocessing', 'sklearn.model_selection', 'sklearn.metrics',
                   'sklearn.calibration', 'xgboost', 'lightgbm', 'catboost', 'h2o']:
        sys.modules.pop(module, None)
