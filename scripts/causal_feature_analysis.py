"""Generate Phase 6-B causal analysis artifacts.

Outputs:
- data/processed/causal_graph.json
- data/processed/causal_feature_report.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List

import pandas as pd

from backend.src.models.causal_selector import CausalFeatureSelector
from backend.src.models.feature_registry import CANONICAL_FEATURES_58


def _read_training_frames(data_dir: Path) -> pd.DataFrame:
    candidates = sorted(data_dir.glob("*_training.csv"))
    frames: List[pd.DataFrame] = []

    for path in candidates:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if df.empty:
            continue
        frames.append(df)

    if not frames:
        raise FileNotFoundError(f"No training CSV files found in {data_dir}")

    merged = pd.concat(frames, axis=0, ignore_index=True)
    if "result" in merged.columns and "match_result" not in merged.columns:
        merged = merged.rename(columns={"result": "match_result"})
    if "match_result" not in merged.columns:
        raise ValueError("Expected match_result column in training data")
    return merged


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate causal feature artifacts")
    parser.add_argument("--data-dir", default="data/processed", help="Path to processed data directory")
    parser.add_argument("--alpha", type=float, default=0.05, help="Significance level")
    parser.add_argument("--practical-ate", type=float, default=0.02, help="Practical ATE threshold")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    frame = _read_training_frames(data_dir)

    # Normalise outcome column: CSVs use "result"; causal selector expects "match_result"
    if "result" in frame.columns and "match_result" not in frame.columns:
        frame = frame.rename(columns={"result": "match_result"})

    # Identify numeric feature columns (exclude meta/outcome columns)
    _meta_cols = {"match_result", "match_id", "match_date", "league", "season", "date"}
    numeric_feature_cols = [
        col for col in frame.select_dtypes(include="number").columns
        if col not in _meta_cols
    ]

    selector = CausalFeatureSelector(alpha_threshold=args.alpha, practical_ate=args.practical_ate)
    results = selector.analyze(
        frame, outcome_col="match_result", feature_cols=numeric_feature_cols
    )
    graph = selector.build_graph(frame, feature_cols=numeric_feature_cols)

    report_payload = {
        "features": [
            {
                "name": row.name,
                "ate_win": row.ate_win,
                "ate_draw": row.ate_draw,
                "ate_ci": [row.ate_ci[0], row.ate_ci[1]],
                "p_value": row.p_value,
                "classification": row.classification,
            }
            for row in results
        ],
        "feature_count": len(results),
        "canonical_features": len(CANONICAL_FEATURES_58),
        "method": "analysis-only",
    }

    graph_path = data_dir / "causal_graph.json"
    report_path = data_dir / "causal_feature_report.json"

    _write_json(graph_path, graph)
    _write_json(report_path, report_payload)

    print(f"Wrote {graph_path}")
    print(f"Wrote {report_path}")
    print(f"Features analyzed: {len(results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
