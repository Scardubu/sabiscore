"""Directive §21 — non-adaptive split conformal coverage evaluation (MAPIE).

§21 permits conformal prediction to be *investigated*, and is explicit about
what may be claimed:

    VALID:   "The system's prediction sets achieve measured marginal coverage
              under the evaluation assumptions."
    INVALID: "The system now knows which predictions will be wrong."

This script measures the first. It does not support the second.

Scope and why it is leakage-free
--------------------------------
The served `v5_phase7` artifacts declare ``holdout_season: 2425`` in their own
metadata, so season 2425 was genuinely excluded from their training. That makes
2425 the only slice on which a coverage claim about the *real* served model can
be honest. It is split **temporally** in two: the earlier half conformalizes
(computes conformity scores), the later half is scored. Calibration therefore
strictly precedes test, matching how the model would actually be deployed.

Wrapping a surrogate model instead would measure the conformal machinery but
say nothing about SabiScore's served forecasts, so the real artifact is wrapped
-- base models (RandomForest / XGBoost / LightGBM) → meta features → the
``SoftmaxMetaModel`` head, replicating `src/models/ensemble.py::_create_meta_features`
column-for-column so the wrapper is the production stacking, not a look-alike.

**Non-adaptive only.** ``conformity_score="lac"`` is the Least Ambiguous
set-valued Classifier score (s = 1 - p_true). The adaptive scores (``aps``,
``raps``) are deliberately NOT used: §21 prohibits adaptive conformal "until an
appropriate difficulty signal has been demonstrated", and docs/DEBT.md item 50
records that this system's epistemic uncertainty channel fails
``error_association`` — i.e. the difficulty signal it would need does not
currently exist.

**Coverage alone is not sufficient** (§21). This script therefore also reports
set size, the set-size distribution, failure concentration by true class, and
stability across temporal sub-windows.

⚠️ Evaluation only. No feature contract, model artifact, promotion gate,
calibration layer or serving path is touched.

Usage
-----
    .venv/Scripts/python.exe backend/scripts/evaluate_split_conformal.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

_SCRIPTS = Path(__file__).resolve().parent
REPO_ROOT = _SCRIPTS.parents[1]
sys.path.insert(0, str(_SCRIPTS))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from train_on_real_matches import (  # noqa: E402
    build_dataset,
    load_matches,
    ranked_probability_score as _rps,
)

OUT_JSON = REPO_ROOT / "reports" / "research" / "split-conformal-report.json"
MODELS_DIR = REPO_ROOT / "backend" / "models"
CACHE = REPO_ROOT / "backend" / "data" / "cache"

HOLDOUT_SEASON = "2425"
CONFIDENCE_LEVELS = [0.80, 0.90, 0.95]
CLASS_NAMES = ["home_win", "draw", "away_win"]


class ServedEnsemble:
    """sklearn-compatible view of a served v5_phase7 artifact.

    MAPIE needs ``predict_proba``, ``predict`` and ``classes_``. The artifact is
    a plain dict, so this adapts it without modifying anything on disk. The
    meta-feature construction mirrors
    ``src/models/ensemble.py::_create_meta_features`` exactly -- same column
    names, same per-model ordering -- because ``SoftmaxMetaModel`` carries
    ``feature_names_in_`` and would otherwise be fed a differently-shaped frame.
    """

    _estimator_type = "classifier"

    def __init__(self, artifact: dict[str, Any]) -> None:
        self._models: dict[str, Any] = artifact["models"]
        self._meta = artifact["meta_model"]
        self.feature_columns: list[str] = artifact["feature_columns"]
        self.classes_ = np.asarray(getattr(self._meta, "classes_", [0, 1, 2]))
        self.metadata: dict[str, Any] = artifact.get("model_metadata", {})

    def _meta_features(self, X: np.ndarray) -> pd.DataFrame:
        frame = pd.DataFrame(X, columns=self.feature_columns)
        meta = pd.DataFrame(index=frame.index)
        for name, model in self._models.items():
            probs = model.predict_proba(frame)
            if probs.shape[1] > 2:
                meta[f"{name}_prob_home"] = probs[:, 0]
                meta[f"{name}_prob_draw"] = probs[:, 1]
                meta[f"{name}_prob_away"] = probs[:, 2]
            else:
                meta[f"{name}_prob"] = probs[:, 1]
        return meta

    def predict_proba(self, X: Any) -> np.ndarray:
        return np.asarray(self._meta.predict_proba(self._meta_features(np.asarray(X))))

    def predict(self, X: Any) -> np.ndarray:
        return self.classes_[self.predict_proba(X).argmax(axis=1)]

    def __sklearn_is_fitted__(self) -> bool:
        return True


def load_artifact(league: str) -> ServedEnsemble | None:
    import joblib

    path = MODELS_DIR / f"{league}_ensemble_v5_phase7.pkl"
    if not path.exists():
        return None
    return ServedEnsemble(joblib.load(path))


def evaluate_league(
    league: str,
    model: ServedEnsemble,
    X: np.ndarray,
    y: np.ndarray,
    dates: list[Any],
) -> dict[str, Any] | None:
    """Split conformal on one league's holdout season."""
    from mapie.classification import SplitConformalClassifier

    order = np.argsort(np.asarray(dates))
    X, y = X[order], y[order]
    sorted_dates = [dates[i] for i in order]

    split = len(y) // 2
    if split < 20 or len(y) - split < 20:
        return None

    X_cal, y_cal = X[:split], y[:split]
    X_test, y_test = X[split:], y[split:]

    conformal = SplitConformalClassifier(
        estimator=model,
        confidence_level=CONFIDENCE_LEVELS,
        conformity_score="lac",  # non-adaptive; §21 prohibits aps/raps here
        prefit=True,
    )
    conformal.conformalize(X_cal, y_cal)
    _, y_sets = conformal.predict_set(X_test)  # (n, n_classes, n_levels)

    proba = model.predict_proba(X_test)
    point_pred = proba.argmax(axis=1)

    per_level: dict[str, Any] = {}
    for i, level in enumerate(CONFIDENCE_LEVELS):
        sets = y_sets[:, :, i]
        covered = sets[np.arange(len(y_test)), y_test]
        sizes = sets.sum(axis=1)
        empirical = float(covered.mean())

        # Failure concentration: when the true label is excluded, which class
        # was it? A method whose misses pile onto one outcome is not delivering
        # the marginal guarantee in a usable way, even at nominal coverage.
        missed = ~covered.astype(bool)
        by_class = {
            CLASS_NAMES[c]: {
                "n": int((y_test == c).sum()),
                "missed": int((missed & (y_test == c)).sum()),
                "miss_rate": float(
                    (missed & (y_test == c)).sum() / max((y_test == c).sum(), 1)
                ),
            }
            for c in range(3)
        }

        per_level[f"{level:.2f}"] = {
            "nominal_coverage": level,
            "empirical_coverage": empirical,
            "coverage_gap": empirical - level,
            "mean_set_size": float(sizes.mean()),
            "set_size_distribution": {
                str(k): int((sizes == k).sum()) for k in range(0, 4)
            },
            "singleton_rate": float((sizes == 1).mean()),
            "full_set_rate": float((sizes == 3).mean()),
            "empty_set_rate": float((sizes == 0).mean()),
            "failure_concentration_by_true_class": by_class,
        }

    # Temporal stability: split the test half into two halves again (§21).
    stability: dict[str, Any] = {}
    mid = len(y_test) // 2
    for label, sl in (("test_first_half", slice(0, mid)), ("test_second_half", slice(mid, None))):
        window: dict[str, Any] = {}
        for i, level in enumerate(CONFIDENCE_LEVELS):
            sets = y_sets[sl, :, i]
            yy = y_test[sl]
            window[f"{level:.2f}"] = float(
                sets[np.arange(len(yy)), yy].mean()
            )
        stability[label] = {"n": int(len(y_test[sl])), "empirical_coverage": window}

    return {
        "league": league,
        "n_conformalize": int(len(y_cal)),
        "n_test": int(len(y_test)),
        "conformalize_date_range": [str(sorted_dates[0]), str(sorted_dates[split - 1])],
        "test_date_range": [str(sorted_dates[split]), str(sorted_dates[-1])],
        "point_accuracy_on_test": float((point_pred == y_test).mean()),
        "artifact_reported_accuracy": model.metadata.get("accuracy"),
        "levels": per_level,
        "temporal_stability": stability,
    }


