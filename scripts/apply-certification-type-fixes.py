"""Use typed closures for discovery and forecast provider calls."""

from pathlib import Path

path = Path("backend/src/providers/orchestrator.py")
text = path.read_text()
changes = [
    (
        "lambda e=espn, c=competition: e.scoreboard(c)",
        "lambda: espn.scoreboard(competition)",
        3,
    ),
    (
        "lambda f=fdo, c=competition: f.fixtures(competition=c)",
        "lambda: fdo.fixtures(competition=competition)",
        3,
    ),
    (
        "lambda f=fdo, c=competition: f.standings(competition=c)",
        "lambda: fdo.standings(competition=competition)",
        1,
    ),
]
for old, new, count in changes:
    if text.count(old) != count:
        raise RuntimeError(f"provider closure count changed: {old}")
    text = text.replace(old, new)
path.write_text(text)
Path(__file__).unlink()
