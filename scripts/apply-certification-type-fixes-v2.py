#!/usr/bin/env python3
"""Correct and execute the reviewed v1.3 patch payload without partial writes."""

from __future__ import annotations

from pathlib import Path

root = Path(__file__).resolve().parents[1]
payload_path = root / "scripts/apply-certification-type-fixes.py"
payload = payload_path.read_text(encoding="utf-8")

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

if payload.count(old_engine) != 1:
    raise RuntimeError("Could not locate endpoint engine-version patch statement")
if payload.count(old_health) != 1:
    raise RuntimeError("Could not locate redundant health engine-version statement")

payload = payload.replace(old_engine, new_engine, 1).replace(old_health, "", 1)
compiled = compile(payload, str(payload_path), "exec")
exec_globals = {"__name__": "__main__", "__file__": str(payload_path)}
exec(compiled, exec_globals)

# The payload removes itself. Remove this corrective launcher as well.
Path(__file__).unlink(missing_ok=True)
