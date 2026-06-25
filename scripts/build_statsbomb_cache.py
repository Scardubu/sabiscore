#!/usr/bin/env python3
"""Build a StatsBomb-like tactical cache parquet for Phase 7 features."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.src.core.database import Match, MatchStats, session_scope  # noqa: E402


def _safe_numeric(series: pd.Series, default: float = 0.0) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(default)


def _build_from_db() -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    try:
        with session_scope() as db:
            matches = (
                db.query(Match)
                .filter(Match.status == "finished")
                .filter(Match.match_date.isnot(None))
                .all()
            )

            for match in matches:
                stats = db.query(MatchStats).filter(MatchStats.match_id == match.id).all()
                if len(stats) < 2:
                    continue

                team_rows = []
                for st in stats:
                    shots = float(st.shots or 0)
                    shots_on_target = float(st.shots_on_target or 0)
                    possession = float(st.possession or 50.0)
                    xg = float(st.expected_goals or 0.0)
                    corners = float(st.corners or 0)
                    fouls = float(st.fouls or 0)

                    shot_quality = xg / max(shots, 1.0)
                    progressive_carry = 0.4 * possession + 0.6 * shots_on_target
                    key_passes_pressure = shots_on_target - 0.05 * fouls
                    set_piece_xg = 0.03 * corners + 0.02 * max(shots_on_target - corners, 0.0)

                    # Lower PPDA generally indicates stronger pressing; this is a proxy.
                    ppda = max(1.0, 20.0 - (0.25 * fouls + 0.15 * shots_on_target + 0.05 * possession))

                    team_rows.append(
                        {
                            "match_id": str(match.id),
                            "team_id": str(st.team_id),
                            "league": str(match.league_id or "unknown"),
                            "match_date": match.match_date,
                            "ppda_ratio": ppda,
                            "_progressive_carry": progressive_carry,
                            "_shot_quality": shot_quality,
                            "_key_passes_pressure": key_passes_pressure,
                            "_set_piece_xg": set_piece_xg,
                        }
                    )

                if len(team_rows) < 2:
                    continue

                # Compute team-vs-opponent diffs per match.
                if len(team_rows) == 2:
                    a, b = team_rows[0], team_rows[1]
                    rows.append(
                        {
                            "match_id": a["match_id"],
                            "team_id": a["team_id"],
                            "league": a["league"],
                            "match_date": a["match_date"],
                            "ppda_ratio": a["ppda_ratio"],
                            "progressive_carry_diff": float(a["_progressive_carry"] - b["_progressive_carry"]),
                            "shot_quality_diff": float(a["_shot_quality"] - b["_shot_quality"]),
                            "key_passes_under_pressure_diff": float(a["_key_passes_pressure"] - b["_key_passes_pressure"]),
                            "set_piece_xg_diff": float(a["_set_piece_xg"] - b["_set_piece_xg"]),
                        }
                    )
                    rows.append(
                        {
                            "match_id": b["match_id"],
                            "team_id": b["team_id"],
                            "league": b["league"],
                            "match_date": b["match_date"],
                            "ppda_ratio": b["ppda_ratio"],
                            "progressive_carry_diff": float(b["_progressive_carry"] - a["_progressive_carry"]),
                            "shot_quality_diff": float(b["_shot_quality"] - a["_shot_quality"]),
                            "key_passes_under_pressure_diff": float(b["_key_passes_pressure"] - a["_key_passes_pressure"]),
                            "set_piece_xg_diff": float(b["_set_piece_xg"] - a["_set_piece_xg"]),
                        }
                    )
                else:
                    base = np.mean([float(t["_progressive_carry"]) for t in team_rows])
                    base_sq = np.mean([float(t["_shot_quality"]) for t in team_rows])
                    base_kp = np.mean([float(t["_key_passes_pressure"]) for t in team_rows])
                    base_sp = np.mean([float(t["_set_piece_xg"]) for t in team_rows])
                    for t in team_rows:
                        rows.append(
                            {
                                "match_id": t["match_id"],
                                "team_id": t["team_id"],
                                "league": t["league"],
                                "match_date": t["match_date"],
                                "ppda_ratio": t["ppda_ratio"],
                                "progressive_carry_diff": float(t["_progressive_carry"] - base),
                                "shot_quality_diff": float(t["_shot_quality"] - base_sq),
                                "key_passes_under_pressure_diff": float(t["_key_passes_pressure"] - base_kp),
                                "set_piece_xg_diff": float(t["_set_piece_xg"] - base_sp),
                            }
                        )
    except Exception:
        return pd.DataFrame()

    return pd.DataFrame(rows)


def _build_from_csv_fallback(data_dir: Path) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []
    for csv_path in sorted(data_dir.glob("*_training.csv")):
        league = csv_path.stem.replace("_training", "")
        frame = pd.read_csv(csv_path)
        if frame.empty:
            continue

        home_pos = _safe_numeric(frame.get("home_possession_style", pd.Series(0.5, index=frame.index)), 0.5)
        away_pos = _safe_numeric(frame.get("away_possession_style", pd.Series(0.5, index=frame.index)), 0.5)
        home_press = _safe_numeric(frame.get("home_pressing_intensity", pd.Series(0.55, index=frame.index)), 0.55)
        away_press = _safe_numeric(frame.get("away_pressing_intensity", pd.Series(0.5, index=frame.index)), 0.5)
        home_xg = _safe_numeric(frame.get("home_xg_avg_5", pd.Series(1.2, index=frame.index)), 1.2)
        away_xg = _safe_numeric(frame.get("away_xg_avg_5", pd.Series(1.0, index=frame.index)), 1.0)
        home_set = _safe_numeric(frame.get("home_setpiece_goals_rate", pd.Series(0.2, index=frame.index)), 0.2)
        away_set = _safe_numeric(frame.get("away_setpiece_goals_rate", pd.Series(0.2, index=frame.index)), 0.2)

        if "match_date" in frame.columns:
            match_date = pd.to_datetime(frame["match_date"], errors="coerce")
        else:
            match_date = pd.Timestamp("2023-01-01") + pd.to_timedelta(frame.index, unit="D")

        match_id = frame.get("match_id", pd.Series([f"{league}-csv-{i}" for i in range(len(frame))]))

        rows.append(
            pd.DataFrame(
                {
                    "match_id": match_id.astype(str),
                    "team_id": [f"{league}_team_{i % 20}" for i in range(len(frame))],
                    "league": league,
                    "match_date": match_date,
                    "ppda_ratio": (1.2 - home_press).clip(lower=0.1),
                    "progressive_carry_diff": (home_pos - away_pos) + 0.2 * (home_press - away_press),
                    "shot_quality_diff": home_xg - away_xg,
                    "key_passes_under_pressure_diff": home_press - away_press,
                    "set_piece_xg_diff": home_set - away_set,
                }
            )
        )

    if not rows:
        return pd.DataFrame()
    return pd.concat(rows, ignore_index=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build statsbomb_features_cache.parquet")
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "data" / "processed" / "statsbomb_features_cache.parquet",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=PROJECT_ROOT / "data" / "processed",
        help="CSV fallback data directory",
    )
    args = parser.parse_args()

    frame = _build_from_db()
    source = "database"
    if frame.empty:
        frame = _build_from_csv_fallback(args.data_dir)
        source = "training_csv_fallback"

    if frame.empty:
        print("No data available to build StatsBomb cache")
        return 1

    frame["match_date"] = pd.to_datetime(frame["match_date"], errors="coerce")
    frame = frame.dropna(subset=["match_date"]).sort_values(["league", "match_date", "team_id"])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(args.output, index=False)

    print(f"Wrote {len(frame)} rows to {args.output} (source={source})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
