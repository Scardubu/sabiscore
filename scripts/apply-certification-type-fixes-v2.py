#!/usr/bin/env python3
"""Execute the v1.3 patch transactionally and persist exact diagnostics."""

from __future__ import annotations

import shutil
import tempfile
import traceback
from pathlib import Path

root = Path(__file__).resolve().parents[1]
diagnostic = root / "PATCH_FAILURE.txt"
targets = (
    "backend/src/services/betting_intelligence.py",
    "backend/src/api/endpoints/betting_intelligence.py",
    "backend/src/services/core_engine.py",
    "apps/web/src/lib/betting-intelligence-api.ts",
    "backend/src/services/analytics.py",
    "backend/tests/test_betting_intelligence_engine.py",
    "backend/tests/test_core_engine.py",
)

old_engine = '''text = replace_once(text, '        "engine_version": "1.1.0",', '        "engine_version": "1.2.0",', "endpoint engine version")'''
new_engine = '''engine_version_old = '        "engine_version": "1.1.0",'
engine_version_new = '        "engine_version": "1.2.0",'
engine_version_count = text.count(engine_version_old)
if engine_version_count != 2:
    raise RuntimeError(
        f"endpoint engine version: expected two matches, found {engine_version_count}"
    )
text = text.replace(engine_version_old, engine_version_new, 2)'''
old_health = '''text = replace_once(text, '        "engine_version": "1.1.0",\n        "engine_type": "deterministic",', '        "engine_version": "1.2.0",\n        "engine_type": "deterministic",', "health engine version")'''

try:
    with tempfile.TemporaryDirectory(prefix="sabiscore-patch-") as tmp_dir:
        sandbox = Path(tmp_dir) / "repo"
        shutil.copytree(
            root,
            sandbox,
            ignore=shutil.ignore_patterns(".git", "node_modules", ".venv", "__pycache__"),
        )
        payload_path = sandbox / "scripts/apply-certification-type-fixes.py"
        payload = payload_path.read_text(encoding="utf-8")
        if payload.count(old_engine) != 1:
            raise RuntimeError("Could not locate endpoint engine-version patch statement")
        if payload.count(old_health) != 1:
            raise RuntimeError("Could not locate redundant health engine-version statement")
        payload = payload.replace(old_engine, new_engine, 1).replace(old_health, "", 1)
        compiled = compile(payload, str(payload_path), "exec")
        exec(compiled, {"__name__": "__main__", "__file__": str(payload_path)})

        for relative in targets:
            source = sandbox / relative
            if not source.exists():
                raise RuntimeError(f"Patched target missing from sandbox: {relative}")
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

    diagnostic.unlink(missing_ok=True)
    (root / "scripts/apply-certification-type-fixes.py").unlink(missing_ok=True)
    Path(__file__).unlink(missing_ok=True)
except Exception as exc:  # diagnostic-only path; no source target is copied
    diagnostic.write_text(
        f"{type(exc).__name__}: {exc}\n\n{traceback.format_exc()}",
        encoding="utf-8",
    )
