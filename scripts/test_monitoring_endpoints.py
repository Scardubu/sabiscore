#!/usr/bin/env python3
"""
Quick validation of monitoring endpoints structure and responses.
Run: python scripts/test_monitoring_endpoints.py
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_health_basic():
    """Test basic health endpoint returns 200 and expected structure"""
    response = client.get("/api/v1/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "status" in data, "Missing 'status' field"
    assert "timestamp" in data, "Missing 'timestamp' field"
    assert "components" in data, "Missing 'components' field"
    assert data["status"] in ["healthy", "degraded"], f"Unexpected status: {data['status']}"
    
    # Check legacy compatibility fields
    assert "database" in data, "Missing legacy 'database' field"
    assert "cache" in data, "Missing legacy 'cache' field"
    assert "models" in data, "Missing legacy 'models' field"
    
    print(f"✅ /health endpoint OK - status: {data['status']}")
    return data


def test_readiness_check():
    """Test readiness endpoint returns expected structure"""
    response = client.get("/api/v1/health/ready")
    # Can be 200 or 503 depending on model availability
    assert response.status_code in [200, 503], f"Unexpected status code: {response.status_code}"
    
    data = response.json()
    assert "status" in data, "Missing 'status' field"
    assert "checks" in data, "Missing 'checks' field"
    assert "models" in data, "Missing 'models' field (boolean)"
    assert "timestamp" in data, "Missing 'timestamp' field"
    assert data["status"] in ["ready", "not_ready"], f"Unexpected status: {data['status']}"
    
    # Validate checks structure
    checks = data["checks"]
    assert "database" in checks, "Missing database check"
    assert "cache" in checks, "Missing cache check"
    assert "models" in checks, "Missing models check"
    
    print(f"✅ /health/ready endpoint OK - status: {data['status']}, models: {data['models']}")
    return data


def test_readiness_aliases():
    """Test that readiness aliases work"""
    endpoints = ["/api/v1/ready", "/api/v1/readiness"]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code in [200, 503], f"{endpoint}: unexpected status {response.status_code}"
        data = response.json()
        assert "status" in data, f"{endpoint}: missing status field"
        print(f"✅ {endpoint} alias OK")


def test_startup_endpoint():
    """Test startup endpoint structure"""
    response = client.get("/api/v1/startup")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "status" in data, "Missing 'status' field"
    assert "timestamp" in data, "Missing 'timestamp' field"
    
    print(f"✅ /startup endpoint OK - status: {data['status']}")
    return data


def test_metrics_endpoint():
    """Test metrics endpoint returns Prometheus format"""
    response = client.get("/api/v1/metrics")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "uptime_seconds" in data, "Missing uptime metric"
    
    print(f"✅ /metrics endpoint OK - uptime: {data.get('uptime_seconds')}s")
    return data


def main():
    print("=" * 60)
    print("Testing SabiScore Monitoring Endpoints")
    print("=" * 60)
    
    try:
        test_health_basic()
        test_readiness_check()
        test_readiness_aliases()
        test_startup_endpoint()
        test_metrics_endpoint()
        
        print("\n" + "=" * 60)
        print("✅ All monitoring endpoint tests passed!")
        print("=" * 60)
        return 0
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
