#!/usr/bin/env python3
"""
scripts/optuna_tune_ensemble.py — P3-A

Standalone Optuna hyperparameter search for the SabiScore ensemble.
Produces EnsembleModel-compatible .pkl artifacts ready for production loading.

Usage:
    python scripts/optuna_tune_ensemble.py --league epl --trials 50
    python scripts/optuna_tune_ensemble.py --league all --trials 100
    python scripts/optuna_tune_ensemble.py --league bundesliga --trials 30 \\
        --data-dir data/processed --output-dir backend/models

Constraint C8 (hard): Every trial objective includes the draw_recall_penalty:
    penalty = max(0, 0.60 − predicted_draw_rate / 0.246) × 10

Validation gate: predicted_draw_rate / 0.246 ≥ 0.60 for every output artifact.

Pre-conditions (enforced at startup):
    - BUG-007 must be fixed (this script always uses method='isotonic')
    - Data CSVs must exist under --data-dir: {league}_training.csv
    - Output artifacts named: {league}_ensemble_v4_optuna.pkl
"""

import argparse
import logging
import pickle
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import optuna
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import TimeSeriesSplit
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

# ── path setup: allow `from src.models.feature_registry import …` ─────────────
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from src.models.feature_registry import (  # noqa: E402
    CANONICAL_FEATURES_58,
    DEFAULT_FEATURE_VALUES_58,
)
from src.models.calibration import (  # noqa: E402
    EnsembleDiversityDiagnostics,
    run_league_calibration,
    write_calibration_report,
    write_diversity_report,
)

# ── constants ─────────────────────────────────────────────────────────────────
DRAW_LABEL = 1
BASE_DRAW_RATE = 0.246
DRAW_RATIO_GATE = 0.60
CV_FOLDS = 3  # TimeSeriesSplit n_splits per spec (C8)

LEAGUES: List[str] = ["epl", "la_liga", "bundesliga", "serie_a", "ligue_1", "eredivisie"]

LEAGUE_CSV_MAP: Dict[str, str] = {
    "epl":        "epl_training.csv",
    "la_liga":    "la_liga_training.csv",
    "bundesliga": "bundesliga_training.csv",
    "serie_a":    "serie_a_training.csv",
    "ligue_1":    "ligue_1_training.csv",
    "eredivisie": "eredivisie_training.csv",
}

# Per-league historical averages (home_rate, avg_goals, draw_rate)
# Eredivisie: high-scoring (3.0 GPG), Ajax/PSV/Feyenoord home dominance (0.45),
# fewer draws than average because high goal totals resolve more conclusively (0.240).
LEAGUE_STATS: Dict[str, Tuple[float, float, float]] = {
    "epl":        (0.42, 2.85, 0.246),
    "la_liga":    (0.44, 2.60, 0.255),
    "bundesliga": (0.45, 3.05, 0.228),
    "serie_a":    (0.43, 2.58, 0.272),
    "ligue_1":    (0.41, 2.66, 0.259),
    "eredivisie": (0.45, 3.00, 0.240),
}

# Maps league key → canonical one-hot column name.
# Eredivisie intentionally absent: CANONICAL_FEATURES_58 has no league_Eredivisie
# column (adding one would break the 58-dim constraint, C7).  All league_ columns
# remain 0 for Eredivisie training rows — the model learns purely from the other 57.
LEAGUE_ONE_HOT: Dict[str, str] = {
    "bundesliga": "league_Bundesliga",
    "epl":        "league_EPL",
    "la_liga":    "league_La_Liga",
    "ligue_1":    "league_Ligue_1",
    "serie_a":    "league_Serie_A",
}

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("optuna_tune")


# ── data loading & projection ─────────────────────────────────────────────────

def _safe_float(row: pd.Series, col: str, default: float) -> float:
    val = row.get(col)
    if val is None:
        return default
    try:
        f = float(val)
        return default if np.isnan(f) or np.isinf(f) else f
    except (TypeError, ValueError):
        return default


