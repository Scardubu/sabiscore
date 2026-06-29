"""Type the canonical provider registry without changing runtime behavior."""

from pathlib import Path

path = Path("backend/src/providers/registry.py")
text = path.read_text()
replacements = [
    ("from typing import Iterable\n", "from typing import Iterable, List\n"),
    (
        "from .base import ProviderCapability, ProviderHealth, ProviderQuota\n",
        "from .base import BaseProvider, ProviderCapability, ProviderHealth, ProviderQuota\n",
    ),
    (
        '''class ProviderRegistry:\n    def __init__(self, providers: Iterable[object]) -> None:\n        self.providers = list(providers)\n\n    def list(self) -> list[object]:\n        return list(self.providers)\n\n    def get(self, provider_id: str):\n''',
        '''class ProviderRegistry:\n    def __init__(self, providers: Iterable[BaseProvider]) -> None:\n        self.providers: List[BaseProvider] = list(providers)\n\n    def list(self) -> List[BaseProvider]:\n        return list(self.providers)\n\n    def get(self, provider_id: str) -> BaseProvider:\n''',
    ),
    (
        "    async def health(self) -> list[ProviderHealth]:\n",
        "    async def health(self) -> List[ProviderHealth]:\n",
    ),
    (
        "    async def capabilities(self) -> list[ProviderCapability]:\n",
        "    async def capabilities(self) -> List[ProviderCapability]:\n",
    ),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise RuntimeError(f"provider registry contract no longer matches: {old!r}")
    text = text.replace(old, new, 1)
path.write_text(text)
Path(__file__).unlink()
