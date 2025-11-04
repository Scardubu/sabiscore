"""Shared pytest fixtures for API tests."""
import pytest
from unittest.mock import MagicMock

from src.core.cache import RedisCache


@pytest.fixture
def mock_redis():
    """Mock Redis cache with circuit breaker disabled."""
    mock = MagicMock(spec=RedisCache)
    mock.metrics_snapshot.return_value = {
        "hits": 0,
        "misses": 0,
        "errors": 0,
        "circuit_open": False,
        "backend_available": True
    }
    return mock