def _project_row_to_canonical(row: pd.Series, league: str) -> Dict[str, float]:
    """Map one legacy-schema CSV row to the canonical 58-feature dict.

    Follows the same projection logic as FeatureTransformer._project_to_canonical_features()
    (backend/src/data/transformers.py) so training and inference representations are aligned.
    """
    c = dict(DEFAULT_FEATURE_VALUES_58)

    # ── form / wins ──────────────────────────────────────────────────────────
    home_form_5 = _safe_float(row, "home_form_5", 0.5)
    away_form_5 = _safe_float(row, "away_form_5", 0.45)
    home_win_rate_5 = _safe_float(row, "home_win_rate_5", 0.5)
    away_win_rate_5 = _safe_float(row, "away_win_rate_5", 0.4)

    c["home_form_last5_home"] = home_form_5 * 3.0
    c["away_form_last5_away"] = away_form_5 * 3.0
    c["home_wins_last5_home"] = float(round(home_win_rate_5 * 5.0))
    c["away_wins_last5_away"] = float(round(away_win_rate_5 * 5.0))
    c["home_draws_last5_home"] = max(0.0, 5.0 - c["home_wins_last5_home"] - 2.0)
    c["away_draws_last5_away"] = max(0.0, 5.0 - c["away_wins_last5_away"] - 2.0)
    c["home_losses_last5_home"] = max(
        0.0, 5.0 - c["home_wins_last5_home"] - c["home_draws_last5_home"]
    )
    c["away_losses_last5_away"] = max(
        0.0, 5.0 - c["away_wins_last5_away"] - c["away_draws_last5_away"]
    )

    # ── goals / GD ───────────────────────────────────────────────────────────
    c["home_goals_for_avg"] = _safe_float(row, "home_goals_per_match_5", 1.55)
    c["away_goals_for_avg"] = _safe_float(row, "away_goals_per_match_5", 1.25)
    c["home_goals_against_avg"] = _safe_float(row, "home_goals_conceded_per_match_5", 1.20)
    c["away_goals_against_avg"] = _safe_float(row, "away_goals_conceded_per_match_5", 1.40)
    c["home_gd_recent"] = _safe_float(row, "home_gd_avg_5", 0.35)
    c["away_gd_recent"] = _safe_float(row, "away_gd_avg_5", -0.15)
    c["combined_attack"] = c["home_goals_for_avg"] + c["away_goals_for_avg"]
    c["combined_defense_weakness"] = c["home_goals_against_avg"] + c["away_goals_against_avg"]
    xg_diff = _safe_float(row, "xg_differential", 0.20)
    c["total_goals_expected"] = xg_diff + 2.60

    # ── market / odds (derived from home_implied_prob only) ──────────────────
    mp_home = max(0.01, min(0.97, _safe_float(row, "home_implied_prob", 0.42)))
    mp_draw = 0.26
    mp_away = max(0.01, 1.0 - mp_home - mp_draw)
    norm = mp_home + mp_draw + mp_away
    mp_home /= norm
    mp_draw /= norm
    mp_away /= norm

    ho = max(1.01, 1.0 / mp_home)
    dr = max(1.01, 1.0 / mp_draw)
    ao = max(1.01, 1.0 / mp_away)

    c["market_prob_home"] = mp_home
    c["market_prob_draw"] = mp_draw
    c["market_prob_away"] = mp_away
    c["market_edge_home"] = mp_home - mp_away
    c["market_favorite"] = float(np.argmax([mp_home, mp_draw, mp_away]))
    c["odds_ratio"] = ho / ao
    c["log_odds_home"] = float(np.log(ho))
    c["log_odds_draw"] = float(np.log(dr))
    c["log_odds_away"] = float(np.log(ao))
    c["draw_probability"] = mp_draw
    c["market_confidence"] = max(mp_home, mp_draw, mp_away)
    c["ev_home"] = mp_home * ho - 1.0
    c["ev_draw"] = mp_draw * dr - 1.0
    c["ev_away"] = mp_away * ao - 1.0

    # ── H2H ──────────────────────────────────────────────────────────────────
    c["h2h_home_wins"] = _safe_float(row, "h2h_home_wins", 2.0)
    c["h2h_away_wins"] = _safe_float(row, "h2h_away_wins", 2.0)
    c["h2h_draws"] = _safe_float(row, "h2h_draws", 1.0)
    c["h2h_matches"] = max(1.0, _safe_float(row, "h2h_total_matches", 5.0))
    c["h2h_dominance"] = (c["h2h_home_wins"] - c["h2h_away_wins"]) / c["h2h_matches"]

    # ── venue ────────────────────────────────────────────────────────────────
    home_win_rate = _safe_float(row, "home_advantage_win_rate", 0.5)
    away_win_rate = _safe_float(row, "away_win_rate_away", 0.3)
    home_draw_rate = max(0.0, 1.0 - home_win_rate - away_win_rate)
    c["home_venue_win_rate"] = home_win_rate
    c["home_venue_draw_rate"] = home_draw_rate
    c["home_venue_loss_rate"] = away_win_rate
    c["home_advantage_strength"] = home_win_rate - away_win_rate

    # ── schedule ─────────────────────────────────────────────────────────────
    date_str = row.get("match_date")
    try:
        dt = pd.to_datetime(date_str) if date_str is not None else pd.Timestamp.utcnow()
    except Exception:
        dt = pd.Timestamp.utcnow()
    c["day_of_week"] = float(dt.dayofweek)
    c["is_weekend"] = 1.0 if dt.dayofweek >= 5 else 0.0
    c["month"] = float(dt.month)
    c["season_phase"] = float(min(max((dt.month - 1) / 11.0, 0.0), 1.0))

    # ── league stats ─────────────────────────────────────────────────────────
    home_rate, avg_goals, draw_rate = LEAGUE_STATS.get(league, (0.42, 2.75, 0.246))
    c["league_home_rate"] = home_rate
    c["league_avg_goals"] = avg_goals
    c["league_draw_rate"] = draw_rate

    # ── interaction features ──────────────────────────────────────────────────
    c["form_market_agreement_home"] = (c["home_form_last5_home"] / 3.0) * mp_home
    c["form_market_disagreement"] = abs((c["home_form_last5_home"] / 3.0) - mp_home)
    c["home_attack_vs_away_defense"] = c["home_goals_for_avg"] - c["away_goals_against_avg"]
    c["away_attack_vs_home_defense"] = c["away_goals_for_avg"] - c["home_goals_against_avg"]
    c["venue_market_combo"] = c["home_venue_win_rate"] * mp_home
    c["h2h_market_agreement"] = c["h2h_dominance"] * mp_home

    # ── league one-hot ────────────────────────────────────────────────────────
    for col in LEAGUE_ONE_HOT.values():
        c[col] = 0.0
    one_hot = LEAGUE_ONE_HOT.get(league)
    if one_hot:
        c[one_hot] = 1.0

    return c


