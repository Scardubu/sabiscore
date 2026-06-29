"""Create the explicit production-runtime MyPy manifest."""

from pathlib import Path

files = [
    "src/api/main.py",
    "src/api/endpoints/fixtures.py",
    "src/api/endpoints/core_engine.py",
    "src/api/endpoints/betting_intelligence.py",
    "src/core/exceptions.py",
    "src/core/league_config.py",
    "src/providers/base.py",
    "src/providers/registry.py",
    "src/providers/orchestrator.py",
    "src/providers/api_football.py",
    "src/providers/espn",
    "src/providers/football_data_org.py",
    "src/providers/sportmonks.py",
    "src/providers/the_odds_api.py",
    "src/providers/reconciliation.py",
    "src/schemas/core_engine.py",
    "src/schemas/betting_intelligence.py",
    "src/services/core_engine.py",
    "src/services/betting_intelligence.py",
]
lines = [
    "[mypy]",
    "python_version = 3.11",
    "ignore_missing_imports = True",
    "follow_imports = skip",
    "show_error_codes = True",
    "no_implicit_optional = True",
    "strict_equality = True",
    "files =",
    *[f"    {item}," for item in files[:-1]],
    f"    {files[-1]}",
]
target = Path("backend/mypy-production.ini")
if target.exists():
    raise RuntimeError("production MyPy manifest already exists")
target.write_text("\n".join(lines) + "\n")
Path(__file__).unlink()
