from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
FILES_TO_SCAN = [
    ROOT / ".env.example",
    ROOT / ".env.production.example",
    ROOT / ".env.v4.example",
    ROOT / "backend" / ".env.example",
    ROOT / "apps" / "web" / ".env.example",
    ROOT / "apps" / "web" / "vercel.json",
]

PUBLIC_SECRET_PATTERN = re.compile(r"NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)", re.IGNORECASE)
ASSIGNED_SECRET_PATTERN = re.compile(
    r"^[ \t]*(?:FOOTBALL_DATA_API_KEY|API_FOOTBALL_KEY|SPORTMONKS_API_KEY|THE_ODDS_API_KEY)[ \t]*=[ \t]*([^\r\n]*)[ \t]*$",
    re.MULTILINE,
)


def test_env_examples_do_not_expose_browser_provider_secrets():
    retired_espn_key_name = "ESPN" + "_API_KEY"
    for path in FILES_TO_SCAN:
        text = path.read_text(encoding="utf-8")

        assert retired_espn_key_name not in text
        assert PUBLIC_SECRET_PATTERN.search(text) is None


def test_provider_keys_in_examples_are_empty_or_placeholders():
    for path in FILES_TO_SCAN:
        text = path.read_text(encoding="utf-8")

        for match in ASSIGNED_SECRET_PATTERN.finditer(text):
            value = match.group(1).strip().strip('"').strip("'")
            assert value in {"", "your_key_here", "CHANGE_ME"}


def test_vercel_config_is_valid_json():
    import json

    text = (ROOT / "apps" / "web" / "vercel.json").read_text(encoding="utf-8")
    json.loads(text)


def test_web_source_has_no_direct_provider_or_tfjs_imports():
    forbidden = [
        "api.football-data.org",
        "api.the-odds-api.com",
        "oddsportal.com",
        "@tensorflow/tfjs",
    ]

    web_src = ROOT / "apps" / "web" / "src"
    for path in web_src.rglob("*"):
        if not path.is_file() or path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        text = path.read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in text, f"{token} found in {path.relative_to(ROOT)}"
