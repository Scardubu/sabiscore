"""Static production-contract checks for fabrication and public staking leaks."""

from __future__ import annotations

from pathlib import Path


def _read_texts(root: Path, pattern: str) -> str:
    if not root.exists():
        return ""
    return "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in root.rglob(pattern)
        if "node_modules" not in path.parts
    )


def test_prohibited_production_patterns_are_absent() -> None:
    backend_root = Path(__file__).resolve().parents[1]
    repo_root = backend_root.parent

    api_service_provider_text = "\n".join(
        _read_texts(backend_root / "src" / name, "*.py")
        for name in ("api", "services", "providers")
    )
    transformer_text = (backend_root / "src" / "data" / "transformers.py").read_text(
        encoding="utf-8",
        errors="ignore",
    )
    backend_source_text = _read_texts(backend_root / "src", "*.py")
    migration_text = _read_texts(backend_root / "alembic", "*.py")
    web_text = _read_texts(repo_root / "apps" / "web" / "src", "*.ts*")
    env_text = "\n".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in (
            repo_root / "vercel.json",
            repo_root / ".env.example",
            backend_root / ".env.example",
        )
        if path.exists()
    )

    assert "FEATURE_DEFAULTS[" not in api_service_provider_text
    assert "FEATURE_DEFAULTS[" not in transformer_text
    assert "hardcoded_odds" not in api_service_provider_text
    assert "Base.metadata.create_all" not in migration_text
    assert "full_kelly_fraction" not in backend_source_text
    assert "full_kelly" not in web_text
    assert "Full-Kelly" not in web_text
    assert "Full Kelly" not in web_text
    assert "NEXT_PUBLIC_KELLY_FRACTION" not in env_text
