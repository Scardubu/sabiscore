"""AutoGluon-powered SOTA stacking ensemble.

This module optionally layers an AutoGluon TabularPredictor on top of the
existing feature space to capture late-2025 best practices (multimodal
ensembles, automated calibration, dynamic weighting). It is designed to be a
non-breaking enhancement: if AutoGluon isn't installed the coordinator simply
skips this stage while preserving the legacy Super Learner pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss
from sklearn.preprocessing import StandardScaler

from ..core.config import settings

logger = logging.getLogger(__name__)

try:  # pragma: no cover - optional heavy dependency
    from autogluon.tabular import TabularPredictor  # type: ignore

    AUTOGLUON_AVAILABLE = True
except Exception:  # pragma: no cover
    TabularPredictor = None  # type: ignore[assignment]
    AUTOGLUON_AVAILABLE = False

try:  # pragma: no cover - optional transformer-based adapter
    from tabpfn.scripts.transformer_prediction_interface import TabPFNClassifier  # type: ignore

    TABPFN_AVAILABLE = True
except Exception:  # pragma: no cover
    TabPFNClassifier = None  # type: ignore[assignment]
    TABPFN_AVAILABLE = False

try:  # pragma: no cover - optional River streaming adapter
    from river import (
        compose as river_compose,  # type: ignore
        linear_model as river_linear_model,  # type: ignore
        multiclass as river_multiclass,  # type: ignore
        optim as river_optim,  # type: ignore
        preprocessing as river_preprocessing,  # type: ignore
    )

    RIVER_AVAILABLE = True
except Exception:  # pragma: no cover
    river_compose = river_linear_model = river_multiclass = river_optim = river_preprocessing = None  # type: ignore[assignment]
    RIVER_AVAILABLE = False


_CLASS_LABELS = ("home_win", "draw", "away_win")
_DEFAULT_PRESETS = "best_quality"
_DEFAULT_HPARAMS = "multimodal"


@dataclass
class BlendComponent:
    name: str
    brier: float
    weight_hint: float
    weight: float = 0.0


def _safe_probabilities(raw: np.ndarray) -> np.ndarray:
    clipped = np.clip(raw, 1e-6, 1 - 1e-6)
    row_sums = clipped.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    return clipped / row_sums


class SotaStackingEnsemble:
    """Wrapper around AutoGluon TabularPredictor with blending helpers."""

    def __init__(
        self,
        *,
        time_limit: int = 3600,
        presets: str = _DEFAULT_PRESETS,
        hyperparameters: str | Dict[str, Any] | None = _DEFAULT_HPARAMS,
        calibration: bool = True,
        artifact_subdir: str = "autogluon_sota",
        predictor_path: Optional[Path] = None,
        blend_floor: float = 0.25,
        blend_ceiling: float = 0.4,
        prefer_gpu: bool = False,
        enable_tabpfn_adapter: bool = True,
        enable_river_adapter: bool = True,
        tabpfn_max_samples: int = 20000,
        river_max_samples: int = 60000,
        river_learning_rate: float = 0.05,
        component_weight_hints: Optional[Dict[str, float]] = None,
    ) -> None:
        self.time_limit = time_limit
        self.presets = presets
        self.hyperparameters = hyperparameters
        self.calibration = calibration
        self.metrics: Dict[str, Any] = {}
        self._class_labels: List[str] = list(_CLASS_LABELS)
        self._artifact_root = (predictor_path or settings.models_path).joinpath(artifact_subdir)
        self._artifact_root.mkdir(parents=True, exist_ok=True)
        self._predictor_dir: Optional[Path] = None
        self._predictor: Optional[TabularPredictor] = None  # type: ignore[assignment]
        self._blend_floor = blend_floor
        self._blend_ceiling = blend_ceiling
        self.enabled = AUTOGLUON_AVAILABLE
        self.prefer_gpu = prefer_gpu
        self.enable_tabpfn_adapter = enable_tabpfn_adapter and TABPFN_AVAILABLE
        self.enable_river_adapter = enable_river_adapter and RIVER_AVAILABLE
        self.tabpfn_max_samples = max(1000, tabpfn_max_samples)
        self.river_max_samples = max(1000, river_max_samples)
        self.river_learning_rate = max(1e-4, river_learning_rate)
        self._tabpfn_state: Optional[Dict[str, Any]] = None
        self._river_pipeline = None
        self._components: List[BlendComponent] = []
        self._feature_columns: List[str] = []
        self._component_weight_hints = {
            "autogluon": 0.6,
            "tabpfn": 0.25,
            "river": 0.15,
        }
        if component_weight_hints:
            self._component_weight_hints.update(component_weight_hints)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def fit(self, X: pd.DataFrame, y: pd.Series) -> None:
        if not AUTOGLUON_AVAILABLE or TabularPredictor is None:
            raise RuntimeError(
                "AutoGluon Tabular is not installed. Install autogluon.tabular to enable SOTA stacking."
            )

        self._predictor_dir = self._allocate_artifact_dir()
        target = self._map_target(y)
        encoded_target = self._encode_target(target)
        self._feature_columns = list(X.columns)
        self._components = []
        training_frame = X.reset_index(drop=True).copy()
        training_frame["outcome"] = target

        logger.info(
            "AutoGluon SOTA stack: training on %s samples (%s features)",
            len(training_frame),
            len(X.columns),
        )

        self._predictor = TabularPredictor(
            label="outcome",
            path=str(self._predictor_dir),
            problem_type="multiclass",
            eval_metric="log_loss",
        )
        self._predictor.fit(
            train_data=training_frame,
            time_limit=self.time_limit,
            presets=self.presets,
            hyperparameters=self.hyperparameters,
            verbosity=1,
            ag_args_fit={"calibrate": self.calibration},
        )
        try:
            self._predictor.persist_models()
        except Exception:  # pragma: no cover - best effort
            logger.debug("Unable to persist AutoGluon models immediately", exc_info=True)

        eval_summary = self._safe_evaluate(training_frame)

        # Register AutoGluon component first so weights always sum to >= blend floor.
        autogluon_probs = self._predict_autogluon(X)
        ag_brier = self._compute_brier(encoded_target, autogluon_probs)
        self._register_component(
            name="autogluon",
            brier=ag_brier,
            weight_hint=self._component_weight_hints.get("autogluon", 0.6),
        )

        tabpfn_brier = self._try_train_tabpfn_adapter(X, encoded_target)
        if tabpfn_brier is not None:
            self._register_component(
                name="tabpfn",
                brier=tabpfn_brier,
                weight_hint=self._component_weight_hints.get("tabpfn", 0.25),
            )

        river_brier = self._try_train_river_adapter(X, encoded_target)
        if river_brier is not None:
            self._register_component(
                name="river",
                brier=river_brier,
                weight_hint=self._component_weight_hints.get("river", 0.15),
            )

        self._normalize_component_weights()
        blend_probs = self._aggregate_component_probabilities(X)
        blend_brier = self._compute_brier(encoded_target, blend_probs)
        blend_accuracy = float((encoded_target == blend_probs.argmax(axis=1)).mean())
        try:
            blend_log_loss = float(
                log_loss(
                    encoded_target,
                    blend_probs,
                    labels=list(range(len(self._class_labels))),
                )
            )
        except ValueError:
            blend_log_loss = None

        self.metrics = {
            "engine": "autogluon",
            "autogluon_accuracy": float(eval_summary.get("accuracy", 0.0)),
            "autogluon_brier": float(eval_summary.get("brier_loss", 0.0)),
            "autogluon_log_loss": float(eval_summary.get("log_loss", 0.0)),
            "blend_accuracy": blend_accuracy,
            "blend_brier": float(blend_brier),
            "blend_log_loss": blend_log_loss,
            "leaderboard_models": eval_summary.get("models"),
            "component_weights": {
                comp.name: {
                    "weight": comp.weight,
                    "brier": comp.brier,
                }
                for comp in self._components
            },
            "tabpfn_enabled": bool(self._tabpfn_state),
            "river_enabled": bool(self._river_pipeline),
        }

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        predictor = self._ensure_predictor()
        if predictor is None:
            raise RuntimeError("AutoGluon predictor unavailable; ensure fit() was called successfully")

        features = self._sanitize_features(X)
        proba = self._aggregate_component_probabilities(features)
        return _safe_probabilities(proba)

    def blend_with_super_learner(self, base_probs: np.ndarray, X: pd.DataFrame) -> np.ndarray:
        """Blend AutoGluon probabilities with the existing Super Learner output."""
        sota_probs = self.predict_proba(X)
        sota_brier = self.metrics.get("blend_brier") or self.metrics.get("autogluon_brier") or 0.0
        blend_weight = self._derive_weight(sota_brier)
        logger.debug(
            "Blending AutoGluon predictions (weight=%.3f, brier=%.4f)", blend_weight, sota_brier
        )
        blended = (1 - blend_weight) * base_probs + blend_weight * sota_probs
        return _safe_probabilities(blended)

    @staticmethod
    def is_available() -> bool:
        return AUTOGLUON_AVAILABLE

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _ensure_predictor(self) -> Optional[TabularPredictor]:  # type: ignore[override]
        if self._predictor is not None:
            return self._predictor
        if self._predictor_dir is None:
            return None
        if not AUTOGLUON_AVAILABLE or TabularPredictor is None:
            logger.warning("Cannot reload AutoGluon predictor because autogluon is missing")
            return None
        if not self._predictor_dir.exists():
            logger.error("AutoGluon artifact directory %s missing", self._predictor_dir)
            return None
        self._predictor = TabularPredictor.load(str(self._predictor_dir))
        return self._predictor

    def _allocate_artifact_dir(self) -> Path:
        unique = uuid.uuid4().hex[:8]
        path = self._artifact_root / f"run_{unique}"
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)
        path.mkdir(parents=True, exist_ok=True)
        return path

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------
    def _map_target(self, y: pd.Series) -> pd.Series:
        mapping = {
            0: _CLASS_LABELS[0],
            1: _CLASS_LABELS[1],
            2: _CLASS_LABELS[2],
            "home_win": _CLASS_LABELS[0],
            "draw": _CLASS_LABELS[1],
            "away_win": _CLASS_LABELS[2],
        }
        mapped = y.map(mapping) if hasattr(y, "map") else pd.Series(y).map(mapping)
        if mapped.isnull().any():
            raise ValueError("Encountered unknown class labels while preparing AutoGluon target")
        return mapped.astype("category")

    def _derive_weight(self, sota_brier: float) -> float:
        if sota_brier <= 0:
            return self._blend_ceiling
        # Lower Brier => higher confidence weight, clamped to [floor, ceiling]
        normalized = max(0.0, min(1.0, 0.18 / sota_brier))
        weight = self._blend_floor + normalized * (self._blend_ceiling - self._blend_floor)
        return float(max(self._blend_floor, min(self._blend_ceiling, weight)))

    def _encode_target(self, y: pd.Series) -> np.ndarray:
        mapping = {label: idx for idx, label in enumerate(self._class_labels)}
        encoded = y.map(mapping)
        if encoded.isnull().any():
            raise ValueError("Unable to encode class labels for SOTA stacking")
        return encoded.to_numpy(dtype=int)

    def _sanitize_features(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = X.copy()
        if self._feature_columns:
            missing = [col for col in self._feature_columns if col not in frame.columns]
            for column in missing:
                frame[column] = 0.0
            frame = frame[self._feature_columns]
        return frame.reset_index(drop=True)

    def _predict_autogluon(self, X: pd.DataFrame) -> np.ndarray:
        predictor = self._ensure_predictor()
        if predictor is None:
            raise RuntimeError("AutoGluon predictor unavailable; ensure fit() was called successfully")
        features = X.reset_index(drop=True).copy()
        proba_frame = predictor.predict_proba(features, as_pandas=True)
        return self._reindex_probability_frame(proba_frame)

    def _reindex_probability_frame(self, proba_frame: pd.DataFrame) -> np.ndarray:
        arranged = []
        for label in self._class_labels:
            if label in proba_frame.columns:
                arranged.append(proba_frame[label].to_numpy())
            else:  # pragma: no cover - defensive path
                arranged.append(np.zeros(len(proba_frame)))
        stacked = np.vstack(arranged).T
        return _safe_probabilities(stacked)

    def _register_component(self, name: str, brier: float, weight_hint: float) -> None:
        if not np.isfinite(brier) or brier <= 0:
            return
        filtered = [comp for comp in self._components if comp.name != name]
        filtered.append(
            BlendComponent(
                name=name,
                brier=float(brier),
                weight_hint=max(weight_hint, 0.01),
            )
        )
        self._components = filtered

    def _normalize_component_weights(self) -> None:
        if not self._components:
            return
        scores: List[float] = []
        for comp in self._components:
            score = comp.weight_hint / max(comp.brier, 1e-4)
            if comp.brier <= 0.15:
                score *= 1.2
            elif comp.brier >= 0.27:
                score *= 0.6
            comp.weight = score
            scores.append(score)
        total = sum(scores)
        if total <= 0:
            even_weight = 1.0 / len(self._components)
            for comp in self._components:
                comp.weight = even_weight
            return
        for comp in self._components:
            comp.weight = comp.weight / total

    def _get_component_predictor(self, name: str) -> Optional[Callable[[pd.DataFrame], np.ndarray]]:
        if name == "autogluon":
            return self._predict_autogluon
        if name == "tabpfn" and self._tabpfn_state is not None:
            return self._predict_tabpfn
        if name == "river" and self._river_pipeline is not None:
            return self._predict_river
        return None

    def _aggregate_component_probabilities(self, X: pd.DataFrame) -> np.ndarray:
        if not self._components:
            return self._predict_autogluon(X)
        total = np.zeros((len(X), len(self._class_labels)), dtype=float)
        applied_weight = 0.0
        for component in self._components:
            if component.weight <= 0:
                continue
            predictor_fn = self._get_component_predictor(component.name)
            if predictor_fn is None:
                continue
            try:
                contrib = predictor_fn(X)
            except Exception:  # pragma: no cover - defensive to avoid inference crashes
                logger.warning("SOTA component '%s' failed during predict", component.name, exc_info=True)
                continue
            total += component.weight * contrib
            applied_weight += component.weight
        if applied_weight <= 0:
            return self._predict_autogluon(X)
        return _safe_probabilities(total)

    def _compute_brier(self, y_true: np.ndarray, probs: np.ndarray) -> float:
        if probs.size == 0:
            return 1.0
        score = 0.0
        for idx in range(min(probs.shape[1], len(self._class_labels))):
            actual = (y_true == idx).astype(float)
            diff = probs[:, idx] - actual
            score += np.mean(diff ** 2)
        classes = max(1, min(probs.shape[1], len(self._class_labels)))
        return float(score / classes)

    def _align_component_probs(self, raw: np.ndarray, sample_count: int) -> np.ndarray:
        aligned = np.zeros((sample_count, len(self._class_labels)))
        cols = min(raw.shape[1], len(self._class_labels))
        aligned[:, :cols] = raw[:, :cols]
        return _safe_probabilities(aligned)

    def _try_train_tabpfn_adapter(self, X: pd.DataFrame, target: np.ndarray) -> Optional[float]:
        if not self.enable_tabpfn_adapter or TabPFNClassifier is None:
            return None
        sample_limit = min(len(X), self.tabpfn_max_samples)
        if sample_limit < 50:
            return None
        try:
            subset = X.iloc[:sample_limit].copy()
            scaler = StandardScaler()
            scaled = scaler.fit_transform(subset.values.astype(np.float32))
            classifier = TabPFNClassifier(
                device="cuda" if self.prefer_gpu else "cpu",
                N_ensemble_configurations=32,
            )
            classifier.fit(scaled.astype(np.float32), target[:sample_limit])
            raw_probs = classifier.predict_proba(scaled.astype(np.float32))
            probs = self._align_component_probs(raw_probs, sample_limit)
            self._tabpfn_state = {
                "classifier": classifier,
                "scaler": scaler,
                "columns": list(subset.columns),
            }
            return self._compute_brier(target[:sample_limit], probs)
        except Exception:  # pragma: no cover - optional dependency
            logger.warning("TabPFN adapter training failed; continuing without it", exc_info=True)
            self._tabpfn_state = None
            return None

    def _predict_tabpfn(self, X: pd.DataFrame) -> np.ndarray:
        if not self._tabpfn_state:
            raise RuntimeError("TabPFN adapter unavailable")
        classifier = self._tabpfn_state["classifier"]
        scaler = self._tabpfn_state["scaler"]
        columns = self._tabpfn_state["columns"]
        frame = X.copy()
        missing = [col for col in columns if col not in frame.columns]
        for column in missing:
            frame[column] = 0.0
        ordered = frame[columns]
        scaled = scaler.transform(ordered.values.astype(np.float32))
        raw = classifier.predict_proba(scaled.astype(np.float32))
        return self._align_component_probs(raw, len(ordered))

    def _try_train_river_adapter(self, X: pd.DataFrame, target: np.ndarray) -> Optional[float]:
        if not self.enable_river_adapter or not RIVER_AVAILABLE:
            return None
        sample_limit = min(len(X), self.river_max_samples)
        if sample_limit < 50:
            return None
        try:
            pipeline = river_compose.Pipeline(
                river_preprocessing.StandardScaler(),
                river_multiclass.OneVsRestClassifier(
                    river_linear_model.LogisticRegression(
                        optimizer=river_optim.SGD(self.river_learning_rate)
                    )
                ),
            )
            subset = X.iloc[:sample_limit]
            labels = target[:sample_limit]
            records = subset.to_dict(orient="records")
            for row, label in zip(records, labels):
                pipeline = pipeline.learn_one({k: float(v) for k, v in row.items()}, int(label))
            probs = []
            for row in records:
                proba_dict = pipeline.predict_proba_one({k: float(v) for k, v in row.items()}) or {}
                probs.append([float(proba_dict.get(idx, 0.0)) for idx in range(len(self._class_labels))])
            probs_arr = _safe_probabilities(np.asarray(probs, dtype=float))
            self._river_pipeline = pipeline
            return self._compute_brier(labels, probs_arr)
        except Exception:  # pragma: no cover - optional dependency
            logger.warning("River online adapter training failed; continuing without it", exc_info=True)
            self._river_pipeline = None
            return None

    def _predict_river(self, X: pd.DataFrame) -> np.ndarray:
        if self._river_pipeline is None:
            raise RuntimeError("River adapter unavailable")
        records = X.to_dict(orient="records")
        probs = []
        for row in records:
            proba_dict = self._river_pipeline.predict_proba_one({k: float(v) for k, v in row.items()}) or {}
            probs.append([float(proba_dict.get(idx, 0.0)) for idx in range(len(self._class_labels))])
        return _safe_probabilities(np.asarray(probs, dtype=float))

    def _safe_evaluate(self, frame: pd.DataFrame) -> Dict[str, Any]:
        predictor = self._ensure_predictor()
        if predictor is None:
            return {}
        try:
            metrics = predictor.evaluate(frame, silent=True)
        except Exception:  # pragma: no cover - evaluation best effort
            logger.debug("AutoGluon evaluation failed", exc_info=True)
            metrics = {}
        try:
            leaderboard = predictor.leaderboard(frame, silent=True)
            metrics["models"] = leaderboard.head(5).to_dict(orient="records")
        except Exception:  # pragma: no cover
            logger.debug("AutoGluon leaderboard fetch failed", exc_info=True)
        return metrics

    # ------------------------------------------------------------------
    # Pickle support (joblib persistence)
    # ------------------------------------------------------------------
    def __getstate__(self) -> Dict[str, Any]:  # pragma: no cover - exercised via joblib
        state = self.__dict__.copy()
        state["_predictor"] = None  # reload lazily on demand
        state["_river_pipeline"] = None
        state["_tabpfn_state"] = None
        state["_components"] = [
            comp for comp in state.get("_components", []) if comp.name == "autogluon"
        ]
        return state

    def __setstate__(self, state: Dict[str, Any]) -> None:  # pragma: no cover - exercised via joblib
        self.__dict__.update(state)
        self._components = []
        if self._predictor is None:
            self._ensure_predictor()
        if self._predictor:
            # Re-register AutoGluon component after deserialization
            ag_brier = 0.20  # conservative estimate until re-evaluated
            self._register_component(
                name="autogluon",
                brier=ag_brier,
                weight_hint=self._component_weight_hints.get("autogluon", 0.6),
            )
            self._normalize_component_weights()


__all__ = ["SotaStackingEnsemble"]
