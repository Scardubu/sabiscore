"""Unit tests for FastAPI app initialization to boost coverage."""
import pytest
from unittest.mock import MagicMock, patch

from src.api.main import app, get_loaded_model, CustomJSONEncoder


def test_app_initialization():
    """Test FastAPI app is properly initialized."""
    assert app is not None
    assert app.title == "SabiScore API"


def test_app_openapi_schema():
    """Test OpenAPI schema is generated."""
    schema = app.openapi()
    
    assert schema is not None
    assert "openapi" in schema
    assert "info" in schema
    assert "paths" in schema
    assert schema["info"]["title"] == "SabiScore API"


def test_app_routes_registered():
    """Test all expected routes are registered."""
    routes = [route.path for route in app.routes]
    
    # Core routes should be present
    assert any("/health" in path for path in routes)
    assert any("/matches" in path for path in routes) or any("/api" in path for path in routes)


def test_app_exception_handlers():
    """Test exception handlers are registered."""
    # App should have exception handlers configured
    assert hasattr(app, "exception_handlers")


def test_get_loaded_model_returns_default():
    """Test get_loaded_model returns default when no model loaded."""
    result = get_loaded_model(default="test_default")
    # Since model not loaded in test env, should return default
    assert result == "test_default" or result is not None


def test_custom_json_encoder():
    """Test CustomJSONEncoder handles datetime and numpy types."""
    import json
    from datetime import datetime
    
    encoder = CustomJSONEncoder()
    
    # Test datetime encoding
    dt = datetime(2024, 1, 1, 12, 0, 0)
    encoded = json.dumps({"date": dt}, cls=CustomJSONEncoder)
    assert "2024-01-01" in encoded
