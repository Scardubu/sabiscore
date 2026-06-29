"""Remove temporary type-contract staging files after transport verification."""

from pathlib import Path

for path in (
    ".github/workflows/apply-production-type-contract.yml",
    ".sabi-core/production-type-contract-trigger",
):
    candidate = Path(path)
    if candidate.exists():
        candidate.unlink()

Path(__file__).unlink()
