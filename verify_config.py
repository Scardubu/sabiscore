
import os
import sys
# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.src.core.config import Settings

def test_config(env_val, desc):
    print(f"\n--- Testing {desc} ---")
    if env_val is not None:
        os.environ["ALLOWED_HOSTS"] = env_val
    else:
        if "ALLOWED_HOSTS" in os.environ:
            del os.environ["ALLOWED_HOSTS"]
    
    try:
        settings = Settings()
        print("Settings instantiated successfully.")
        print(f"allowed_hosts_raw: {settings.allowed_hosts_raw}")
        print(f"allowed_hosts (property): {settings.allowed_hosts}")
    except Exception as e:
        print(f"Failed to instantiate Settings: {e}")
        import traceback
        traceback.print_exc()

# Test 1: Simple string (Render style)
test_config("sabiscore.onrender.com", "Simple String")

# Test 2: CSV string
test_config("localhost,127.0.0.1,render.com", "CSV String")

# Test 3: JSON string
test_config('["host1", "host2"]', "JSON String")

# Test 4: Invalid JSON-like string
test_config("[invalid json", "Invalid JSON-like String")
