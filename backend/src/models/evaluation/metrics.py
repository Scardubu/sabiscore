from __future__ import annotations

from typing import Dict

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
