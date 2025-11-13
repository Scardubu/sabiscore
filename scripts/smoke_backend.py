import sys
import time
import json
from urllib.request import urlopen, Request


BASE = sys.argv[1] if len(sys.argv) > 1 else "https://sabiscore-api.onrender.com"


def get(path: str):
    req = Request(f"{BASE}{path}", headers={"User-Agent": "SabiScore-Smoke/1.0"})
    with urlopen(req, timeout=20) as r:
        body = r.read()
        ctype = r.headers.get("content-type", "")
        if "json" in ctype:
            return r.status, json.loads(body)
        return r.status, body.decode("utf-8", errors="ignore")


def main() -> int:
    print(f"Smoke testing backend: {BASE}")

    # health
    code, body = get("/health")
    print("/health:", code, body)
    if code != 200:
        return 1

    # openapi up
    code, body = get("/openapi.json")
    print("/openapi.json:", code, "paths:", len(body.get("paths", {})) if isinstance(body, dict) else "?")
    if code != 200:
        return 1

    # matches upcoming (may be 200 even if empty)
    code, body = get("/api/v1/matches/upcoming?limit=2")
    print("/api/v1/matches/upcoming:", code)
    if code not in (200, 204):
        return 1

    # predictions value-bets (thresholded)
    code, body = get("/api/v1/predictions/value-bets/today")
    print("/api/v1/predictions/value-bets/today:", code)
    if code not in (200, 204):
        return 1

    print("Smoke test OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
