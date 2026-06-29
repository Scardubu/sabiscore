"""Add the production MyPy contract to deterministic release verification."""

from pathlib import Path

path = Path("Makefile")
text = path.read_text()
replacements = [
    (
        '''\t@echo "  1/6 Backend safety, provider, engine, and scraper regressions"\n''',
        '''\t@echo "  1/7 Production runtime type contract"\n\t@cd backend && mypy --config-file mypy-production.ini\n\t@echo "  2/7 Backend safety, provider, engine, and scraper regressions"\n''',
    ),
    ("  2/6 OpenAPI contract", "  3/7 OpenAPI contract"),
    (
        "  3/6 Provider CLI (offline/configuration mode)",
        "  4/7 Provider CLI (offline/configuration mode)",
    ),
    ("  4/6 Scraper parser tests", "  5/7 Scraper parser tests"),
    (
        "  5/6 Scraper source and manifest validation",
        "  6/7 Scraper source and manifest validation",
    ),
    ("  6/6 Python compilation", "  7/7 Python compilation"),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise RuntimeError(f"Makefile verification contract no longer matches: {old!r}")
    text = text.replace(old, new, 1)
path.write_text(text)
Path(__file__).unlink()
