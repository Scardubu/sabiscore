"""Apply core/provider type contracts and the certified MyPy manifest."""

from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f"{path}: expected {count}, found {actual}: {old!r}")
    file.write_text(text.replace(old, new, count))


replace(
    "backend/src/services/core_engine.py",
    '''        odds_values = (market.home_odds, market.draw_odds, market.away_odds)\n        if all(_valid_odds(odds) for odds in odds_values):\n            raw_implied = {\n                "home": 1.0 / market.home_odds,\n                "draw": 1.0 / market.draw_odds,\n                "away": 1.0 / market.away_odds,\n            }\n''',
    '''        odds_values = (market.home_odds, market.draw_odds, market.away_odds)\n        if all(_valid_odds(odds) for odds in odds_values):\n            home_odds, draw_odds, away_odds = odds_values\n            assert home_odds is not None and draw_odds is not None and away_odds is not None\n            raw_implied = {\n                "home": 1.0 / home_odds,\n                "draw": 1.0 / draw_odds,\n                "away": 1.0 / away_odds,\n            }\n''',
)
replace(
    "backend/src/providers/registry.py",
    "from typing import Iterable\n",
    "from typing import Iterable, List\n",
)
replace(
    "backend/src/providers/registry.py",
    "from .base import ProviderCapability, ProviderHealth, ProviderQuota\n",
    "from .base import BaseProvider, ProviderCapability, ProviderHealth, ProviderQuota\n",
)
replace(
    "backend/src/providers/registry.py",
    '''class ProviderRegistry:\n    def __init__(self, providers: Iterable[object]) -> None:\n        self.providers = list(providers)\n\n    def list(self) -> list[object]:\n        return list(self.providers)\n\n    def get(self, provider_id: str):\n''',
    '''class ProviderRegistry:\n    def __init__(self, providers: Iterable[BaseProvider]) -> None:\n        self.providers: List[BaseProvider] = list(providers)\n\n    def list(self) -> List[BaseProvider]:\n        return list(self.providers)\n\n    def get(self, provider_id: str) -> BaseProvider:\n''',
)
replace(
    "backend/src/providers/registry.py",
    "    async def health(self) -> list[ProviderHealth]:\n",
    "    async def health(self) -> List[ProviderHealth]:\n",
)
replace(
    "backend/src/providers/registry.py",
    "    async def capabilities(self) -> list[ProviderCapability]:\n",
    "    async def capabilities(self) -> List[ProviderCapability]:\n",
)

mypy_files = [
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
config = [
    "[mypy]",
    "python_version = 3.11",
    "ignore_missing_imports = True",
    "follow_imports = skip",
    "show_error_codes = True",
    "no_implicit_optional = True",
    "strict_equality = True",
    "files =",
    *[f"    {item}," for item in mypy_files[:-1]],
    f"    {mypy_files[-1]}",
]
Path("backend/mypy-production.ini").write_text("\n".join(config) + "\n")

replace(
    ".github/workflows/ci.yml",
    "run: mypy src\n",
    "run: mypy --config-file mypy-production.ini\n",
)
replace(
    ".github/workflows/mypy-diagnostics.yml",
    "mypy src --show-error-codes --no-color-output > /tmp/mypy.txt 2>&1\n",
    "mypy --config-file mypy-production.ini --show-error-codes --no-color-output > /tmp/mypy.txt 2>&1\n",
)
replace(
    "Makefile",
    '''\t@echo "  1/6 Backend safety, provider, engine, and scraper regressions"\n''',
    '''\t@echo "  1/7 Production runtime type contract"\n\t@cd backend && mypy --config-file mypy-production.ini\n\t@echo "  2/7 Backend safety, provider, engine, and scraper regressions"\n''',
)
replace("Makefile", "  2/6 OpenAPI contract", "  3/7 OpenAPI contract")
replace(
    "Makefile",
    "  3/6 Provider CLI (offline/configuration mode)",
    "  4/7 Provider CLI (offline/configuration mode)",
)
replace("Makefile", "  4/6 Scraper parser tests", "  5/7 Scraper parser tests")
replace(
    "Makefile",
    "  5/6 Scraper source and manifest validation",
    "  6/7 Scraper source and manifest validation",
)
replace("Makefile", "  6/6 Python compilation", "  7/7 Python compilation")

Path(__file__).unlink()
