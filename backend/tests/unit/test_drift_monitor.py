from __future__ import annotations

import hashlib
import json
from pathlib import Path

import httpx
import pandas as pd
import pytest

from src.monitoring import drift as drift_module
from src.monitoring.drift import DriftMonitor, benjamini_hochberg


def _write_reference(tmp_path: Path) -> tuple[Path, Path, pd.DataFrame]:
    reference = pd.DataFrame(
        {
            "feature_a": [float(value) for value in range(100)],
            "feature_b": [float(value % 10) for value in range(100)],
        }
    )
    artifact = tmp_path / "baseline_v1.parquet"
    # The repository production dependency set includes PyArrow. The focused
    # unit test does not need that optional native dependency; artifact bytes
    # are sufficient for hash verification while read_parquet is mocked below.
    artifact.write_bytes(b"test-reference-artifact")
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    manifest = tmp_path / "baseline_v1.manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "status": "READY",
                "artifact": {"sha256": digest},
                "feature_schema": {"ordered_features": list(reference.columns)},
            }
        ),
        encoding="utf-8",
    )
    return artifact, manifest, reference


def test_benjamini_hochberg_is_monotonic_in_rank() -> None:
    adjusted = benjamini_hochberg([0.001, 0.02, 0.04, 0.8])

    assert adjusted[0] <= adjusted[1] <= adjusted[2] <= adjusted[3]
    assert all(0 <= value <= 1 for value in adjusted)


@pytest.mark.asyncio
async def test_drift_monitor_refuses_underpowered_batch(tmp_path: Path) -> None:
    artifact, manifest, reference = _write_reference(tmp_path)
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(drift_module.pd, "read_parquet", lambda _: reference.copy())
    monitor = DriftMonitor(
        artifact,
        manifest_path=manifest,
        minimum_current_rows=50,
        dataset_drift_share=0.5,
    )

    async with httpx.AsyncClient() as client:
        result = await monitor.evaluate_batch(
            http_client=client,
            current_batch_df=pd.DataFrame({"feature_a": [1.0], "feature_b": [2.0]}),
        )

    assert result.status == "INSUFFICIENT_SAMPLE"
    assert result.dataset_drift is False
    monkeypatch.undo()


@pytest.mark.asyncio
async def test_drift_monitor_applies_fdr_and_uses_async_alert(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact, manifest, reference = _write_reference(tmp_path)
    monkeypatch.setattr(drift_module.pd, "read_parquet", lambda _: reference.copy())
    monitor = DriftMonitor(
        artifact,
        manifest_path=manifest,
        minimum_current_rows=20,
        dataset_drift_share=0.5,
    )
    monkeypatch.setattr(drift_module, "_evidently_report", lambda *_: {"ok": True})

    delivered: list[tuple[str, ...]] = []

    async def fake_alert(**kwargs):
        delivered.append(tuple(kwargs["affected_features"]))
        return True

    monkeypatch.setattr(drift_module, "trigger_slack_drift_alert", fake_alert)
    current = pd.DataFrame(
        {
            "feature_a": [1000.0 + value for value in range(100)],
            "feature_b": [1000.0 + value for value in range(100)],
        }
    )

    async with httpx.AsyncClient() as client:
        result = await monitor.evaluate_batch(
            http_client=client,
            current_batch_df=current,
        )

    assert result.status == "DRIFT_DETECTED"
    assert result.dataset_drift is True
    assert set(result.drifting_features) == {"feature_a", "feature_b"}
    assert delivered == [result.drifting_features]
