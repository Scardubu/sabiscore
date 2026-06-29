"""Regression guard: production scraper adapters must never synthesize evidence."""

from pathlib import Path

SCRAPER_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "scrapers"
FORBIDDEN_TOKENS = (
    "random.uniform(",
    "random.randint(",
    "_simulate_",
    "simulated_data",
    "generate_mock",
)


def test_legacy_scrapers_do_not_generate_synthetic_football_evidence() -> None:
    offenders: list[str] = []
    for path in sorted(SCRAPER_DIR.glob("*.py")):
        source = path.read_text(encoding="utf-8").lower()
        for token in FORBIDDEN_TOKENS:
            if token.lower() in source:
                offenders.append(f"{path.name}: {token}")
    assert not offenders, "Synthetic production scraper paths found:\n" + "\n".join(offenders)