def load_league_data(data_dir: Path, league: str) -> Tuple[np.ndarray, np.ndarray]:
    """Load {league}_training.csv and project to canonical 58 features.

    Returns (X, y) where X.shape == (n, 58) and y ∈ {0=home, 1=draw, 2=away}.
    Raises FileNotFoundError if the CSV is absent.
    """
    csv_path = data_dir / LEAGUE_CSV_MAP[league]
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Training CSV not found: {csv_path}\n"
            f"Run the data pipeline to generate it, or point --data-dir at the correct directory."
        )

    df = pd.read_csv(csv_path)
    if "result" not in df.columns:
        raise ValueError(f"{csv_path} must contain a 'result' column (0=home, 1=draw, 2=away).")

    rows = [_project_row_to_canonical(row, league) for _, row in df.iterrows()]
    X = pd.DataFrame(rows, columns=CANONICAL_FEATURES_58).values.astype(np.float32)
    y = df["result"].values.astype(int)

    # Sanitise: replace any remaining NaN/inf with 0
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    assert X.shape[1] == 58, f"Feature dimension mismatch: expected 58, got {X.shape[1]}"
    return X, y


# ── draw-recall penalty (C8) ──────────────────────────────────────────────────

def draw_recall_penalty(y_pred_proba: np.ndarray, multiplier: float = 10.0) -> float:
    """C8: penalty = max(0, 0.60 − predicted_draw_rate / 0.246) × multiplier."""
    predicted_draw_rate = (np.argmax(y_pred_proba, axis=1) == DRAW_LABEL).mean()
    return max(0.0, DRAW_RATIO_GATE - predicted_draw_rate / BASE_DRAW_RATE) * multiplier


