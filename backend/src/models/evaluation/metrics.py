from __future__ import annotations

from typing import Any, Dict

import numpy as np


def expected_calibration_error(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    n_bins: int = 10,
) -> Dict[str, float]:
    """Compute multiclass ECE and return per-class plus mean values."""
    if y_proba.ndim != 2:
        raise ValueError("y_proba must be a 2D array shaped (n_samples, n_classes)")
    if len(y_true) != y_proba.shape[0]:
        raise ValueError("y_true length must match y_proba rows")

    n_classes = y_proba.shape[1]
    n = max(len(y_true), 1)
    bins = np.linspace(0.0, 1.0, n_bins + 1)

    ece_per_class: Dict[str, float] = {}
    for cls in range(n_classes):
        binary = (y_true == cls).astype(float)
        probs = y_proba[:, cls]
        ece = 0.0

        for lo, hi in zip(bins[:-1], bins[1:]):
            mask = (probs > lo) & (probs <= hi)
            if np.any(mask):
                ece += mask.sum() * abs(binary[mask].mean() - probs[mask].mean())

        ece_per_class[f"class_{cls}"] = round(float(ece / n), 4)

    ece_per_class["mean"] = round(
        float(np.mean([ece_per_class[f"class_{i}"] for i in range(n_classes)])), 4
    )
    return ece_per_class


def ranked_probability_score(y_true_outcome: int, probs: list[float]) -> float:
    """Ranked Probability Score for a 3-outcome match (0=home, 1=draw, 2=away).

    Lower is better. Range [0, 1].
    """
    cumprobs = [sum(probs[: i + 1]) for i in range(3)]
    cumtrue = [1.0 if y_true_outcome <= i else 0.0 for i in range(3)]
    return sum((p - t) ** 2 for p, t in zip(cumprobs, cumtrue)) / 2.0


def brier_score_decomposition(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    n_bins: int = 10,
) -> Dict[str, Any]:
    """Multiclass Brier score with its Murphy (1973) three-term decomposition
    (``brier_score = reliability - resolution + uncertainty``), scored
    one-vs-rest per class and averaged. Same binning convention as
    ``expected_calibration_error`` above, so the two are bin-for-bin
    comparable.

    - ``reliability``: distance between predicted probability and observed
      frequency within each bin. Lower is better; fixable by recalibrating
      on the features the model already has.
    - ``resolution``: how far each bin's observed rate is pulled from the
      overall base rate. Higher is better; low resolution means the model
      is genuinely uninformative and needs new signal, not a calibrator.
    - ``uncertainty``: irreducible variance of the outcome itself
      (``base_rate * (1 - base_rate)``) — a property of the data, not the
      model.

    Every bin's sample count is returned in ``bin_counts`` — this is never
    meant to back a reliability curve without also showing its counts.
    """
    if y_proba.ndim != 2:
        raise ValueError("y_proba must be a 2D array shaped (n_samples, n_classes)")
    if len(y_true) != y_proba.shape[0]:
        raise ValueError("y_true length must match y_proba rows")

    n_classes = y_proba.shape[1]
    n = max(len(y_true), 1)
    bins = np.linspace(0.0, 1.0, n_bins + 1)

    per_class: Dict[str, Dict[str, float]] = {}
    bin_counts: Dict[str, list] = {}

    for cls in range(n_classes):
        binary = (y_true == cls).astype(float)
        probs = y_proba[:, cls]
        base_rate = float(binary.mean()) if n else 0.0

        reliability = 0.0
        resolution = 0.0
        counts_for_class: list = []
        for lo, hi in zip(bins[:-1], bins[1:]):
            mask = (probs > lo) & (probs <= hi)
            count = int(mask.sum())
            counts_for_class.append(count)
            if count == 0:
                continue
            p_j = float(probs[mask].mean())
            o_j = float(binary[mask].mean())
            reliability += count * (p_j - o_j) ** 2
            resolution += count * (o_j - base_rate) ** 2

        key = f"class_{cls}"
        bin_counts[key] = counts_for_class
        per_class[key] = {
            "brier_score": round(float(np.mean((probs - binary) ** 2)), 4),
            "reliability": round(reliability / n, 4),
            "resolution": round(resolution / n, 4),
            "uncertainty": round(base_rate * (1.0 - base_rate), 4),
        }

    mean = {
        component: round(
            float(np.mean([per_class[f"class_{i}"][component] for i in range(n_classes)])), 4
        )
        for component in ("brier_score", "reliability", "resolution", "uncertainty")
    }

    return {
        "per_class": per_class,
        "mean": mean,
        "bin_counts": bin_counts,
        "n_bins": n_bins,
        "n_samples": n,
    }
