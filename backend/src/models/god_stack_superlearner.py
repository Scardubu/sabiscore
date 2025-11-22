"""God-tier Super Learner stacking pipeline.

This module implements a late-2025 style Super Learner stack inspired by
van der Laan (2007). It combines calibrated level-0 models, a constrained
meta-learner, and a final non-linear blender with optional online adapters.
The goal is to squeeze out the last percentage points of accuracy/Brier
without sacrificing inference latency.
"""
from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.isotonic import IsotonicRegression

try:  # Optional boosters
    import xgboost as xgb  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    xgb = None  # type: ignore[var-annotated]

try:
    import lightgbm as lgb  # type: ignore
except Exception:  # pragma: no cover
    lgb = None  # type: ignore[var-annotated]

try:
    from catboost import CatBoostClassifier  # type: ignore
except Exception:  # pragma: no cover
    CatBoostClassifier = None  # type: ignore[assignment]

try:  # Optional H2O stack
    import h2o  # type: ignore
    from h2o.estimators import (  # type: ignore
        H2OGradientBoostingEstimator,
        H2OStackedEnsembleEstimator,
        H2ORandomForestEstimator,
        H2ODeepLearningEstimator,
        H2OXGBoostEstimator,
    )
    H2O_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    h2o = None  # type: ignore[assignment]
    H2OGradientBoostingEstimator = None  # type: ignore[assignment]
    H2OStackedEnsembleEstimator = None  # type: ignore[assignment]
    H2ORandomForestEstimator = None  # type: ignore[assignment]
    H2ODeepLearningEstimator = None  # type: ignore[assignment]
    H2OXGBoostEstimator = None  # type: ignore[assignment]
    H2O_AVAILABLE = False

try:
    from river import compose, linear_model, multiclass, preprocessing  # type: ignore
except Exception:  # pragma: no cover
    compose = linear_model = multiclass = preprocessing = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

_PROB_COLUMNS = ["home_win_prob", "draw_prob", "away_win_prob"]
_CLASS_LABELS = ["home_win", "draw", "away_win"]


def _safe_probabilities(raw: np.ndarray) -> np.ndarray:
    clipped = np.clip(raw, 1e-6, 1 - 1e-6)
    row_sums = clipped.sum(axis=1, keepdims=True)
    return clipped / row_sums


def _multiclass_brier(y_true: np.ndarray, proba: np.ndarray) -> float:
    score = 0.0
    for idx in range(proba.shape[1]):
        binary = (y_true == idx).astype(int)
        score += brier_score_loss(binary, proba[:, idx])
    return score / proba.shape[1]


@dataclass
class AdapterTelemetry:
    name: str
    weight: float
    brier: float


