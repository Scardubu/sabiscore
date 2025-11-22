import json
import logging
import os
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import joblib
import pandas as pd

from .god_stack_superlearner import GodStackSuperLearner
from .sota_stack import SotaStackingEnsemble
from ..core.config import settings

logger = logging.getLogger(__name__)


class ModelLoadError(Exception):
    """Raised when a model file cannot be loaded or is invalid."""


class EnsembleModel:
    """Facade over the Super Learner stack with optional SOTA stacking."""

    def __init__(
        self,
        *,
        models_path: Optional[Union[str, Path]] = None,
        optimize: bool = False,
        super_learner_kwargs: Optional[Dict[str, Any]] = None,
        enable_sota_stack: Optional[bool] = None,
        sota_kwargs: Optional[Dict[str, Any]] = None,
    ):
        """Initialize ensemble facade."""
        self.optimize = optimize
        self.models: Dict[str, Any] = {}  # legacy artifacts
        self.meta_model: Optional[Any] = None  # legacy artifact
        self.feature_columns: List[str] = []
        self.model_metadata: Dict[str, Any] = {}
        self.is_trained = False
        self.super_learner: Optional[GodStackSuperLearner] = None
        self.super_learner_kwargs = super_learner_kwargs or {}
        env_flag = os.getenv("ENABLE_SOTA_STACK")
        self.enable_sota_stack = (
            enable_sota_stack
            if enable_sota_stack is not None
            else env_flag is not None and env_flag.lower() in {"1", "true", "yes", "on"}
        )
        self.sota_kwargs = sota_kwargs or {}
        self.sota_stack: Optional[SotaStackingEnsemble] = None
        self.models_path = Path(models_path) if models_path else settings.models_path
        self.models_path.mkdir(parents=True, exist_ok=True)
        self.league: Optional[str] = None

    def build_ensemble(self, X: pd.DataFrame, y: pd.DataFrame, *, league: Optional[str] = None) -> None:
        """Train the God Stack Super Learner."""
        try:
            logger.info("Building GodStack Super Learner ensemble...")
            target = self._extract_target(y)
            self.feature_columns = list(X.columns)
            self.league = league or self.league

            self.super_learner = GodStackSuperLearner(**self.super_learner_kwargs)
            self.super_learner.fit(X, target)
            self.is_trained = True
            self.model_metadata = self._build_metadata(len(X))
            if self.league:
                self.model_metadata.setdefault("league", self.league)

            if self.enable_sota_stack and SotaStackingEnsemble.is_available():
                try:
                    logger.info("Training AutoGluon SOTA stacking layer")
                    sota_params = dict(self.sota_kwargs)
                    sota_params.setdefault("predictor_path", self.models_path)
                    self.sota_stack = SotaStackingEnsemble(**sota_params)
                    self.sota_stack.fit(X, target)
                    self.model_metadata.update(
                        {
                            "sota_accuracy": self.sota_stack.metrics.get("blend_accuracy"),
                            "sota_brier": self.sota_stack.metrics.get("blend_brier"),
                            "sota_log_loss": self.sota_stack.metrics.get("blend_log_loss"),
                            "sota_engine": self.sota_stack.metrics.get("engine"),
                            "sota_component_weights": self.sota_stack.metrics.get("component_weights"),
                        }
                    )
                except Exception as exc:  # pragma: no cover - optional path
                    logger.warning("SOTA stacking layer failed: %s", exc)
                    self.sota_stack = None
            elif self.enable_sota_stack:
                logger.warning("ENABLE_SOTA_STACK=1 but autogluon.tabular is not installed")

            logger.info("Super Learner ensemble built successfully")

        except Exception as exc:
            logger.error("Failed to build Super Learner ensemble: %s", exc)
            raise

    def get_metadata(self) -> Dict[str, Any]:
        """Return a shallow copy of model metadata for inspection/tests."""
        return dict(self.model_metadata)

    def _create_meta_features(self, X: pd.DataFrame) -> pd.DataFrame:
        """Legacy helper retained for backward-compatible inference."""
        meta_features = pd.DataFrame()

        for model_name, model in self.models.items():
            probs = model.predict_proba(X)

            if probs.shape[1] > 2:
                meta_features[f"{model_name}_prob_home"] = probs[:, 0]
                meta_features[f"{model_name}_prob_draw"] = probs[:, 1]
                meta_features[f"{model_name}_prob_away"] = probs[:, 2]
            else:
                meta_features[f"{model_name}_prob"] = probs[:, 1]

        return meta_features

    def predict(self, X: pd.DataFrame) -> pd.DataFrame:
        """Make predictions with either the new or legacy ensemble."""
        if not self.is_trained:
            raise ValueError("Model not trained yet")

        if self.super_learner is not None and getattr(self.super_learner, "is_fitted", False):
            sanitized = self._sanitize_features(X)
            return self._predict_super_learner(sanitized)

        return self._predict_legacy(X)

    def _predict_super_learner(self, X: pd.DataFrame) -> pd.DataFrame:
        if self.super_learner is None:
            raise RuntimeError("Super Learner not initialised")

        prob_columns = ["home_win", "draw", "away_win"]
        prediction_frame: Optional[pd.DataFrame] = None

        if hasattr(self.super_learner, "predict"):
            try:
                raw_preds = self.super_learner.predict(X)
                if isinstance(raw_preds, pd.DataFrame):
                    prediction_frame = raw_preds.copy()
            except Exception:  # pragma: no cover - fall back gracefully
                logger.debug("Super Learner predict path failed, falling back to predict_proba", exc_info=True)

        if prediction_frame is None and hasattr(self.super_learner, "predict_proba"):
            probs = self.super_learner.predict_proba(X)
            prediction_frame = pd.DataFrame(probs, columns=["home_win_prob", "draw_prob", "away_win_prob"], index=X.index)

        if prediction_frame is None:
            raise RuntimeError("Super Learner does not provide predict or predict_proba outputs")

        if set(prob_columns).issubset(prediction_frame.columns):
            df = prediction_frame[prob_columns].copy()
        else:
            alt_columns = ["home_win_prob", "draw_prob", "away_win_prob"]
            if not set(alt_columns).issubset(prediction_frame.columns):
                raise RuntimeError("Super Learner predictions missing probability columns")
            rename_map = dict(zip(alt_columns, prob_columns))
            df = prediction_frame[alt_columns].rename(columns=rename_map)

        if self.sota_stack is not None:
            try:
                blended = self.sota_stack.blend_with_super_learner(df[prob_columns].to_numpy(), X)
                df = pd.DataFrame(blended, columns=prob_columns, index=X.index)
            except Exception:  # pragma: no cover - blending is optional
                logger.warning("Failed to blend AutoGluon predictions", exc_info=True)

        return df[prob_columns]

    def _predict_legacy(self, X: pd.DataFrame) -> pd.DataFrame:
        """Legacy prediction path for pre-Super Learner artifacts."""
        try:
            X = X.fillna(X.mean())
            if X.isnull().any().any():
                logger.warning("NaN values still present after fillna, filling with 0")
                X = X.fillna(0)

            meta_features = self._create_meta_features(X)
            probs = self.meta_model.predict_proba(meta_features)

            results = pd.DataFrame({
                "home_win_prob": probs[:, 0],
                "draw_prob": probs[:, 1],
                "away_win_prob": probs[:, 2],
            })

            results["prediction"] = results[["home_win_prob", "draw_prob", "away_win_prob"]].idxmax(axis=1)
            results["prediction"] = results["prediction"].map(
                {
                    "home_win_prob": "home_win",
                    "draw_prob": "draw",
                    "away_win_prob": "away_win",
                }
            )
            results["confidence"] = results[["home_win_prob", "draw_prob", "away_win_prob"]].max(axis=1)
            return results

        except Exception as exc:
            logger.error("Legacy prediction failed: %s", exc)
            raise

    def explain_predictions(self, X: pd.DataFrame) -> Dict[str, Any]:
        """Generate SHAP explanations for predictions"""
        try:
            # Mock SHAP implementation - replace with actual SHAP
            explanations = {
                'feature_importance': {
                    'home_attack_strength': 0.15,
                    'away_defense_strength': 0.12,
                    'home_win_rate': 0.10,
                    'head_to_head_home_wins': 0.08,
                    'home_possession_avg': 0.07
                },
                'waterfall_plot_data': {
                    'base_value': 0.33,
                    'feature_contributions': [
                        {'feature': 'home_attack_strength', 'contribution': 0.15},
                        {'feature': 'away_defense_strength', 'contribution': -0.08}
                    ]
                }
            }
            return explanations
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return {}

    def _sanitize_features(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = X.copy()
        if self.feature_columns:
            missing = [col for col in self.feature_columns if col not in frame.columns]
            for column in missing:
                frame[column] = 0.0
            frame = frame[self.feature_columns]
        frame = frame.fillna(0.0)
        return frame

    def _build_metadata(self, sample_count: int) -> Dict[str, Any]:
        metrics = getattr(self.super_learner, "metrics", {}) if self.super_learner else {}
        metadata = {
            "accuracy": metrics.get("final_accuracy") or metrics.get("level1_accuracy"),
            "brier_score": metrics.get("final_brier") or metrics.get("level1_brier"),
            "log_loss": metrics.get("final_log_loss"),
            "trained_at": datetime.utcnow().isoformat(),
            "feature_count": len(self.feature_columns),
            "engine": "god_stack_superlearner",
            "engine_backend": metrics.get("engine_backend"),
            "level1_accuracy": metrics.get("level1_accuracy"),
            "level1_brier": metrics.get("level1_brier"),
            "brier_guardrail_triggered": metrics.get("brier_guardrail_triggered"),
            "training_samples": sample_count,
        }
        if self.sota_stack is not None and self.sota_stack.metrics:
            metadata.update(
                {
                    "sota_accuracy": self.sota_stack.metrics.get("final_accuracy"),
                    "sota_brier": self.sota_stack.metrics.get("final_brier"),
                    "sota_log_loss": self.sota_stack.metrics.get("final_log_loss"),
                }
            )
        return {key: value for key, value in metadata.items() if value is not None}

    @staticmethod
    def _extract_target(y: pd.DataFrame) -> pd.Series:
        if isinstance(y, pd.DataFrame):
            return y.iloc[:, 0].astype(int)
        if isinstance(y, pd.Series):
            return y.astype(int)
        return pd.Series(y).astype(int)

    def save_model(self, destination: Optional[Union[str, Path]] = None, model_name: Optional[str] = None) -> Path:
        """Persist the ensemble to disk.

        Supports both directory targets (plus optional model_name) and direct
        file paths ending in .pkl for backward compatibility with existing
        training scripts and unit tests.
        """
        try:
            target = Path(destination) if destination else self.models_path
            if target.suffix == ".pkl":
                model_path = target
                model_path.parent.mkdir(parents=True, exist_ok=True)
                metadata_path = model_path.with_name(f"{model_path.stem}_metadata.json")
            else:
                model_dir = target
                model_dir.mkdir(parents=True, exist_ok=True)
                model_id = model_name or "ensemble"
                model_path = model_dir / f"{model_id}.pkl"
                metadata_path = model_dir / f"{model_id}_metadata.json"

            model_data = {
                "models": self.models,
                "meta_model": self.meta_model,
                "feature_columns": self.feature_columns,
                "model_metadata": self.model_metadata,
                "is_trained": self.is_trained,
                "super_learner": self.super_learner,
                "sota_stack": self.sota_stack,
            }

            joblib.dump(model_data, model_path)

            with metadata_path.open("w", encoding="utf-8") as f:
                json.dump(self.model_metadata, f, indent=2)

            logger.info("Model saved to %s", model_path)
            return model_path

        except Exception as e:
            logger.error("Failed to save model: %s", e)
            raise

    @classmethod
    def load_model(
        cls,
        model_path: Union[str, Path],
        *,
        models_path: Optional[Union[str, Path]] = None,
    ) -> 'SabiScoreEnsemble':
        """Load model from disk"""
        model_path = Path(model_path)
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        try:
            # Quick sanity checks before attempting to unpickle
            size = os.path.getsize(model_path)
            if size == 0:
                raise ModelLoadError(f"Model file appears empty: {model_path}")

            # Try to read a few bytes to detect obvious truncation
            with open(model_path, 'rb') as fh:
                head = fh.read(8)
                if len(head) < 4:
                    raise ModelLoadError(f"Model file too small/corrupt: {model_path}")

            # Use joblib to load; catch pickle/unpickle related errors explicitly
            model_data = joblib.load(model_path)

            instance = cls(models_path=models_path or model_path.parent)
            if 'super_learner' in model_data and model_data['super_learner'] is not None:
                instance.super_learner = model_data['super_learner']
                instance.feature_columns = model_data.get('feature_columns', [])
                instance.model_metadata = model_data.get('model_metadata', {})
                instance.is_trained = model_data.get('is_trained', False)
                instance.sota_stack = model_data.get('sota_stack')
            else:
                instance.models = model_data['models']
                instance.meta_model = model_data['meta_model']
                instance.feature_columns = model_data.get('feature_columns', [])
                instance.model_metadata = model_data.get('model_metadata', {})
                instance.is_trained = model_data.get('is_trained', False)

            metadata_file = model_path.with_name(f"{model_path.stem}_metadata.json")
            if metadata_file.exists():
                try:
                    with metadata_file.open("r", encoding="utf-8") as meta_fh:
                        instance.model_metadata = json.load(meta_fh)
                except Exception:
                    logger.warning("Failed to read metadata file %s", metadata_file)

            logger.info(f"Model loaded from {model_path}")
            return instance

        except (EOFError, pickle.UnpicklingError, IndexError, TypeError) as e:
            # These are commonly raised when the file is truncated or corrupt
            logger.exception(f"Failed to unpickle model file {model_path}: {e}")
            raise ModelLoadError(f"Failed to unpickle model file {model_path}: {e}") from e
        except Exception as e:
            # Convert to a more specific exception so callers can handle
            logger.exception(f"Failed to load model file {model_path}: {e}")
            raise ModelLoadError(f"Failed to load model file {model_path}: {e}") from e

    @classmethod
    def load_latest_model(cls, models_path: str) -> 'SabiScoreEnsemble':
        """Load the latest trained model"""
        # Validate path
        if not os.path.exists(models_path) or not os.path.isdir(models_path):
            raise FileNotFoundError(f"Models path not found or is not a directory: {models_path}")

        # Find candidate model files (newest first)
        model_files = [f for f in os.listdir(models_path) if f.endswith('.pkl')]
        if not model_files:
            raise FileNotFoundError(f"No model files found in {models_path}")

        model_files.sort(key=lambda x: os.path.getmtime(os.path.join(models_path, x)), reverse=True)

        last_exc: Optional[Exception] = None

        for candidate in model_files:
            model_path = os.path.join(models_path, candidate)
            try:
                size = os.path.getsize(model_path)
            except OSError:
                logger.warning(f"Could not stat model file {model_path}, skipping")
                continue

            # Skip obviously tiny files (likely incomplete uploads)
            if size < 10_240:  # 10KB
                logger.warning(f"Skipping candidate {candidate} (size={size} bytes) - too small to be a valid model")
                continue

            try:
                logger.info(f"Attempting to load model candidate: {model_path}")
                return cls.load_model(model_path, models_path=models_path)
            except ModelLoadError as mle:
                # Log and try next candidate
                logger.warning(f"Model candidate {candidate} is invalid: {mle}")
                last_exc = mle
            except Exception as e:
                logger.exception(f"Unexpected error loading model candidate {candidate}: {e}")
                last_exc = e

        # If we get here, no candidates succeeded
        msg = f"No valid model files found in {models_path}. Tried: {model_files}"
        logger.error(msg)
        if last_exc:
            raise RuntimeError(msg) from last_exc
        raise RuntimeError(msg)


# Backward compatibility alias
SabiScoreEnsemble = EnsembleModel