def main() -> int:
    print("loading corpus and building 68-feature vectors (walk-forward) ...")
    matches = load_matches(CACHE)
    dataset = build_dataset(matches)
    print(f"built feature rows for {len(dataset)} leagues")

    results: list[dict[str, Any]] = []
    skipped: dict[str, str] = {}

    for league, payload in sorted(dataset.items()):
        model = load_artifact(league)
        if model is None:
            skipped[league] = "no served v5_phase7 artifact"
            continue

        X_all = np.asarray(payload["X"], dtype=float)
        y_all = np.asarray(payload["y"], dtype=int)
        seasons = np.asarray([str(s) for s in payload["seasons"]])
        dates = list(payload["dates"])

        if X_all.shape[1] != len(model.feature_columns):
            skipped[league] = (
                f"feature width {X_all.shape[1]} != artifact "
                f"{len(model.feature_columns)}"
            )
            continue

        mask = seasons == HOLDOUT_SEASON
        if mask.sum() < 40:
            skipped[league] = f"only {int(mask.sum())} holdout rows"
            continue

        outcome = evaluate_league(
            league,
            model,
            X_all[mask],
            y_all[mask],
            [d for d, m in zip(dates, mask, strict=True) if m],
        )
        if outcome is None:
            skipped[league] = "holdout too small to split"
            continue
        # Faithfulness anchor: score the wrapper on the artifact's FULL declared
        # holdout and compare to the metrics the artifact recorded for itself.
        # Matching row counts prove we are on the same fixtures; differing
        # metrics prove the recorded numbers include a layer the artifact does
        # not carry (see `faithfulness` in the report).
        full_proba = model.predict_proba(X_all[mask])
        outcome["faithfulness"] = {
            "n_here": int(mask.sum()),
            "artifact_holdout_samples": model.metadata.get("holdout_samples"),
            "row_counts_match": str(model.metadata.get("holdout_samples"))
            == str(int(mask.sum())),
            "accuracy_here": float((full_proba.argmax(axis=1) == y_all[mask]).mean()),
            "artifact_recorded_accuracy": model.metadata.get("accuracy"),
            "rps_here": float(_rps(y_all[mask], full_proba)),
            "artifact_recorded_rps": model.metadata.get("rps"),
        }
        results.append(outcome)
        print(
            f"  {league:<12} cal={outcome['n_conformalize']:>3} "
            f"test={outcome['n_test']:>3}  "
            + "  ".join(
                f"@{lv}: {outcome['levels'][lv]['empirical_coverage']:.3f}"
                for lv in outcome["levels"]
            )
        )

    if not results:
        raise SystemExit(f"no league produced a result; skipped: {skipped}")

    # Pooled coverage, weighted by test count.
    pooled: dict[str, Any] = {}
    for level in CONFIDENCE_LEVELS:
        key = f"{level:.2f}"
        total = sum(r["n_test"] for r in results)
        emp = sum(r["levels"][key]["empirical_coverage"] * r["n_test"] for r in results)
        size = sum(r["levels"][key]["mean_set_size"] * r["n_test"] for r in results)
        pooled[key] = {
            "nominal_coverage": level,
            "empirical_coverage": emp / total,
            "coverage_gap": emp / total - level,
            "mean_set_size": size / total,
            "n": total,
        }

    report = {
        "study": "Directive §21 — non-adaptive split conformal (MAPIE)",
        "generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "claim_scope": (
            "Measures marginal coverage of prediction sets under this evaluation's "
            "assumptions (§21 VALID claim). Does NOT support any claim that the "
            "system knows which individual predictions will be wrong."
        ),
        "method": {
            "library": f"mapie {__import__('mapie').__version__}",
            "estimator": "served v5_phase7 stacking ensemble (RF + XGB + LGBM -> SoftmaxMetaModel)",
            "conformity_score": "lac (non-adaptive)",
            "adaptive_scores_excluded": (
                "aps/raps deliberately not evaluated: §21 prohibits adaptive "
                "conformal until a difficulty signal is demonstrated, and "
                "docs/DEBT.md item 50 records that error_association fails."
            ),
            "prefit": True,
            "scope_caveat": (
                "The conformalized object is the ARTIFACT's stacking output "
                "(SoftmaxMetaModel.predict_proba), which is what the .pkl "
                "actually carries. It is NOT the fully-calibrated served "
                "probability: each artifact's own model_metadata records "
                "accuracy/rps that this wrapper does not reproduce on the "
                "identical fixture set (row counts match exactly; metrics do "
                "not), because the calibrator selected during training is not "
                "persisted inside the artifact and calibration_baselines.json "
                "holds recorded telemetry rather than a fitted calibrator. See "
                "per_league[].faithfulness for the measured gap. Coverage "
                "numbers here therefore describe the stacking head, and a "
                "calibrated-pipeline coverage claim would need the calibrator "
                "re-fit or persisted first."
            ),
            "split": (
                f"season {HOLDOUT_SEASON} (the artifacts' own declared holdout, so "
                "no training leakage), ordered by date, earlier half conformalizes, "
                "later half tested"
            ),
            "confidence_levels": CONFIDENCE_LEVELS,
        },
        "pooled": pooled,
        "per_league": results,
        "skipped_leagues": skipped,
        "threshold_policy": (
            "No pass/fail gate is asserted. §19 forbids hard-coded universal "
            "thresholds; coverage gaps and set sizes are reported as measurements."
        ),
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("\n" + "=" * 66)
    print(f"{'nominal':>9}{'empirical':>12}{'gap':>10}{'set size':>11}{'n':>7}")
    print("-" * 66)
    for key, row in pooled.items():
        print(
            f"{row['nominal_coverage']:>9.2f}{row['empirical_coverage']:>12.3f}"
            f"{row['coverage_gap']:>+10.3f}{row['mean_set_size']:>11.2f}{row['n']:>7}"
        )
    print("=" * 66)
    if skipped:
        print(f"skipped: {skipped}")
    print(f"\nwrote {OUT_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
