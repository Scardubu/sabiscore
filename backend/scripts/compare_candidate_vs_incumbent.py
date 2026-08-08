#!/usr/bin/env python3
"""Score the incumbent and candidate artifacts on one identical temporal holdout.

CLAUDE.md: "Retain one certified champion. New models remain SHADOW or RESEARCH
unless they demonstrate measurable temporal out-of-sample improvement." This is
the measurement that decision requires — same fixtures, same feature vectors,
same metrics, both models.

RPS is the promotion metric (lower is better), matching model_registry's own
default. Accuracy is reported but is not the gate: a model that always predicts
the home team can look competitive on accuracy while being useless for pricing.

Usage:
    PYTHONPATH=. python scripts/compare_candidate_vs_incumbent.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import numpy as np

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from scripts.train_on_real_matches import (  # noqa: E402
    _LEAGUE_TO_SLUG,
    build_dataset,
    evaluate,
    load_matches,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("compare")

HOLDOUT_SEASON = "2425"


def _predict(bundle: dict, X: np.ndarray) -> np.ndarray:
    """Mirror PredictionEngine._ensemble_predict_dict: equal-weight mean."""
    models = bundle["models"]
    return np.mean([m.predict_proba(X) for m in models.values()], axis=0)


def main() -> int:
    import joblib

    incumbent_dir = _BACKEND_ROOT / "models"
    candidate_dir = _BACKEND_ROOT / "models" / "candidate"

    dataset = build_dataset(load_matches(_BACKEND_ROOT / "data" / "cache"))

    header = f"{'league':<12} {'model':<10} {'acc':>7} {'RPS':>8} {'Brier':>8} {'logloss':>8}"
    logger.info("\n%s", header)
    logger.info("-" * len(header))

    verdicts = {}
    for league in sorted(dataset):
        slug = _LEAGUE_TO_SLUG[league]
        data = dataset[league]
        seasons = np.asarray(data["seasons"])
        mask = seasons == HOLDOUT_SEASON
        if mask.sum() < 50:
            logger.info("%-12s (no %s holdout — skipped)", league, HOLDOUT_SEASON)
            continue

        X = np.asarray(data["X"], dtype=np.float32)[mask]
        y = np.asarray(data["y"], dtype=np.int64)[mask]

        row = {}
        for label, directory in (("incumbent", incumbent_dir), ("candidate", candidate_dir)):
            path = directory / f"{slug}_ensemble_v5_phase7.pkl"
            if not path.exists():
                logger.info("%-12s %-10s (artifact absent)", league, label)
                continue
            bundle = joblib.load(path)
            metrics = evaluate(y, _predict(bundle, X))
            row[label] = metrics
            logger.info(
                "%-12s %-10s %7.4f %8.4f %8.4f %8.4f",
                league, label, metrics["accuracy"], metrics["rps"],
                metrics["brier"], metrics["log_loss"],
            )

        if "incumbent" in row and "candidate" in row:
            delta = row["incumbent"]["rps"] - row["candidate"]["rps"]
            verdicts[league] = delta
            logger.info(
                "%-12s %-10s RPS %+0.4f  -> %s",
                "", "delta", -delta,
                "CANDIDATE BETTER" if delta > 0 else "incumbent better",
            )
        logger.info("")

    if verdicts:
        better = sum(1 for d in verdicts.values() if d > 0)
        logger.info("Candidate wins on RPS in %d of %d leagues.", better, len(verdicts))
        logger.info("Mean RPS improvement: %+0.4f", float(np.mean(list(verdicts.values()))))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
