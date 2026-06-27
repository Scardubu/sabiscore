"""Runtime compatibility shims for newly released Python versions."""

from __future__ import annotations

import ast


def apply_python_314_compat() -> None:
    """Patch removed AST aliases used by older dependency versions.

    Python 3.14 removed compatibility aliases such as ``ast.Num``. Older
    joblib releases still reference them when evaluating simple expressions
    inside scikit-learn prediction paths. Assigning the aliases back to
    ``ast.Constant`` is safe and mirrors the behavior Python exposed for years.
    """

    for name in ("Num", "Str", "Bytes", "NameConstant", "Ellipsis"):
        if not hasattr(ast, name):
            setattr(ast, name, ast.Constant)

    if not hasattr(ast.Constant, "n"):
        ast.Constant.n = property(lambda self: self.value)  # type: ignore[attr-defined]
    if not hasattr(ast.Constant, "s"):
        ast.Constant.s = property(lambda self: self.value)  # type: ignore[attr-defined]
