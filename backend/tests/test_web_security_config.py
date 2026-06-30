from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_PROJECT_ID = "prj_OZ9E1XDcZMO1G5Zdhj4Dq6OeSzjo"
CANONICAL_BACKEND = "https://sabiscore-api.onrender.com"


def test_production_csp_is_same_origin_only() -> None:
    middleware = (ROOT / "apps/web/src/middleware.ts").read_text(encoding="utf-8")
    assert "\"connect-src 'self'\"" in middleware
    assert "localhost:8000" not in middleware
    assert "SABISCORE_BACKEND_URL" not in middleware


def test_vercel_configs_define_backend_and_canonical_ignore_command() -> None:
    for path in (ROOT / "vercel.json", ROOT / "apps/web/vercel.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload["env"]["SABISCORE_BACKEND_URL"] == CANONICAL_BACKEND
        assert payload["build"]["env"]["SABISCORE_BACKEND_URL"] == CANONICAL_BACKEND
        assert payload["env"]["NEXT_PUBLIC_APP_URL"] == "https://sabiscore.vercel.app"
        public_api = payload["env"].get("NEXT_PUBLIC_API_URL", "/api")
        assert public_api.startswith("/")
        assert "vercel-ignore-build.mjs" in payload["ignoreCommand"]

    ignore_script = (ROOT / "scripts/vercel-ignore-build.mjs").read_text(encoding="utf-8")
    assert CANONICAL_PROJECT_ID in ignore_script


def test_production_backend_resolution_fails_closed() -> None:
    proxy_utils = (ROOT / "apps/web/src/lib/proxy-utils.ts").read_text(encoding="utf-8")
    next_config = (ROOT / "apps/web/next.config.js").read_text(encoding="utf-8")
    assert "SABISCORE_BACKEND_URL is required in production" in proxy_utils
    assert "SABISCORE_BACKEND_URL is required for production builds" in next_config


def test_api_routes_do_not_use_fake_production_tokens_or_unconditional_localhost() -> None:
    web_src = ROOT / "apps/web/src"
    offenders: list[str] = []
    for path in web_src.rglob("*.ts"):
        source = path.read_text(encoding="utf-8")
        if "development-token" in source:
            offenders.append(f"{path.relative_to(ROOT)}: development-token")
        if path.name == "route.ts" and ('??\n  "http://localhost:8000"' in source or 'return "http://127.0.0.1:8000"' in source):
            offenders.append(f"{path.relative_to(ROOT)}: unconditional localhost fallback")
    assert not offenders, "Unsafe backend proxy defaults found:\n" + "\n".join(offenders)