class GodStackSuperLearner:
    """Multi-level stacking ensemble with Super Learner style weighting."""

    def __init__(
        self,
        *,
        n_folds: int = 5,
        random_state: int = 42,
        early_stopping_rounds: int = 50,
        brier_tolerance: float = 0.0015,
        prefer_gpu: bool = False,
        enable_online_adapter: bool = True,
        engine_preference: str = "auto",
        h2o_max_mem: str = "6G",
    ) -> None:
        self.n_folds = max(3, n_folds)
        self.random_state = random_state
        self.early_stopping_rounds = early_stopping_rounds
        self.brier_tolerance = brier_tolerance
        self.prefer_gpu = prefer_gpu
        self.enable_online_adapter = enable_online_adapter and compose is not None

        env_engine = os.getenv("SUPER_LEARNER_ENGINE", engine_preference)
        self.h2o_max_mem = os.getenv("SUPER_LEARNER_H2O_MAX_MEM", h2o_max_mem)
        self.engine_backend = self._resolve_engine(env_engine)

        self.level1_stack: Optional[StackingClassifier] = None
        self.level2_model: Optional[Any] = None
        self.scaler = StandardScaler()
        self.meta_feature_columns: List[str] = []
        self.feature_columns: List[str] = []
        self.is_fitted = False
        self.metrics: Dict[str, Any] = {}
        self.calibrators: List[IsotonicRegression] = []
        self._use_level2 = True
        self.adapter_history: List[AdapterTelemetry] = []
        self.online_adapter = None
        self.h2o_level1 = None
        self.h2o_label_column = "_outcome"
        self._class_labels = list(_CLASS_LABELS)
        self._h2o_model_bytes: Optional[bytes] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def _resolve_engine(self, preference: Optional[str]) -> str:
        pref = (preference or "auto").strip().lower()
        if pref == "auto":
            # Default to sklearn for deterministic local runs; users can
            # explicitly set SUPER_LEARNER_ENGINE=h2o when the H2O stack is
            # available and desired.
            return "sklearn"
        if pref == "h2o":
            if H2O_AVAILABLE:
                return "h2o"
            logger.warning("H2O engine requested but h2o package is unavailable; falling back to sklearn stack")
            return "sklearn"
        return "sklearn"

    def fit(self, X: pd.DataFrame, y: pd.Series) -> None:
        target = self._ensure_target(y)
        self.calibrators = []
        self.adapter_history = []
        self.online_adapter = None
        self.feature_columns = list(X.columns)

        if self.engine_backend == "h2o":
            self._fit_h2o(X, target)
        else:
            self._fit_sklearn(X, target)

        self.is_fitted = True

    def _fit_sklearn(self, X: pd.DataFrame, target: np.ndarray) -> None:
        self.level1_stack = self._build_level1()
        self.level1_stack.fit(X, target)

        level1_probs = self.level1_stack.predict_proba(X)
        meta_frame = self._build_meta_features(level1_probs, X)

        self._train_level2(meta_frame, target, backend_label="sklearn")

        if self.enable_online_adapter:
            self._fit_online_adapter(meta_frame, target)

    def _fit_h2o(self, X: pd.DataFrame, target: np.ndarray) -> None:
        if not H2O_AVAILABLE or h2o is None or H2OStackedEnsembleEstimator is None:
            raise RuntimeError("H2O Super Learner is unavailable; ensure the h2o package is installed")

        # Initialize H2O cluster before any H2O operations
        self._ensure_h2o_cluster()

        sanitized = X.reset_index(drop=True).copy()
        mapping = {0: _CLASS_LABELS[0], 1: _CLASS_LABELS[1], 2: _CLASS_LABELS[2]}
        target_series = pd.Series(target, name=self.h2o_label_column).map(mapping)
        if target_series.isnull().any():
            raise ValueError("Encountered unknown class labels while preparing Super Learner target")

        dataset = sanitized.copy()
        dataset[self.h2o_label_column] = pd.Categorical(target_series, categories=self._class_labels)

        full_frame = self._prepare_h2o_frame(dataset)
        train_frame, blend_frame, val_frame = self._split_h2o_frame(full_frame)
        feature_columns = [col for col in dataset.columns if col != self.h2o_label_column]

        base_models = self._train_h2o_level0(train_frame, blend_frame, feature_columns)
        self.h2o_level1 = self._train_h2o_superlearner(
            base_models,
            train_frame,
            blend_frame,
            val_frame,
            feature_columns,
        )

        level1_full_probs = self._extract_h2o_probabilities(
            self.h2o_level1.predict(full_frame).as_data_frame(use_pandas=True)
        )
        meta_frame = self._build_meta_features(level1_full_probs, sanitized)
        meta_frame.index = X.index

        self._train_level2(meta_frame, target, backend_label="h2o")

        if self.enable_online_adapter:
            self._fit_online_adapter(meta_frame, target)

    def _train_level2(self, meta_frame: pd.DataFrame, target: np.ndarray, backend_label: str) -> None:
        X_meta_train, X_meta_val, y_meta_train, y_meta_val = train_test_split(
            meta_frame,
            target,
            test_size=0.2,
            stratify=target,
            random_state=self.random_state,
        )

        self.level2_model = self._build_level2(meta_frame.shape[1])
        eval_set = [(X_meta_val, y_meta_val)]
        self.level2_model.fit(
            X_meta_train,
            y_meta_train,
            eval_set=eval_set,
            verbose=False,
        )

        level2_val_probs = self.level2_model.predict_proba(X_meta_val)
        level1_val_probs = meta_frame.loc[X_meta_val.index, _PROB_COLUMNS].values

        level1_brier = _multiclass_brier(y_meta_val, level1_val_probs)
        level2_brier = _multiclass_brier(y_meta_val, level2_val_probs)

        if level2_brier > level1_brier - self.brier_tolerance:
            logger.warning(
                "Level-2 meta underperformed on %s backend (Brier %.4f vs %.4f); falling back to level-1",
                backend_label,
                level2_brier,
                level1_brier,
            )
            self._use_level2 = False
            base_val_probs = level1_val_probs
        else:
            self._use_level2 = True
            base_val_probs = level2_val_probs

        self._fit_isotonic_calibrators(base_val_probs, y_meta_val)

        self.metrics = {
            "level1_accuracy": float(
                accuracy_score(y_meta_val, level1_val_probs.argmax(axis=1))
            ),
            "level1_brier": float(level1_brier),
            "level2_brier": float(level2_brier),
            "final_accuracy": float(
                accuracy_score(y_meta_val, base_val_probs.argmax(axis=1))
            ),
            "final_brier": float(_multiclass_brier(y_meta_val, base_val_probs)),
            "final_log_loss": float(log_loss(y_meta_val, base_val_probs, labels=[0, 1, 2])),
            "brier_guardrail_triggered": not self._use_level2,
            "engine_backend": backend_label,
        }

    def predict(self, X: pd.DataFrame) -> pd.DataFrame:
        proba = self.predict_proba(X)
        df = pd.DataFrame(proba, columns=_PROB_COLUMNS)
        df["prediction"] = df[_PROB_COLUMNS].idxmax(axis=1)
        df["prediction"] = df["prediction"].map(
            {
                "home_win_prob": "home_win",
                "draw_prob": "draw",
                "away_win_prob": "away_win",
            }
        )
        df["confidence"] = df[_PROB_COLUMNS].max(axis=1)
        return df

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Super Learner not fitted yet")

        if self.engine_backend == "h2o":
            probs, meta_frame = self._predict_proba_h2o(X)
        else:
            probs, meta_frame = self._predict_proba_sklearn(X)

        if self.calibrators:
            probs = self._apply_calibrators(probs)

        if self.online_adapter is not None and meta_frame is not None:
            probs = self._blend_online_adapter(meta_frame, probs)

        return _safe_probabilities(probs)

    def _predict_proba_sklearn(self, X: pd.DataFrame) -> Tuple[np.ndarray, pd.DataFrame]:
        if self.level1_stack is None:
            raise RuntimeError("Level-1 sklearn stack not available")
        level1_probs = self.level1_stack.predict_proba(X)
        meta_frame = self._build_meta_features(level1_probs, X)
        if self._use_level2 and self.level2_model is not None:
            probs = self.level2_model.predict_proba(meta_frame)
        else:
            probs = level1_probs
        return probs, meta_frame

    def _predict_proba_h2o(self, X: pd.DataFrame) -> Tuple[np.ndarray, Optional[pd.DataFrame]]:
        if self.h2o_level1 is None:
            raise RuntimeError("H2O Super Learner not trained")

        sanitized = X.reset_index(drop=True).copy()
        feature_frame = self._to_h2o_features_frame(sanitized)
        level1_probs = self._extract_h2o_probabilities(
            self.h2o_level1.predict(feature_frame).as_data_frame(use_pandas=True)
        )
        meta_frame = self._build_meta_features(level1_probs, sanitized)
        meta_frame.index = X.index

        if self._use_level2 and self.level2_model is not None:
            probs = self.level2_model.predict_proba(meta_frame)
        else:
            probs = level1_probs

        return probs, meta_frame

    # ------------------------------------------------------------------
    # Builders
    # ------------------------------------------------------------------
    def _build_level1(self) -> StackingClassifier:
        estimators: List[Tuple[str, BaseEstimator]] = []

        if xgb is not None:
            estimators.append(
                (
                    "xgb",
                    xgb.XGBClassifier(
                        n_estimators=900,
                        max_depth=5,
                        learning_rate=0.03,
                        subsample=0.85,
                        colsample_bytree=0.7,
                        objective="multi:softprob",
                        eval_metric="mlogloss",
                        random_state=self.random_state,
                        tree_method="hist" if not self.prefer_gpu else "gpu_hist",
                    ),
                )
            )

        if lgb is not None:
            estimators.append(
                (
                    "lgbm",
                    lgb.LGBMClassifier(
                        n_estimators=1400,
                        learning_rate=0.025,
                        num_leaves=48,
                        subsample=0.9,
                        colsample_bytree=0.8,
                        min_child_samples=30,
                        reg_lambda=0.6,
                        random_state=self.random_state,
                        n_jobs=-1,
                    ),
                )
            )

        if CatBoostClassifier is not None:
            estimators.append(
                (
                    "catboost",
                    CatBoostClassifier(
                        iterations=800,
                        depth=6,
                        learning_rate=0.05,
                        loss_function="MultiClass",
                        verbose=False,
                        random_seed=self.random_state,
                    ),
                )
            )

        estimators.append(
            (
                "extra_trees",
                ExtraTreesClassifier(
                    n_estimators=600,
                    max_depth=None,
                    max_features="sqrt",
                    min_samples_split=4,
                    min_samples_leaf=2,
                    bootstrap=False,
                    n_jobs=-1,
                    random_state=self.random_state,
                ),
            )
        )

        estimators.append(
            (
                "hist_gbm",
                HistGradientBoostingClassifier(
                    max_iter=700,
                    max_leaf_nodes=63,
                    learning_rate=0.04,
                    l2_regularization=0.03,
                    random_state=self.random_state,
                ),
            )
        )

        meta = Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "logreg",
                    LogisticRegression(
                        penalty="elasticnet",
                        l1_ratio=0.35,
                        solver="saga",
                        multi_class="multinomial",
                        max_iter=1500,
                        random_state=self.random_state,
                    ),
                ),
            ]
        )

        cv = StratifiedKFold(n_splits=self.n_folds, shuffle=True, random_state=self.random_state)
        stack = StackingClassifier(
            estimators=estimators,
            final_estimator=meta,
            cv=cv,
            stack_method="predict_proba",
            passthrough=False,
            n_jobs=-1,
        )
        return stack

    def _build_level2(self, feature_dim: int):
        if xgb is None:
            raise RuntimeError("XGBoost is required for level-2 meta learning")
        return xgb.XGBClassifier(
            n_estimators=600,
            max_depth=4,
            learning_rate=0.02,
            subsample=0.8,
            colsample_bytree=0.9,
            reg_alpha=0.1,
            reg_lambda=1.4,
            objective="multi:softprob",
            eval_metric="mlogloss",
            random_state=self.random_state,
            tree_method="hist" if not self.prefer_gpu else "gpu_hist",
            early_stopping_rounds=self.early_stopping_rounds,
        )

    # ------------------------------------------------------------------
    # H2O helpers
    # ------------------------------------------------------------------
    def _ensure_h2o_cluster(self) -> None:
        if not H2O_AVAILABLE or h2o is None:
            return
        try:
            conn = h2o.connection()
            if conn is None:
                raise RuntimeError("H2O connection() returned None")
            logger.info("H2O cluster already connected")
        except Exception as e:
            logger.info("H2O cluster not connected, initializing with max_mem=%s: %s", self.h2o_max_mem, e)
            h2o.init(max_mem_size=self.h2o_max_mem, nthreads=-1, log_level="WARN")
            logger.info("H2O cluster initialized successfully")
            try:
                h2o.no_progress()
            except Exception:
                pass

    def _serialize_h2o_model(self, model) -> Optional[bytes]:
        if model is None:
            return None
        if not H2O_AVAILABLE or h2o is None:
            raise RuntimeError("Cannot serialize H2O model without h2o dependency")
        self._ensure_h2o_cluster()
        scratch = tempfile.mkdtemp(prefix="sabiscore_h2o_")
        try:
            model_path = h2o.save_model(model=model, path=scratch, force=True)
            with open(model_path, "rb") as fh:
                return fh.read()
        finally:
            shutil.rmtree(scratch, ignore_errors=True)

    def _restore_h2o_model(self, payload: Optional[bytes]):
        if payload is None:
            return None
        if not H2O_AVAILABLE or h2o is None:
            raise RuntimeError(
                "Cannot restore H2O Super Learner because the h2o package is unavailable"
            )
        self._ensure_h2o_cluster()
        scratch = tempfile.mkdtemp(prefix="sabiscore_h2o_")
        try:
            model_path = os.path.join(scratch, "model.zip")
            with open(model_path, "wb") as fh:
                fh.write(payload)
            return h2o.load_model(model_path)
        finally:
            shutil.rmtree(scratch, ignore_errors=True)

    def _prepare_h2o_frame(self, df: pd.DataFrame):  # type: ignore[override]
        self._ensure_h2o_cluster()
        frame = h2o.H2OFrame(df)
        frame[self.h2o_label_column] = frame[self.h2o_label_column].asfactor()
        return frame

    def _to_h2o_features_frame(self, df: pd.DataFrame):
        self._ensure_h2o_cluster()
        return h2o.H2OFrame(df)

    def _split_h2o_frame(self, frame):
        splits = frame.split_frame(ratios=[0.7, 0.15], seed=self.random_state)
        train_frame = splits[0]
        blend_frame = splits[1] if len(splits) > 1 else None
        val_frame = splits[2] if len(splits) > 2 else None

        if blend_frame is None or blend_frame.nrows == 0:
            blend_frame = train_frame
        if val_frame is None or val_frame.nrows == 0:
            val_frame = blend_frame
        return train_frame, blend_frame, val_frame

    def _train_h2o_level0(self, train_frame, blend_frame, feature_columns: List[str]):
        models = []
        train_kwargs: Dict[str, Any] = {
            "x": feature_columns,
            "y": self.h2o_label_column,
            "training_frame": train_frame,
        }

        # Try XGBoost if available (may not be in all H2O builds)
        if H2OXGBoostEstimator is not None:
            try:
                xgb_params = dict(
                    ntrees=1200,
                    learn_rate=0.01,
                    sample_rate=0.75,
                    col_sample_rate=0.7,
                    seed=self.random_state,
                )
                xgb_model = H2OXGBoostEstimator(**xgb_params)
                xgb_model.train(**train_kwargs)
                models.append(xgb_model)
                logger.info("H2O XGBoost model trained successfully")
            except Exception as e:
                logger.warning("H2O XGBoost not available in this build, skipping: %s", e)

        if H2OGradientBoostingEstimator is not None:
            gbm_model = H2OGradientBoostingEstimator(
                ntrees=900,
                learn_rate=0.008,
                sample_rate=0.85,
                col_sample_rate=0.8,
                seed=self.random_state,
            )
            gbm_model.train(**train_kwargs)
            models.append(gbm_model)

        if H2ODeepLearningEstimator is not None:
            dl_model = H2ODeepLearningEstimator(
                hidden=[512, 256],
                epochs=120,
                activation="rectifier_with_dropout",
                input_dropout_ratio=0.1,
                hidden_dropout_ratios=[0.1, 0.1],
                seed=self.random_state,
            )
            dl_model.train(**train_kwargs)
            models.append(dl_model)

        if H2ORandomForestEstimator is not None:
            rf_model = H2ORandomForestEstimator(
                ntrees=600,
                mtries=-1,
                sample_rate=0.9,
                seed=self.random_state,
            )
            rf_model.train(**train_kwargs)
            models.append(rf_model)

        if not models:
            raise RuntimeError("No H2O base models could be initialized")
        return models

    def _train_h2o_superlearner(
        self,
        base_models: Sequence[Any],
        train_frame,
        blend_frame,
        val_frame,
        feature_columns: List[str],
    ):
        model_ids = [model.model_id for model in base_models]
        ensemble = H2OStackedEnsembleEstimator(
            base_models=model_ids,
            metalearner_algorithm="glm",
            metalearner_params={
                "lambda_search": True,
                "family": "multinomial",
            },
            metalearner_nfolds=self.n_folds,
        )
        train_kwargs: Dict[str, Any] = {
            "x": feature_columns,
            "y": self.h2o_label_column,
            "training_frame": train_frame,
        }
        if blend_frame is not None:
            train_kwargs["blending_frame"] = blend_frame
        if val_frame is not None:
            train_kwargs["validation_frame"] = val_frame
        ensemble.train(**train_kwargs)
        return ensemble

    def _extract_h2o_probabilities(self, predictions: pd.DataFrame) -> np.ndarray:
        prob_columns: List[str] = []
        for label in self._class_labels:
            canonical = f"p{label}"
            alt = canonical.replace("_", ".")
            if canonical in predictions.columns:
                prob_columns.append(canonical)
            elif alt in predictions.columns:
                prob_columns.append(alt)
            elif label in predictions.columns:
                prob_columns.append(label)

        if len(prob_columns) != len(self._class_labels):
            fallback = [col for col in predictions.columns if col.startswith("p") or col in self._class_labels]
            if len(fallback) < len(self._class_labels):
                logger.error("H2O prediction columns: %s", list(predictions.columns))
                raise RuntimeError("Unable to extract probability columns from H2O predictions")
            prob_columns = fallback[: len(self._class_labels)]

        return predictions[prob_columns].to_numpy()

    # ------------------------------------------------------------------
    # Feature engineering helpers
    # ------------------------------------------------------------------
    def _build_meta_features(self, probs: np.ndarray, X: pd.DataFrame) -> pd.DataFrame:
        df = pd.DataFrame(probs, columns=_PROB_COLUMNS, index=X.index)
        df["prob_max"] = df.max(axis=1)
        df["prob_min"] = df.min(axis=1)
        df["prob_range"] = df["prob_max"] - df["prob_min"]
        df["entropy"] = -np.sum(probs * np.log(np.clip(probs, 1e-6, 1)), axis=1) / np.log(probs.shape[1])
        df["home_minus_away"] = df["home_win_prob"] - df["away_win_prob"]
        df["draw_gap"] = df["draw_prob"] - df[["home_win_prob", "away_win_prob"]].mean(axis=1)
        df["max_vs_draw"] = df["prob_max"] - df["draw_prob"]
        df["confidence_curve"] = df["prob_max"] / (df[["home_win_prob", "draw_prob", "away_win_prob"]].std(axis=1) + 1e-4)
        df["home_edge_hint"] = (X.get("home_form_5", 0) - X.get("away_form_5", 0)) if "home_form_5" in X else 0
        df["value_signal"] = X.get("value_signal", 0) if "value_signal" in X else 0
        self.meta_feature_columns = list(df.columns)
        return df

    # ------------------------------------------------------------------
    # Calibration / Online adapters
    # ------------------------------------------------------------------
    def _fit_isotonic_calibrators(self, probs: np.ndarray, y_true: np.ndarray) -> None:
        self.calibrators = []
        for class_idx in range(probs.shape[1]):
            binary = (y_true == class_idx).astype(int)
            iso = IsotonicRegression(out_of_bounds="clip")
            iso.fit(probs[:, class_idx], binary)
            self.calibrators.append(iso)

    def _apply_calibrators(self, probs: np.ndarray) -> np.ndarray:
        adjusted = probs.copy()
        for idx, iso in enumerate(self.calibrators):
            adjusted[:, idx] = iso.predict(probs[:, idx])
        return _safe_probabilities(adjusted)

    def _fit_online_adapter(self, meta_frame: pd.DataFrame, y: np.ndarray) -> None:
        if compose is None or multiclass is None:
            return
        pipeline = compose.Pipeline(
            preprocessing.StandardScaler(),
            linear_model.LogisticRegression()
        )
        adapter = multiclass.OneVsRestClassifier(pipeline)
        records = meta_frame.to_dict(orient="records")
        for features, target in zip(records, y):
            adapter = adapter.learn_one(features, int(target))
        self.online_adapter = adapter

    def _blend_online_adapter(self, meta_frame: pd.DataFrame, base_probs: np.ndarray) -> np.ndarray:
        assert self.online_adapter is not None
        records = meta_frame.to_dict(orient="records")
        river_preds = np.zeros_like(base_probs)
        for idx, features in enumerate(records):
            pred = self.online_adapter.predict_proba_one(features) or {}
            river_preds[idx, 0] = pred.get(0, 1e-6)
            river_preds[idx, 1] = pred.get(1, 1e-6)
            river_preds[idx, 2] = pred.get(2, 1e-6)
        river_brier = _multiclass_brier(np.argmax(base_probs, axis=1), river_preds)
        base_brier = _multiclass_brier(np.argmax(base_probs, axis=1), base_probs)
        weight = float(np.clip((base_brier - river_brier) * 2.5, 0.05, 0.25)) if river_brier < base_brier else 0.05
        blended = (1 - weight) * base_probs + weight * river_preds
        self.adapter_history.append(AdapterTelemetry("river_online", weight, river_brier))
        return _safe_probabilities(blended)

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    def __getstate__(self) -> Dict[str, Any]:  # pragma: no cover - exercised indirectly
        state = self.__dict__.copy()
        if self.engine_backend == "h2o":
            state["_h2o_model_bytes"] = self._serialize_h2o_model(self.h2o_level1)
            state["h2o_level1"] = None
        return state

    def __setstate__(self, state: Dict[str, Any]) -> None:  # pragma: no cover - exercised indirectly
        payload = state.pop("_h2o_model_bytes", None)
        self.__dict__.update(state)
        self._h2o_model_bytes = None
        if self.engine_backend == "h2o" and payload is not None:
            self.h2o_level1 = self._restore_h2o_model(payload)

    @staticmethod
    def _ensure_target(y: Union[pd.Series, np.ndarray]) -> np.ndarray:
        if isinstance(y, pd.DataFrame):
            data = y.iloc[:, 0].values
        elif isinstance(y, pd.Series):
            data = y.values
        else:
            data = y
        return data.ravel().astype(int)