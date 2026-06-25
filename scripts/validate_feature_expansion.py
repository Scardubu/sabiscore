#!/usr/bin/env python3
"""Validate Phase 7-A / Phase 8 feature expansion against causal-report evidence and leakage guards.

Phase 2 addition: --shap-ablation flag computes per-family mean |SHAP| across training CSVs
and flags feature families below SHAP_PRUNE_THRESHOLD on 3+ leagues.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    import numpy as np
    import pandas as pd
except Exception:  # pragma: no cover - optional dependency in minimal envs
    np = None  # type: ignore[assignment]
    pd = None

def _load_feature_registry_constants() -> Tuple[List[str], List[str], int]:
    module_path = PROJECT_ROOT / "backend" / "src" / "models" / "feature_registry.py"
    spec = importlib.util.spec_from_file_location("phase7_feature_registry", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load feature registry from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    canonical_phase7 = list(
        getattr(module, "CANONICAL_FEATURES_65", getattr(module, "CANONICAL_FEATURES_68"))
    )
    phase7_features = list(
        getattr(module, "PHASE7_FEATURES_7", getattr(module, "PHASE7_FEATURES_10", []))
    )
    expected_count_fn = getattr(module, "canonical_feature_count_phase7", None)
    expected_count = int(expected_count_fn()) if callable(expected_count_fn) else len(canonical_phase7)
    return canonical_phase7, phase7_features, expected_count


ASSUMPTION_FEATURES = {
    "elo_home_trend_5",
    "elo_away_trend_5",
    "elo_momentum_cross",
    "progressive_carry_diff",
    "shot_quality_diff",
}


@dataclass
class ValidationResult:
    feature: str
    status: str
    reason: str


def _target_to_outcome(series: "pd.Series") -> "pd.Series":
    if pd is None:
        raise RuntimeError("pandas is required for empirical validation")
    mapping = {
        "home_win": 0,
        "draw": 1,
        "away_win": 2,
        "H": 0,
        "D": 1,
        "A": 2,
    }
    return series.map(lambda x: mapping.get(str(x), x)).astype(float)


def _numeric_series(frame: "pd.DataFrame", column: str, default: float = 0.0) -> "pd.Series":
    if column in frame.columns:
        return pd.to_numeric(frame[column], errors="coerce").fillna(default)
    return pd.Series(default, index=frame.index, dtype=float)


def _inject_phase7_proxies(frame: "pd.DataFrame") -> "pd.DataFrame":
    """Create deterministic proxy columns for assumption features when absent.

    These proxies are intentionally simple and only used for empirical diagnostics
    until direct Elo/StatsBomb ingestions are available in historical CSVs.
    """
    out = frame.copy()

    home_momentum = _numeric_series(out, "home_momentum_lambda", 1.0)
    away_momentum = _numeric_series(out, "away_momentum_lambda", 1.0)
    home_form_5 = _numeric_series(out, "home_form_5", 0.0)
    home_form_10 = _numeric_series(out, "home_form_10", 0.0)
    away_form_5 = _numeric_series(out, "away_form_5", 0.0)
    away_form_10 = _numeric_series(out, "away_form_10", 0.0)

    out["elo_home_trend_5"] = out.get(
        "elo_home_trend_5",
        (home_momentum - 1.0) + 0.5 * (home_form_5 - home_form_10),
    )
    out["elo_away_trend_5"] = out.get(
        "elo_away_trend_5",
        (away_momentum - 1.0) + 0.5 * (away_form_5 - away_form_10),
    )

    elo_diff = _numeric_series(out, "elo_difference", 0.0)
    out["elo_league_adjusted"] = out.get("elo_league_adjusted", elo_diff / 150.0)
    out["elo_momentum_cross"] = out.get(
        "elo_momentum_cross",
        out["elo_home_trend_5"] - out["elo_away_trend_5"],
    )

    home_possession = _numeric_series(out, "home_possession_style", 0.5)
    away_possession = _numeric_series(out, "away_possession_style", 0.5)
    out["progressive_carry_diff"] = out.get(
        "progressive_carry_diff",
        0.6 * (home_possession - away_possession) + 0.4 * (home_form_5 - away_form_5),
    )

    out["shot_quality_diff"] = out.get(
        "shot_quality_diff",
        _numeric_series(out, "home_xg_avg_5", 1.2) - _numeric_series(out, "away_xg_avg_5", 1.0),
    )
    out["key_passes_under_pressure_diff"] = out.get(
        "key_passes_under_pressure_diff",
        _numeric_series(out, "home_pressing_intensity", 0.55)
        - _numeric_series(out, "away_pressing_intensity", 0.5),
    )
    out["set_piece_xg_diff"] = out.get(
        "set_piece_xg_diff",
        _numeric_series(out, "home_setpiece_goals_rate", 0.2)
        - _numeric_series(out, "away_setpiece_goals_rate", 0.2),
    )

    return out


def empirical_feature_scores(
    feature: str,
    training_paths: List[Path],
) -> Dict[str, float] | None:
    if pd is None:
        return None

    observed: List[pd.DataFrame] = []
    for path in training_paths:
        if not path.exists():
            continue
        try:
            frame = pd.read_csv(path)
        except Exception:
            continue
        frame = _inject_phase7_proxies(frame)
        if feature not in frame.columns:
            continue
        frame = frame[[feature, "result"]]
        frame = frame.dropna(subset=[feature, "result"]).copy()
        if frame.empty:
            continue
        frame["result"] = _target_to_outcome(frame["result"])
        frame = frame[frame["result"].isin([0.0, 1.0, 2.0])]
        if frame.empty:
            continue
        observed.append(frame)

    if not observed:
        return None

    all_rows = pd.concat(observed, ignore_index=True)
    q75 = float(all_rows[feature].quantile(0.75))
    treated = all_rows[all_rows[feature] >= q75]
    control = all_rows[all_rows[feature] < q75]
    if treated.empty or control.empty:
        return None

    ate_win = float((treated["result"] == 0.0).mean() - (control["result"] == 0.0).mean())
    ate_draw = float((treated["result"] == 1.0).mean() - (control["result"] == 1.0).mean())
    return {
        "samples": float(len(all_rows)),
        "threshold_q75": q75,
        "ate_win": ate_win,
        "ate_draw": ate_draw,
    }


def load_causal_report(path: Path) -> Dict[str, Dict[str, float]]:
    data = json.loads(path.read_text())
    mapping: Dict[str, Dict[str, float]] = {}
    for row in data.get("features", []):
        name = str(row.get("name", ""))
        mapping[name] = {
            "ate_win": float(row.get("ate_win", 0.0)),
            "ate_draw": float(row.get("ate_draw", 0.0)),
            "p_value": float(row.get("p_value", 1.0)),
        }
    return mapping


# ── Phase 8 feature family registry for SHAP ablation ────────────────────────
# Maps family name → feature name list (canonical names from feature_registry.py).
PHASE8_FEATURE_FAMILIES: Dict[str, List[str]] = {
    "pi_ratings": [
        "home_pi_attack", "home_pi_defense", "away_pi_attack",
        "away_pi_defense", "pi_attack_diff", "pi_defense_diff",
    ],
    "berrar_ratings": [
        "home_berrar_rating", "away_berrar_rating", "berrar_rating_diff",
    ],
    "ewma_form": [
        "home_weighted_win_rate", "home_weighted_draw_rate", "home_weighted_ppg",
        "away_weighted_win_rate", "away_weighted_draw_rate", "away_weighted_ppg",
    ],
    "market_drift": [
        "odds_drift_home", "odds_drift_draw", "odds_drift_away",
        "max_abs_odds_drift", "sharp_money_direction",
    ],
    "match_context": ["match_importance_score"],
    "elo": [
        "elo_difference", "elo_home_trend_5", "elo_away_trend_5", "elo_momentum_cross",
    ],
    "tactical_statsbomb": [
        "home_pressing_intensity", "progressive_carry_diff",
    ],
}

RESULT_LABEL_MAP = {
    "home_win": 0, "h": 0, "0": 0,
    "draw": 1, "d": 1, "1": 1,
    "away_win": 2, "a": 2, "2": 2,
}


def _normalize_target_for_shap(series: "pd.Series") -> "pd.Series":
    if series.dtype.kind in {"i", "u", "f"}:
        return series.astype(int)
    return series.astype(str).str.strip().str.lower().map(
        lambda x: RESULT_LABEL_MAP.get(x, np.nan)
    ).astype(float)


def _shap_family_importance(
    feature_families: Dict[str, List[str]],
    training_paths: List[Path],
    shap_prune_threshold: float = 0.002,
) -> Optional[Dict[str, Dict[str, object]]]:
    """Compute mean |SHAP| per feature family across training CSVs.

    Trains a lightweight XGBoost model per league CSV, computes SHAP values,
    then aggregates per family. Returns None if shap or xgboost is unavailable.

    Returns:
        {
            family_name: {
                "mean_abs_shap": float,     # mean over all features and folds
                "below_threshold": bool,    # True if mean_abs_shap < shap_prune_threshold
                "leagues_below": int,       # count of leagues where family is below threshold
                "features": {feat: mean_abs_shap},
            }
        }
    """
    try:
        import numpy as np  # noqa: F811
        import xgboost as xgb
    except ImportError:
        return None

    try:
        import shap as shap_lib
        _shap_available = True
    except ImportError:
        _shap_available = False

    if pd is None:
        return None

    # Collect per-league family scores
    league_family_scores: Dict[str, List[float]] = {fam: [] for fam in feature_families}
    feature_shap_accum: Dict[str, List[float]] = {}

    for path in training_paths:
        if not path.exists():
            continue
        try:
            frame = pd.read_csv(path)
        except Exception:
            continue

        if "result" not in frame.columns:
            continue

        frame = _inject_phase7_proxies(frame)
        y_raw = _normalize_target_for_shap(frame["result"])
        valid_mask = y_raw.isin([0, 1, 2])
        frame = frame[valid_mask].reset_index(drop=True)
        y = y_raw[valid_mask].astype(int).to_numpy()

        if len(y) < 50:
            continue

        # Collect all canonical features present in this CSV
        all_family_features = [f for fam in feature_families.values() for f in fam]
        feature_cols = [c for c in all_family_features if c in frame.columns]
        if not feature_cols:
            continue

        X = frame[feature_cols].apply(pd.to_numeric, errors="coerce").fillna(0.0)

        try:
            model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                objective="multi:softprob",
                num_class=3,
                eval_metric="mlogloss",
                random_state=42,
                verbosity=0,
                n_jobs=-1,
            )
            model.fit(X, y)
        except Exception:
            continue

        if _shap_available:
            try:
                explainer = shap_lib.TreeExplainer(model)
                shap_values = explainer.shap_values(X)
                # shap_values shape: (n_samples, n_features, n_classes) or list of arrays
                if isinstance(shap_values, list):
                    abs_shap = np.mean(np.abs(np.array(shap_values)), axis=0)
                else:
                    abs_shap = np.abs(shap_values).mean(axis=0)
                    if abs_shap.ndim > 1:
                        abs_shap = abs_shap.mean(axis=-1)
                feat_importance = {
                    feat: float(abs_shap[i]) for i, feat in enumerate(feature_cols)
                }
            except Exception:
                feat_importance = {
                    feat: float(model.feature_importances_[i])
                    for i, feat in enumerate(feature_cols)
                }
        else:
            feat_importance = {
                feat: float(model.feature_importances_[i])
                for i, feat in enumerate(feature_cols)
            }

        for feat, val in feat_importance.items():
            feature_shap_accum.setdefault(feat, []).append(val)

        for fam, fam_feats in feature_families.items():
            fam_scores = [feat_importance[f] for f in fam_feats if f in feat_importance]
            if fam_scores:
                league_family_scores[fam].append(float(np.mean(fam_scores)))

    if not any(league_family_scores.values()):
        return None

    import numpy as np  # ensure available here

    result: Dict[str, Dict[str, object]] = {}
    for fam, scores in league_family_scores.items():
        if not scores:
            continue
        mean_score = float(np.mean(scores))
        leagues_below = int(sum(1 for s in scores if s < shap_prune_threshold))
        feat_means = {
            feat: round(float(np.mean(feature_shap_accum[feat])), 6)
            for feat in feature_families[fam]
            if feat in feature_shap_accum
        }
        result[fam] = {
            "mean_abs_shap": round(mean_score, 6),
            "leagues_evaluated": len(scores),
            "leagues_below": leagues_below,
            "below_threshold": mean_score < shap_prune_threshold,
            "flagged_for_review": leagues_below >= 3,
            "features": feat_means,
        }

    return result


def evaluate_feature(feature: str, report: Dict[str, Dict[str, float]]) -> ValidationResult:
    item = report.get(feature)
    if item is None:
        if feature in ASSUMPTION_FEATURES:
            return ValidationResult(feature, "ASSUMPTION", "Missing from report, requires empirical confirmation")
        return ValidationResult(feature, "FAIL", "Missing from causal report")

    ate_win = abs(item["ate_win"])
    ate_draw = abs(item["ate_draw"])
    p_value = item["p_value"]
    if (ate_win >= 0.02 or ate_draw >= 0.02) and p_value < 0.05:
        return ValidationResult(
            feature,
            "PASS",
            f"ATE(win)={item['ate_win']:.3f}, ATE(draw)={item['ate_draw']:.3f}, p={p_value:.3g}",
        )

    return ValidationResult(
        feature,
        "FAIL",
        f"ATE/p-value gate failed: ATE(win)={item['ate_win']:.3f}, ATE(draw)={item['ate_draw']:.3f}, p={p_value:.3g}",
    )


def validate_elo_leakage(elo_path: Path) -> Tuple[bool, str]:
    if pd is None:
        return False, "pandas unavailable; skipped elo parquet validation"

    if not elo_path.exists():
        return False, "elo_ratings.parquet not found"

    try:
        frame = pd.read_parquet(elo_path)
    except Exception as exc:
        return False, f"Unable to read elo parquet: {exc}"

    required = {"match_id", "team_id", "pre_match_elo", "post_match_elo", "match_date"}
    if not required.issubset(frame.columns):
        return False, f"Missing required Elo columns: {sorted(required - set(frame.columns))}"

    duplicates = frame.duplicated(subset=["match_id", "team_id"]).any()
    if duplicates:
        return False, "Duplicate (match_id, team_id) rows detected"

    return True, "No duplicate snapshots detected"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Phase 7-A feature expansion")
    parser.add_argument(
        "--causal-report",
        type=Path,
        default=Path("data/processed/causal_feature_report.json"),
    )
    parser.add_argument(
        "--elo-parquet",
        type=Path,
        default=Path("data/processed/elo_ratings.parquet"),
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on ASSUMPTION features that lack empirical report evidence",
    )
    parser.add_argument(
        "--empirical",
        action="store_true",
        help="Compute provisional empirical ATE for assumption features from training CSVs.",
    )
    parser.add_argument(
        "--training-glob",
        default="data/processed/*_training.csv",
        help="Glob pattern for league training CSV files used in empirical checks.",
    )
    parser.add_argument(
        "--shap-ablation",
        action="store_true",
        help=(
            "Compute per-family mean |SHAP| across training CSVs. "
            "Requires xgboost; shap library optional (falls back to feature_importances_). "
            "Families below --shap-prune-threshold on 3+ leagues are flagged for review."
        ),
    )
    parser.add_argument(
        "--shap-prune-threshold",
        type=float,
        default=0.002,
        help="Mean |SHAP| below which a feature family is flagged (default: 0.002).",
    )
    args = parser.parse_args()

    canonical_features_phase7, phase7_features, expected_phase7_count = _load_feature_registry_constants()

    if len(canonical_features_phase7) != expected_phase7_count:
        print(
            "FAIL canonical Phase 7 feature count mismatch: "
            f"expected={expected_phase7_count} actual={len(canonical_features_phase7)}"
        )
        return 1

    report = load_causal_report(args.causal_report)
    results: List[ValidationResult] = [evaluate_feature(name, report) for name in phase7_features]

    for row in results:
        print(f"{row.status:10} {row.feature:35} {row.reason}")

    if args.empirical:
        training_paths = sorted(PROJECT_ROOT.glob(args.training_glob))
        print("\nEmpirical provisional checks (q75 treated vs control):")
        for row in results:
            if row.status != "ASSUMPTION":
                continue
            empirical = empirical_feature_scores(row.feature, training_paths)
            if empirical is None:
                print(f"EMPIRICAL  {row.feature:35} unavailable")
                continue
            print(
                "EMPIRICAL  "
                f"{row.feature:35} samples={int(empirical['samples'])} "
                f"ate_win={empirical['ate_win']:.3f} ate_draw={empirical['ate_draw']:.3f} "
                f"q75={empirical['threshold_q75']:.3f}"
            )

    leakage_ok, leakage_reason = validate_elo_leakage(args.elo_parquet)
    print(f"{'PASS' if leakage_ok else 'WARN'}       elo_leakage_check                 {leakage_reason}")

    # ── SHAP ablation (Phase 2 Sprint 4) ─────────────────────────────────────
    if args.shap_ablation:
        training_paths = sorted(PROJECT_ROOT.glob(args.training_glob))
        print(f"\nSHAP ablation (threshold={args.shap_prune_threshold}, CSVs={len(training_paths)}):")
        shap_report = _shap_family_importance(
            feature_families=PHASE8_FEATURE_FAMILIES,
            training_paths=training_paths,
            shap_prune_threshold=args.shap_prune_threshold,
        )
        if shap_report is None:
            print("WARN       shap_ablation                     xgboost or pandas unavailable — skipped")
        else:
            for fam, info in shap_report.items():
                flagged = info.get("flagged_for_review", False)
                below = info.get("leagues_below", 0)
                evaluated = info.get("leagues_evaluated", 0)
                mean_shap = info.get("mean_abs_shap", 0.0)
                status = "REVIEW" if flagged else "OK    "
                print(
                    f"{status}     shap:{fam:<25} "
                    f"mean_abs={mean_shap:.6f} "
                    f"leagues_below={below}/{evaluated}"
                )
                if flagged:
                    print(
                        f"           → flagged: {below}/{evaluated} leagues below "
                        f"threshold {args.shap_prune_threshold}. "
                        "Run ATE invalidation before removing from canonical set."
                    )
            # Write SHAP report to file alongside causal report
            shap_report_path = PROJECT_ROOT / "data" / "processed" / "shap_ablation_report.json"
            try:
                shap_report_path.write_text(
                    __import__("json").dumps(
                        {"threshold": args.shap_prune_threshold, "families": shap_report},
                        indent=2,
                    ),
                    encoding="utf-8",
                )
                print(f"\nSHAP report written → {shap_report_path}")
            except Exception as exc:
                print(f"WARN       Could not write SHAP report: {exc}")

    fail_count = sum(1 for item in results if item.status == "FAIL")
    assumption_count = sum(1 for item in results if item.status == "ASSUMPTION")

    if fail_count > 0:
        print(f"FAIL summary: {fail_count} hard failures")
        return 1

    if args.strict and assumption_count > 0:
        print(f"FAIL summary: {assumption_count} assumptions unresolved under --strict")
        return 1

    print(f"PASS summary: validated={len(results) - assumption_count}, assumptions={assumption_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
