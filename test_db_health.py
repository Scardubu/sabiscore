from backend.src.core.database import check_database_health

try:
    result = check_database_health()
    print(f"Database health: {result}")
except Exception as e:
    print(f"Error: {e}")
