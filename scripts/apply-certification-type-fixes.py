from pathlib import Path

path = Path("backend/requirements-dev.txt")
text = path.read_text()
entry = "pytest" + "-cov==4.1.0\n"
if entry not in text:
    path.write_text(text.rstrip() + "\n" + entry)
Path(__file__).unlink()
