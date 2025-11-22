import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(str(Path("backend").resolve()))

from src.core.config import settings

def verify_odds_key():
    print(f"Checking Odds API Key configuration...")
    key = settings.odds_api_key
    if key:
        print(f"SUCCESS: Odds API Key found: {key[:4]}...{key[-4:]}")
        if key == "000974fa1984eddc45c57d6217cb43bb":
             print("SUCCESS: Key matches the provided key.")
        else:
             print("WARNING: Key does not match the provided key.")
    else:
        print("FAILURE: Odds API Key is None.")

if __name__ == "__main__":
    verify_odds_key()
