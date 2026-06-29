"""Add concrete provider types to the evidence orchestrator."""

from pathlib import Path

path = Path("backend/src/providers/orchestrator.py")
text = path.read_text()
changes = [
    (
        "from typing import Any, Callable, Coroutine\n",
        "from typing import Any, Callable, Coroutine, cast\n",
    ),
    (
        "from .base import ProviderResult, ProviderStatus, TrustTier\n",
        "from .api_football import APIFootballProvider\n"
        "from .base import ProviderResult, ProviderStatus, TrustTier\n"
        "from .espn import ESPNProvider\n"
        "from .football_data_org import FootballDataOrgProvider\n"
        "from .sportmonks import SportmonksProvider\n"
        "from .the_odds_api import TheOddsAPIProvider\n",
    ),
    (
        'self.registry.get("espn")',
        'cast(ESPNProvider, self.registry.get("espn"))',
    ),
    (
        'self.registry.get("football_data_org")',
        'cast(FootballDataOrgProvider, self.registry.get("football_data_org"))',
    ),
    (
        'self.registry.get("api_football")',
        'cast(APIFootballProvider, self.registry.get("api_football"))',
    ),
    (
        'self.registry.get("sportmonks")',
        'cast(SportmonksProvider, self.registry.get("sportmonks"))',
    ),
    (
        'self.registry.get("the_odds_api")',
        'cast(TheOddsAPIProvider, self.registry.get("the_odds_api"))',
    ),
    ("apif: Any,", "apif: APIFootballProvider,"),
]
for old, new in changes:
    if old not in text:
        raise RuntimeError(f"orchestrator contract no longer matches: {old}")
    text = text.replace(old, new)
path.write_text(text)
Path(__file__).unlink()
