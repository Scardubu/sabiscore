import pandas as pd
import numpy as np
import joblib
import os
import json
import pickle
from typing import Dict, List, Any, Optional, Tuple
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
import xgboost as xgb
import lightgbm as lgb
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ModelLoadError(Exception):
    """Raised when a model file cannot be loaded or is invalid."""


class SabiScoreEnsemble:
    """Ensemble model for football match predictions"""

    def __init__(self):
        self.models = {}
        self.meta_model = None
        self.feature_columns = []
        self.model_metadata = {}
        self.is_trained = False

    def build_ensemble(self, X: pd.DataFrame, y: pd.DataFrame) -> None:
        """Build the ensemble model"""
        try:
            logger.info("Building ensemble model...")

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )

            # Train base models
            self._train_base_models(X_train, y_train)

            # Create meta features
            meta_features_train = self._create_meta_features(X_train)
            meta_features_test = self._create_meta_features(X_test)

            # Train meta model
            self._train_meta_model(meta_features_train, y_train, meta_features_test, y_test)

            self.is_trained = True

            # Evaluate ensemble
            self._evaluate_ensemble(X_test, y_test)

            logger.info("Ensemble model built successfully")

        except Exception as e:
            logger.error(f"Failed to build ensemble: {e}")
            raise

    def _train_base_models(self, X: pd.DataFrame, y: pd.DataFrame) -> None:
        """Train base models"""
        logger.info("Training base models...")

        # Random Forest
        rf_model = RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1
        )
        rf_model.fit(X, y.values.ravel())
        self.models['random_forest'] = rf_model

        # XGBoost
        xgb_model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        )
        xgb_model.fit(X, y.values.ravel())
        self.models['xgboost'] = xgb_model

        # LightGBM
        lgb_model = lgb.LGBMClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
            verbose=-1
        )
        lgb_model.fit(X, y.values.ravel())
        self.models['lightgbm'] = lgb_model

        logger.info("Base models trained")

    def _create_meta_features(self, X: pd.DataFrame) -> pd.DataFrame:
        """Create meta features from base model predictions"""
        meta_features = pd.DataFrame()

        for model_name, model in self.models.items():
            # Get probability predictions
            probs = model.predict_proba(X)

            # For multiclass, take probability of positive class (home win)
            if probs.shape[1] > 2:
                meta_features[f'{model_name}_prob_home'] = probs[:, 0]  # Home win probability
                meta_features[f'{model_name}_prob_draw'] = probs[:, 1]  # Draw probability
                meta_features[f'{model_name}_prob_away'] = probs[:, 2]  # Away win probability
            else:
                meta_features[f'{model_name}_prob'] = probs[:, 1]

        return meta_features

    def _train_meta_model(self, X_meta: pd.DataFrame, y: pd.DataFrame,
                         X_meta_test: pd.DataFrame, y_test: pd.DataFrame) -> None:
        """Train meta model"""
        logger.info("Training meta model...")

        # Use Logistic Regression as meta model
        self.meta_model = LogisticRegression(
            random_state=42,
            max_iter=1000,
            multi_class='ovr'
        )

        self.meta_model.fit(X_meta, y.values.ravel())

        # Evaluate meta model
        meta_accuracy = self.meta_model.score(X_meta_test, y_test.values.ravel())
        logger.info(f"Meta model accuracy: {meta_accuracy:.4f}")

    def _evaluate_ensemble(self, X_test: pd.DataFrame, y_test: pd.DataFrame) -> None:
        """Evaluate ensemble performance"""
        logger.info("Evaluating ensemble...")

        # Get predictions
        predictions = self.predict(X_test)

        # Work with 1D target labels for metric calculations
        y_true = y_test['result'] if isinstance(y_test, pd.DataFrame) else y_test

        # Map predicted outcome strings back to encoded integers
        label_mapping = {'home_win': 0, 'draw': 1, 'away_win': 2}
        predicted_labels = predictions['prediction'].map(label_mapping)

        # Calculate metrics
        accuracy = accuracy_score(y_true, predicted_labels)

        # Brier score for probability calibration - use multiclass version
        # For multiclass, calculate Brier score for each class and average
        brier = 0.0
        for label_idx, prob_column in enumerate(['home_win_prob', 'draw_prob', 'away_win_prob']):
            y_binary = (y_true == label_idx).astype(int)
            probs = predictions[prob_column]
            brier += brier_score_loss(y_binary, probs)
        brier /= 3

        # Log loss (explicitly pass label ordering to match probability columns)
        logloss = log_loss(y_true, predictions[['home_win_prob', 'draw_prob', 'away_win_prob']].values, labels=[0, 1, 2])

        logger.info(f"Ensemble Evaluation:")
        logger.info(f"  Accuracy: {accuracy:.4f}")
        logger.info(f"  Brier Score: {brier:.4f}")
        logger.info(f"  Log Loss: {logloss:.4f}")

        self.model_metadata = {
            'accuracy': accuracy,
            'brier_score': brier,
            'log_loss': logloss,
            'trained_at': datetime.utcnow().isoformat(),
            'feature_count': len(self.feature_columns)
        }

    def predict(self, X: pd.DataFrame) -> pd.DataFrame:
        """Make predictions with the ensemble"""
        if not self.is_trained:
            raise ValueError("Model not trained yet")

        try:
            # Handle missing values
            X = X.fillna(X.mean())
            
            # Ensure no NaN values remain
            if X.isnull().any().any():
                logger.warning("NaN values still present after fillna, filling with 0")
                X = X.fillna(0)
            # Get meta features
            meta_features = self._create_meta_features(X)

            # Get meta model predictions
            probs = self.meta_model.predict_proba(meta_features)

            # Create results DataFrame
            results = pd.DataFrame({
                'home_win_prob': probs[:, 0],
                'draw_prob': probs[:, 1],
                'away_win_prob': probs[:, 2]
            })

            # Get prediction (highest probability)
            results['prediction'] = results[['home_win_prob', 'draw_prob', 'away_win_prob']].idxmax(axis=1)
            results['prediction'] = results['prediction'].map({
                'home_win_prob': 'home_win',
                'draw_prob': 'draw',
                'away_win_prob': 'away_win'
            })

            # Calculate confidence
            results['confidence'] = results[['home_win_prob', 'draw_prob', 'away_win_prob']].max(axis=1)

            return results

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
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

    def save_model(self, path: str, model_name: str = "ensemble") -> None:
        """Save model to disk"""
        try:
            os.makedirs(path, exist_ok=True)

            model_data = {
                'models': self.models,
                'meta_model': self.meta_model,
                'feature_columns': self.feature_columns,
                'model_metadata': self.model_metadata,
                'is_trained': self.is_trained
            }

            model_path = os.path.join(path, f"{model_name}.pkl")
            joblib.dump(model_data, model_path)

            # Save metadata
            metadata_path = os.path.join(path, f"{model_name}_metadata.json")
            with open(metadata_path, 'w') as f:
                json.dump(self.model_metadata, f, indent=2)

            logger.info(f"Model saved to {model_path}")

        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            raise

    @classmethod
    def load_model(cls, model_path: str) -> 'SabiScoreEnsemble':
        """Load model from disk"""
        if not os.path.exists(model_path):
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

            instance = cls()
            instance.models = model_data['models']
            instance.meta_model = model_data['meta_model']
            instance.feature_columns = model_data.get('feature_columns', [])
            instance.model_metadata = model_data.get('model_metadata', {})
            instance.is_trained = model_data.get('is_trained', False)

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
                return cls.load_model(model_path)
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