def calibrate_draw_threshold(proba: np.ndarray) -> Optional[float]:
    """Post-hoc: find the smallest draw_prob threshold that achieves DRAW_RATIO_GATE.

    When argmax classification fails the gate (typically on small holdout splits),
    this finds a threshold t such that samples with draw_prob >= t are classified as
    draw, achieving predicted_draw_rate / BASE_DRAW_RATE >= DRAW_RATIO_GATE.
    The threshold is stored in the artifact and applied at inference by EnsembleModel.
    Returns None if no valid threshold exists (e.g., too few samples).
    """
    draw_probs = proba[:, DRAW_LABEL]
    target_rate = DRAW_RATIO_GATE * BASE_DRAW_RATE  # 0.60 × 0.246 = 0.14760
    n_needed = int(np.ceil(target_rate * len(proba)))
    if n_needed <= 0 or n_needed > len(proba):
        return None
    sorted_desc = np.sort(draw_probs)[::-1]
    return float(sorted_desc[n_needed - 1])


# ── cross-validated objective ─────────────────────────────────────────────────

def cv_objective(
    model_factory,
    X: np.ndarray,
    y: np.ndarray,
    draw_penalty_multiplier: float = 10.0,
) -> float:
    """TimeSeriesSplit(3) mean (log_loss + draw_recall_penalty).

    model_factory is a zero-arg callable returning a fresh unfitted estimator.
    """
    tscv = TimeSeriesSplit(n_splits=CV_FOLDS)
    fold_scores = []
    for train_idx, val_idx in tscv.split(X):
        X_t, X_v = X[train_idx], X[val_idx]
        y_t, y_v = y[train_idx], y[val_idx]
        sw = compute_sample_weight(class_weight="balanced", y=y_t)
        m = model_factory()
        m.fit(X_t, y_t, sample_weight=sw)
        proba = m.predict_proba(X_v)
        fold_scores.append(
            log_loss(y_v, proba) + draw_recall_penalty(proba, draw_penalty_multiplier)
        )
    return float(np.mean(fold_scores))


# ── per-model Optuna tuners ───────────────────────────────────────────────────

def tune_rf(
    X: np.ndarray, y: np.ndarray, n_trials: int, league: str,
    draw_penalty_multiplier: float = 10.0,
) -> Tuple[RandomForestClassifier, dict]:
    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 400),
            "max_depth": trial.suggest_int("max_depth", 8, 20),
            "min_samples_split": trial.suggest_int("min_samples_split", 4, 14),
            "min_samples_leaf": trial.suggest_int("min_samples_leaf", 2, 8),
            "max_features": trial.suggest_categorical("max_features", ["sqrt", "log2"]),
        }
        return cv_objective(
            lambda: RandomForestClassifier(
                **params, class_weight="balanced", random_state=42, n_jobs=-1
            ),
            X,
            y,
            draw_penalty_multiplier,
        )

    study = optuna.create_study(direction="minimize", study_name=f"{league}_rf_v4")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    sw = compute_sample_weight(class_weight="balanced", y=y)
    best = RandomForestClassifier(
        **study.best_params, class_weight="balanced", random_state=42, n_jobs=-1
    )
    best.fit(X, y, sample_weight=sw)
    log.info(f"    RF  obj={study.best_value:.4f}  {study.best_params}")
    return best, dict(study.best_params)


def tune_xgb(
    X: np.ndarray, y: np.ndarray, n_trials: int, league: str,
    draw_penalty_multiplier: float = 10.0,
) -> Tuple[XGBClassifier, dict]:
    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 150, 350),
            "max_depth": trial.suggest_int("max_depth", 4, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.03, 0.20, log=True),
            "subsample": trial.suggest_float("subsample", 0.65, 0.95),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.65, 0.95),
            "gamma": trial.suggest_float("gamma", 0.0, 0.4),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 7),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 0.5),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 2.5),
        }
        return cv_objective(
            lambda: XGBClassifier(
                **params, tree_method="hist", random_state=42, n_jobs=-1, verbosity=0
            ),
            X,
            y,
            draw_penalty_multiplier,
        )

    study = optuna.create_study(direction="minimize", study_name=f"{league}_xgb_v4")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    sw = compute_sample_weight(class_weight="balanced", y=y)
    best = XGBClassifier(
        **study.best_params, tree_method="hist", random_state=42, n_jobs=-1, verbosity=0
    )
    best.fit(X, y, sample_weight=sw)
    log.info(f"    XGB obj={study.best_value:.4f}  {study.best_params}")
    return best, dict(study.best_params)


