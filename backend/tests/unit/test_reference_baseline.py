from __future__ import annotations

from pathlib import Path

import pytest

from src.monitoring.baseline import BaselineGenerationConfig


def test_baseline_config_requires_safe_paths(tmp_path: Path) -> None:
    config = BaselineGenerationConfig(
        output_path=tmp_path / "baseline.parquet",
        manifest_path=tmp_path / "baseline.json",
        minimum_sample=100,
        fixture_limit=100,
    )

    config.validate()


def test_baseline_config_rejects_limit_below_minimum(tmp_path: Path) -> None:
    config = BaselineGenerationConfig(
        output_path=tmp_path / "baseline.parquet",
        manifest_path=tmp_path / "baseline.json",
        minimum_sample=100,
        fixture_limit=99,
    )

    with pytest.raises(ValueError):
        config.validate()
