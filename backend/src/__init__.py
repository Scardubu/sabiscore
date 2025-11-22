"""SabiScore backend package bootstrap.

This module applies lightweight runtime shims for optional dependencies when
tests inject minimal stubs (e.g., numpy) that can break third-party utilities
like pytest.approx. The shim only augments stubs and never overrides real
library implementations.
"""

from __future__ import annotations

import sys
from types import ModuleType
from typing import Any


def _ensure_numpy_shim() -> None:
    np = sys.modules.get("numpy")
    if np is None or not isinstance(np, ModuleType):
        return

    # If this is a stubbed numpy (from tests), it may lack common attributes
    # that tools like pytest expect. We add minimal fallbacks.
    if not hasattr(np, "isscalar"):
        def _isscalar(x: Any) -> bool:  # type: ignore
            return isinstance(x, (int, float, bool, complex)) or getattr(x, "shape", None) in (None, (), [])
        setattr(np, "isscalar", _isscalar)

    if not hasattr(np, "nan"):
        setattr(np, "nan", float("nan"))

    # pandas>=2 expects ``numpy._NoValue`` to exist. Older numpy builds and some
    # lightweight stubs omit it, so create a sentinel when missing.
    if not hasattr(np, "_NoValue"):
        class _NoValueType:
            def __repr__(self) -> str:  # pragma: no cover - helper repr only
                return "<no value>"

        setattr(np, "_NoValue", _NoValueType())

    # Keep additions minimal; do not shadow real numpy if present.


_ensure_numpy_shim()
