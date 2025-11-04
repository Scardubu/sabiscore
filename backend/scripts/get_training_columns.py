"""Utility script to inspect training feature columns with resilient fallbacks."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Set

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
CSV_PATH = PROCESSED_DIR / "epl_training.csv"
JSON_MATCH_FILES = sorted(PROCESSED_DIR.glob("*_matches.json"))


def load_training_dataframe() -> pd.DataFrame:
    if CSV_PATH.exists():
        return pd.read_csv(CSV_PATH)

    rows: List[dict] = []
    for file_path in JSON_MATCH_FILES:
        with file_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        for match in data.get("matches", []):
            score = match.get("score") or {}
            ft = score.get("ft")
            if not (isinstance(ft, (list, tuple)) and len(ft) >= 2):
                continue

            rows.append(
                {
                    "home_team": match.get("team1"),
                    "away_team": match.get("team2"),
                    "home_score": ft[0],
                    "away_score": ft[1],
                    "league": data.get("name"),
                    "date": match.get("date"),
                }
            )

    if not rows:
        raise FileNotFoundError(
            "No training data found in CSV or JSON fallbacks. Please generate processed datasets first."
        )

    return pd.DataFrame(rows)


def extract_feature_columns(df: pd.DataFrame) -> List[str]:
    excluded: Set[str] = {"home_team", "away_team", "league", "date"}
    return [col for col in df.columns if col not in excluded]


def main() -> None:
    df = load_training_dataframe()
    columns = extract_feature_columns(df)
    print(f"Total columns: {len(columns)}")
    print(columns)


if __name__ == "__main__":
    main()
