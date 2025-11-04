from backend.src.core.database import check_database_health

try:
    result = check_database_health(timeout=2)
    print(f"Database health: {result}")
except Exception as e:
    print(f"Error: {e}")
