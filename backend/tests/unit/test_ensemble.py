"""Tests for ML ensemble model."""
from unittest.mock import MagicMock, patch
import numpy as np
import pandas as pd
import pytest

from src.models.ensemble import SabiScoreEnsemble


@pytest.fixture
def sample_training_data():
    """Sample training data for model testing (with integer-coded targets: 0=home_win, 1=draw, 2=away_win)."""
    return pd.DataFrame({
        "home_goals_avg": [1.8, 2.1, 1.5, 2.2, 1.9, 1.7, 2.0, 1.6, 2.3, 1.4],
        "away_goals_avg": [1.2, 1.8, 1.9, 1.3, 1.6, 1.4, 1.5, 1.7, 1.1, 2.0],
        "home_win_rate": [0.6, 0.7, 0.4, 0.8, 0.5, 0.6, 0.7, 0.4, 0.8, 0.5],
        "away_win_rate": [0.4, 0.5, 0.6, 0.3, 0.4, 0.5, 0.6, 0.4, 0.3, 0.5],
        "result": [0, 1, 2, 0, 1, 2, 0, 1, 2, 0]  # 0=home_win, 1=draw, 2=away_win
    })


def test_ensemble_initialization():
    """Test ensemble model can be initialized."""
    model = SabiScoreEnsemble()
    assert model.models == {}
    assert not model.is_trained


def test_ensemble_predict_untrained(sample_training_data):
    """Test prediction fails gracefully when model is untrained."""
    model = SabiScoreEnsemble()
    
    with pytest.raises(Exception):  # Should raise an error for untrained model
        model.predict(sample_training_data.drop("result", axis=1))


def test_ensemble_basic_functionality():
    """Test basic ensemble functionality with minimal mocking."""
    model = SabiScoreEnsemble()
    
    # Test that we can save/load (even if not trained)
    import tempfile
    import os
    
    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = os.path.join(tmpdir, "test_model.pkl")
        metadata_path = os.path.join(tmpdir, "test_model_metadata.json")
        
        # Mock the joblib and json operations
        with patch("joblib.dump") as mock_dump, \
             patch("json.dump") as mock_json_dump:
            
            model.save_model(tmpdir, "test_model")
            assert mock_dump.called
            assert mock_json_dump.called


def test_super_learner_training(sample_training_data):
    """Test that build_ensemble uses GodStackSuperLearner."""
    model = SabiScoreEnsemble()
    X = sample_training_data.drop("result", axis=1)
    y = sample_training_data[["result"]]
    
    # Mock GodStackSuperLearner
    with patch("src.models.ensemble.GodStackSuperLearner") as mock_god_stack:
        mock_instance = MagicMock()
        mock_instance.fit.return_value = None
        mock_instance.metrics = {
            "level1_accuracy": 0.85,
            "brier_guardrail_triggered": False,
            "final_log_loss": 0.45,
            "final_accuracy": 0.87,
            "final_brier": 0.12
        }
        mock_god_stack.return_value = mock_instance
        
        model.build_ensemble(X, y)
        
        # Verify GodStackSuperLearner was instantiated and trained
        mock_god_stack.assert_called_once()
        mock_instance.fit.assert_called_once()
        
        # Verify model is trained and has Super Learner
        assert model.is_trained
        assert model.super_learner is mock_instance
        assert model.model_metadata["engine"] == "god_stack_superlearner"
        assert "level1_accuracy" in model.model_metadata
        assert "brier_guardrail_triggered" in model.model_metadata
        assert "log_loss" in model.model_metadata


def test_super_learner_prediction(sample_training_data):
    """Test that predict uses GodStackSuperLearner when available."""
    model = SabiScoreEnsemble()
    X = sample_training_data.drop("result", axis=1)
    
    # Mock trained GodStackSuperLearner
    mock_super_learner = MagicMock()
    mock_super_learner.is_fitted = True  # Must be fitted to use Super Learner path
    mock_super_learner.predict.return_value = pd.DataFrame({
        "home_win": [0.6, 0.3, 0.2],
        "draw": [0.2, 0.3, 0.3],
        "away_win": [0.2, 0.4, 0.5]
    })
    
    model.super_learner = mock_super_learner
    model.is_trained = True
    model.feature_columns = X.columns.tolist()
    
    predictions = model.predict(X.head(3))
    
    # Verify Super Learner was called
    mock_super_learner.predict.assert_called_once()
    
    # Verify predictions have correct shape and format
    assert isinstance(predictions, pd.DataFrame)
    assert len(predictions) == 3
    assert "home_win" in predictions.columns
    assert "draw" in predictions.columns
    assert "away_win" in predictions.columns


def test_legacy_ensemble_fallback(sample_training_data):
    """Test that ensemble falls back to legacy path when Super Learner unavailable."""
    model = SabiScoreEnsemble()
    X = sample_training_data.drop("result", axis=1)
    
    # Mock legacy models and meta model
    mock_xgb = MagicMock()
    mock_xgb.predict_proba.return_value = np.array([[0.5, 0.3, 0.2], [0.3, 0.4, 0.3], [0.2, 0.3, 0.5]])
    
    mock_lgbm = MagicMock()
    mock_lgbm.predict_proba.return_value = np.array([[0.6, 0.2, 0.2], [0.4, 0.3, 0.3], [0.1, 0.4, 0.5]])
    
    mock_meta = MagicMock()
    mock_meta.predict_proba.return_value = np.array([[0.55, 0.25, 0.20], [0.35, 0.35, 0.30], [0.15, 0.35, 0.50]])
    
    model.models = {
        "xgboost": mock_xgb,
        "lightgbm": mock_lgbm,
    }
    model.meta_model = mock_meta
    model.is_trained = True
    model.feature_columns = X.columns.tolist()
    model.super_learner = None  # Explicitly no Super Learner
    
    predictions = model.predict(X.head(3))
    
    # Verify legacy models were called
    mock_xgb.predict_proba.assert_called_once()
    mock_lgbm.predict_proba.assert_called_once()
    mock_meta.predict_proba.assert_called_once()
    
    # Verify predictions exist (from meta model)
    assert isinstance(predictions, pd.DataFrame)
    assert len(predictions) == 3


def test_metadata_serialization(sample_training_data):
    """Test that Super Learner metadata is correctly saved and can be loaded."""
    import tempfile
    import os
    import json
    
    model = SabiScoreEnsemble()
    X = sample_training_data.drop("result", axis=1)
    y = sample_training_data[["result"]]
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock GodStackSuperLearner
        with patch("src.models.ensemble.GodStackSuperLearner") as mock_god_stack:
            mock_instance = MagicMock()
            mock_instance.metrics = {
                "level1_accuracy": 0.88,
                "brier_guardrail_triggered": True,
                "final_log_loss": 0.38,
                "final_accuracy": 0.90,
                "final_brier": 0.10
            }
            mock_god_stack.return_value = mock_instance
            
            # Build ensemble
            model.build_ensemble(X, y)
            
            # Save model (mocking only joblib dump, not json dump)
            with patch("joblib.dump"):
                model.save_model(tmpdir, "test_sl_model")
            
            # Verify metadata file was written with correct Super Learner fields
            metadata_path = os.path.join(tmpdir, "test_sl_model_metadata.json")
            assert os.path.exists(metadata_path)
            
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            
            assert metadata["engine"] == "god_stack_superlearner"
            assert "level1_accuracy" in metadata
            assert "brier_guardrail_triggered" in metadata
            assert "log_loss" in metadata
            assert metadata["level1_accuracy"] == 0.88
            assert metadata["brier_guardrail_triggered"] is True