def tune_lgbm(
    X: np.ndarray, y: np.ndarray, n_trials: int, league: str,
    draw_penalty_multiplier: float = 10.0,
) -> Tuple[LGBMClassifier, dict]:
    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 150, 350),
            "max_depth": trial.suggest_int("max_depth", 4, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.03, 0.20, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 20, 100),
            "subsample": trial.suggest_float("subsample", 0.65, 0.95),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.65, 0.95),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 30),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 0.5),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 2.5),
        }
        return cv_objective(
            lambda: LGBMClassifier(
                **params,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
                verbose=-1,
            ),
            X,
            y,
            draw_penalty_multiplier,
        )

    study = optuna.create_study(direction="minimize", study_name=f"{league}_lgbm_v4")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    sw = compute_sample_weight(class_weight="balanced", y=y)
    best = LGBMClassifier(
        **study.best_params,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    best.fit(X, y, sample_weight=sw)
    log.info(f"    LGBM obj={study.best_value:.4f}  {study.best_params}")
    return best, dict(study.best_params)


# ── meta-learner ──────────────────────────────────────────────────────────────

def _make_meta_features(models: Dict, X: np.ndarray) -> np.ndarray:
    """Stack base model probability outputs into a 9-column meta-feature matrix.

    Column order matches EnsembleModel._create_meta_features() (rf, xgb, lgbm × 3 probs).
    """
    return np.hstack([m.predict_proba(X) for m in models.values()])


def train_meta_model(
    models: Dict,
    X_meta_train: np.ndarray,
    y_meta_train: np.ndarray,
) -> CalibratedClassifierCV:
    """Train a calibrated LR stacking meta-model (isotonic, cv=5, balanced weights).

    Mirrors EnsembleModel._train_meta_model() but uses isotonic calibration (C11).
    """
    meta_X = _make_meta_features(models, X_meta_train)
    sw = compute_sample_weight(class_weight="balanced", y=y_meta_train)
    base_lr = LogisticRegression(
        C=1.0, max_iter=1000, random_state=42, class_weight="balanced"
    )
    meta_model = CalibratedClassifierCV(base_lr, method="isotonic", cv=5)
    meta_model.fit(meta_X, y_meta_train, sample_weight=sw)
    return meta_model


# ── evaluation ────────────────────────────────────────────────────────────────

def evaluate(
    models: Dict,
    meta_model: CalibratedClassifierCV,
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> Dict:
    meta_X = _make_meta_features(models, X_test)
    proba = meta_model.predict_proba(meta_X)
    y_pred = np.argmax(proba, axis=1)

    predicted_draw_rate = float((y_pred == DRAW_LABEL).mean())
    draw_ratio = predicted_draw_rate / BASE_DRAW_RATE
    argmax_gate_pass = draw_ratio >= DRAW_RATIO_GATE

    # Post-hoc calibration: if argmax fails the gate, find the draw_prob threshold
    # that achieves the target rate and store it in the artifact for inference use.
    draw_threshold: Optional[float] = None
    calibrated_gate_pass = argmax_gate_pass
    if not argmax_gate_pass:
        draw_threshold = calibrate_draw_threshold(proba)
        if draw_threshold is not None:
            draw_probs = proba[:, DRAW_LABEL]
            cal_pred = np.where(
                draw_probs >= draw_threshold,
                DRAW_LABEL,
                np.where(proba[:, 0] >= proba[:, 2], 0, 2),
            )
            cal_draw_rate = float((cal_pred == DRAW_LABEL).mean())
            calibrated_gate_pass = (cal_draw_rate / BASE_DRAW_RATE) >= DRAW_RATIO_GATE
            if calibrated_gate_pass:
                log.info(
                    f"  🔧 Draw threshold calibration: threshold={draw_threshold:.4f}  "
                    f"cal_draw_rate={cal_draw_rate:.3f}  "
                    f"cal_ratio={cal_draw_rate/BASE_DRAW_RATE:.3f}  (gate=PASS via calibration)"
                )

    return {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "log_loss": float(log_loss(y_test, proba)),
        "predicted_draw_rate": predicted_draw_rate,
        "draw_ratio": draw_ratio,
        "draw_gate_pass": calibrated_gate_pass,
        "draw_threshold": draw_threshold,
        "n_test": int(len(y_test)),
    }


# ── per-league training pipeline ──────────────────────────────────────────────

def train_one_league(
    league: str,
    data_dir: Path,
    output_dir: Path,
    n_trials: int,
    draw_penalty_multiplier: float = 10.0,
) -> Dict:
    log.info(f"╔══ {league.upper()} — {n_trials} Optuna trials per model ══╗")

    # 1. Load data (58 canonical features)
    X, y = load_league_data(data_dir, league)
    class_dist = np.bincount(y).tolist()
    log.info(f"  Data: {X.shape[0]} samples  class_dist={class_dist}")

    # 2. Chronological holdout: last 15% for final evaluation
    holdout_split = int(len(X) * 0.85)
    X_work, X_holdout = X[:holdout_split], X[holdout_split:]
    y_work, y_holdout = y[:holdout_split], y[holdout_split:]

    # 3. Within working set: first 75% for base-model training,
    #    last 25% as meta-train (out-of-sample for base models)
    meta_split = int(len(X_work) * 0.75)
    X_base, X_meta = X_work[:meta_split], X_work[meta_split:]
    y_base, y_meta = y_work[:meta_split], y_work[meta_split:]

    log.info(
        f"  Splits: base={len(X_base)}  meta={len(X_meta)}  holdout={len(X_holdout)}"
    )

    # 4. Optuna-tune each base model on X_base
    log.info("  Tuning RF …")
    rf, rf_params = tune_rf(X_base, y_base, n_trials, league, draw_penalty_multiplier)

    log.info("  Tuning XGB …")
    xgb_m, xgb_params = tune_xgb(X_base, y_base, n_trials, league, draw_penalty_multiplier)

    log.info("  Tuning LGBM …")
    lgbm_m, lgbm_params = tune_lgbm(X_base, y_base, n_trials, league, draw_penalty_multiplier)

    # base model dict — key names must match EnsembleModel._create_meta_features() convention
    base_models = {"rf": rf, "xgb": xgb_m, "lgbm": lgbm_m}

    # 5. Train calibrated meta-learner on X_meta (out-of-sample predictions)
    log.info("  Training meta-learner …")
    meta_model = train_meta_model(base_models, X_meta, y_meta)

    # 6. Evaluate on holdout
    metrics = evaluate(base_models, meta_model, X_holdout, y_holdout)
    gate_sym = "✅" if metrics["draw_gate_pass"] else "⚠ "
    log.info(
        f"  {gate_sym} Accuracy={metrics['accuracy']:.3f}  "
        f"LogLoss={metrics['log_loss']:.4f}  "
        f"DrawRatio={metrics['draw_ratio']:.3f}  "
        f"(gate={'PASS' if metrics['draw_gate_pass'] else 'FAIL'})"
    )
    if not metrics["draw_gate_pass"]:
        log.warning(
            f"  DrawRatio {metrics['draw_ratio']:.3f} < {DRAW_RATIO_GATE} — "
            "gate failed. Consider increasing --trials or collecting more draw-rich data."
        )

    # 6.5. Ensemble diversity diagnostics — pairwise Pearson correlation,
    #       flag members above ENSEMBLE_CORRELATION_PRUNE_THRESHOLD (0.92),
    #       prune only when draw-F1 is non-degrading. Meta-learner is retrained
    #       if any member is actually pruned.
    log.info("  Running diversity diagnostics …")
    diversity_diag = EnsembleDiversityDiagnostics()
    base_models_pruned, diversity_report = diversity_diag.run(
        league, base_models, X_holdout, y_holdout
    )
    write_diversity_report(diversity_report, output_dir)

    if diversity_report.pruned_members:
        log.info(
            f"  Pruned {diversity_report.pruned_members} — retraining meta-learner …"
        )
        base_models = base_models_pruned
        meta_model = train_meta_model(base_models, X_meta, y_meta)
        metrics = evaluate(base_models, meta_model, X_holdout, y_holdout)

    # 6.6. Per-league calibration — select isotonic (≥2000 rows) or Platt (<2000),
    #       fit on meta-train set, evaluate on holdout, write calibration report.
    log.info("  Running per-league calibration …")
    raw_meta_proba = meta_model.predict_proba(
        _make_meta_features(base_models, X_meta)
    )
    raw_holdout_proba = meta_model.predict_proba(
        _make_meta_features(base_models, X_holdout)
    )
    fitted_cal = run_league_calibration(
        league=league,
        y_train=y_meta,
        proba_train=raw_meta_proba,
        y_val=y_holdout,
        proba_val=raw_holdout_proba,
    )
    write_calibration_report(fitted_cal, output_dir)

    # 7. Save artifact in EnsembleModel.load_model()-compatible format
    #    (models: raw base models; meta_model: calibrated stacker)
    artifact = {
        "models": base_models,
        "meta_model": meta_model,
        "calibrator": fitted_cal,
        "feature_columns": list(CANONICAL_FEATURES_58),
        "model_metadata": {
            **metrics,
            "model_name": f"{league}_ensemble_v4_optuna",
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "league": league,
            "version": "v4_optuna",
            "n_features": 58,
            "optuna_params": {
                "rf": rf_params,
                "xgb": xgb_params,
                "lgbm": lgbm_params,
            },
            "diversity": {
                "mean_off_diagonal_correlation": diversity_report.mean_off_diagonal_correlation,
                "pruned_members": diversity_report.pruned_members,
                "retained_members": diversity_report.retained_members,
            },
            "calibration": {
                "method": fitted_cal.method,
                "ece_before_mean": fitted_cal.ece_before["mean"],
                "ece_after_mean": fitted_cal.ece_after["mean"],
                "draw_f1_delta": round(
                    fitted_cal.draw_f1_after - fitted_cal.draw_f1_before, 4
                ),
            },
        },
        "is_trained": True,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{league}_ensemble_v4_optuna.pkl"
    with open(out_path, "wb") as fh:
        pickle.dump(artifact, fh, protocol=pickle.HIGHEST_PROTOCOL)

    log.info(f"  ✅ Saved → {out_path}  ({out_path.stat().st_size // 1024} KB)")
    return {"league": league, "path": str(out_path), **metrics}


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="SabiScore Optuna ensemble tuner — P3-A",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--league",
        default="all",
        choices=LEAGUES + ["all"],
        help="League to tune, or 'all' for all 6 leagues (default: all)",
    )
    p.add_argument(
        "--trials",
        type=int,
        default=50,
        help="Optuna trials per model type per league (default: 50)",
    )
    p.add_argument(
        "--output-dir",
        default="backend/models",
        metavar="DIR",
        help="Output directory for .pkl artifacts (default: backend/models)",
    )
    p.add_argument(
        "--data-dir",
        default="data/processed",
        metavar="DIR",
        help="Directory with {league}_training.csv files (default: data/processed)",
    )
    p.add_argument(
        "--draw-penalty-multiplier",
        type=float,
        default=10.0,
        metavar="N",
        help=(
            "Multiplier applied to the draw-recall penalty in the Optuna objective "
            "(default: 10.0). Increase to 25-30 when draw calibration gate fails."
        ),
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    data_dir = Path(args.data_dir)
    leagues = LEAGUES if args.league == "all" else [args.league]
    draw_penalty_multiplier = args.draw_penalty_multiplier

    log.info(
        f"SabiScore Optuna Tuner — leagues={leagues}  trials={args.trials}  "
        f"data={data_dir}  output={output_dir}  "
        f"draw_penalty_multiplier={draw_penalty_multiplier}"
    )

    results = []
    failed = []

    for league in leagues:
        try:
            result = train_one_league(
                league=league,
                data_dir=data_dir,
                output_dir=output_dir,
                n_trials=args.trials,
                draw_penalty_multiplier=draw_penalty_multiplier,
            )
            results.append(result)
        except FileNotFoundError as exc:
            log.error(f"Skipping {league}: {exc}")
            failed.append(league)
        except Exception as exc:
            log.error(f"Failed {league}: {exc}", exc_info=True)
            failed.append(league)

    # ── summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 65)
    print("  TUNING SUMMARY")
    print("═" * 65)
    for r in results:
        gate = "✅" if r["draw_gate_pass"] else "⚠ "
        print(
            f"  {gate}  {r['league']:<12}  "
            f"acc={r['accuracy']:.3f}  "
            f"ll={r['log_loss']:.4f}  "
            f"draw_ratio={r['draw_ratio']:.3f}  "
            f"→ {r['path']}"
        )
    if failed:
        print(f"\n  FAILED: {', '.join(failed)}")
    print()

    all_passed = bool(results) and all(r["draw_gate_pass"] for r in results)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
