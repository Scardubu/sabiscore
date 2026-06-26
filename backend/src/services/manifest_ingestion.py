"""Validated ingestion helpers for Node scraper manifests.

The scraper writes immutable manifests after all raw and processed payloads are
atomically renamed into place. The backend validates those manifests before any
consumer trusts their payload paths or hashes.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


REQUIRED_MANIFEST_FIELDS = {
    "manifest_version",
    "run_id",
    "source_id",
    "adapter_version",
    "schema_version",
    "started_at",
    "completed_at",
    "status",
    "record_count",
    "raw_files",
    "processed_files",
    "payload_hashes",
    "freshness",
    "errors",
    "licence",
}

INGESTIBLE_STATUSES = {"SUCCESS", "PARTIAL"}
DEFAULT_ALLOWED_ADAPTER_VERSIONS = {"1.0.0"}


class ManifestValidationError(ValueError):
    """Raised when a scraper manifest cannot be trusted for ingestion."""


@dataclass(frozen=True)
class ValidatedManifest:
    manifest_path: Path
    manifest: dict[str, Any]
    payload_paths: tuple[Path, ...]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_under_root(path: Path, root: Path, label: str) -> Path:
    resolved = path.resolve()
    root_resolved = root.resolve()
    try:
        resolved.relative_to(root_resolved)
    except ValueError as exc:
        raise ManifestValidationError(f"{label} path escapes configured data root: {path}") from exc
    return resolved


def _iter_payloads(manifest: dict[str, Any]) -> Iterable[str]:
    for key in ("raw_files", "processed_files"):
        values = manifest.get(key)
        if not isinstance(values, list):
            raise ManifestValidationError(f"{key} must be a list")
        for value in values:
            if not isinstance(value, str) or not value:
                raise ManifestValidationError(f"{key} contains a non-string path")
            yield value


def validate_manifest(
    manifest_path: str | Path,
    *,
    data_root: str | Path,
    allowed_adapter_versions: set[str] | None = None,
) -> ValidatedManifest:
    """Validate a completed Node scraper manifest and payload hashes.

    This performs no database writes. Callers can use the returned object for an
    idempotent persistence step after all trust checks pass.
    """

    root = Path(data_root).resolve()
    path = _require_under_root(Path(manifest_path), root, "manifest")
    if path.suffix != ".json" or path.name.endswith(".tmp"):
        raise ManifestValidationError("manifest must be a completed .json file")
    if not path.exists():
        raise ManifestValidationError(f"manifest does not exist: {path}")

    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ManifestValidationError("manifest is not valid JSON") from exc

    missing = sorted(REQUIRED_MANIFEST_FIELDS - set(manifest))
    if missing:
        raise ManifestValidationError(f"manifest missing required fields: {', '.join(missing)}")

    if manifest["manifest_version"] != "1.0":
        raise ManifestValidationError("unsupported manifest_version")
    if manifest["status"] not in INGESTIBLE_STATUSES:
        raise ManifestValidationError(f"manifest status is not ingestible: {manifest['status']}")
    if manifest["adapter_version"] not in (allowed_adapter_versions or DEFAULT_ALLOWED_ADAPTER_VERSIONS):
        raise ManifestValidationError(f"adapter_version is not allowed: {manifest['adapter_version']}")
    if not isinstance(manifest.get("payload_hashes"), dict):
        raise ManifestValidationError("payload_hashes must be an object")

    payload_paths: list[Path] = []
    for payload in _iter_payloads(manifest):
        payload_path = _require_under_root(Path(payload), root, "payload")
        if payload_path.name.endswith(".tmp"):
            raise ManifestValidationError(f"payload is still a temporary file: {payload_path}")
        if not payload_path.exists():
            raise ManifestValidationError(f"payload does not exist: {payload_path}")
        expected_hash = manifest["payload_hashes"].get(str(payload_path))
        if expected_hash is None:
            expected_hash = manifest["payload_hashes"].get(payload)
        if not expected_hash:
            raise ManifestValidationError(f"payload hash missing for {payload_path}")
        actual_hash = _sha256_file(payload_path)
        if actual_hash != expected_hash:
            raise ManifestValidationError(f"payload hash mismatch for {payload_path}")
        if payload_path.suffix == ".json":
            try:
                json.loads(payload_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise ManifestValidationError(f"processed JSON payload is invalid: {payload_path}") from exc
        payload_paths.append(payload_path)

    return ValidatedManifest(
        manifest_path=path,
        manifest=manifest,
        payload_paths=tuple(payload_paths),
    )

