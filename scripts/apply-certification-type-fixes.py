"""Wire canonical CI to the production-runtime MyPy manifest."""

from pathlib import Path

path = Path(".github/workflows/ci.yml")
text = path.read_text()
old = "run: mypy src\n"
new = "run: mypy --config-file mypy-production.ini\n"
if text.count(old) != 1:
    raise RuntimeError("canonical CI MyPy command no longer matches")
path.write_text(text.replace(old, new, 1))
Path(__file__).unlink()
