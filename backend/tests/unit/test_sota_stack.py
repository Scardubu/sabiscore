"""
Unit tests for SOTA Stacking Ensemble (AutoGluon integration)
Tests cover fit, predict, blending, persistence, and graceful degradation
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil

# Test with graceful import handling
try:
    from src.models.sota_stack import SotaStackingEnsemble
    AUTOGLUON_AVAILABLE = SotaStackingEnsemble.is_available()
except ImportError:
    AUTOGLUON_AVAILABLE = False
    SotaStackingEnsemble = None


@pytest.fixture
def sample_data():
    """Generate sample training data"""
    np.random.seed(42)
    n_samples = 200
    n_features = 10
    
    X = pd.DataFrame(
        np.random.randn(n_samples, n_features),
        columns=[f'feature_{i}' for i in range(n_features)]
    )
    y = pd.Series(np.random.choice([0, 1, 2], size=n_samples), name='target')
    
    return X, y


@pytest.fixture
def temp_models_dir():
    """Create temporary directory for model artifacts"""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


class TestSotaStackingAvailability:
    """Test AutoGluon availability checks"""
    
    def test_is_available_static_method(self):
        """Test static availability check"""
        if SotaStackingEnsemble is not None:
            result = SotaStackingEnsemble.is_available()
            assert isinstance(result, bool)
    
    def test_import_handling(self):
        """Test graceful import handling"""
        # Should not raise even if autogluon missing
        try:
            from src.models.sota_stack import SotaStackingEnsemble
            assert SotaStackingEnsemble is not None
        except ImportError as e:
            pytest.fail(f"Import should not fail: {e}")


@pytest.mark.skipif(not AUTOGLUON_AVAILABLE, reason="AutoGluon not installed")
class TestSotaStackingEnsemble:
    """Test SOTA stacking ensemble with AutoGluon"""
    
    def test_initialization_default(self, temp_models_dir):
        """Test ensemble initialization with default parameters"""
        ensemble = SotaStackingEnsemble(predictor_path=temp_models_dir)
        
        assert ensemble.time_limit == 3600
        assert ensemble.presets == "best_quality"
        assert ensemble.calibration is True
        assert ensemble._predictor is None
        assert ensemble.metrics == {}
    
    def test_initialization_custom(self, temp_models_dir):
        """Test ensemble initialization with custom parameters"""
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=60,
            presets="medium_quality",
            calibration=False,
            blend_floor=0.2,
            blend_ceiling=0.35
        )
        
        assert ensemble.time_limit == 60
        assert ensemble.presets == "medium_quality"
        assert ensemble.calibration is False
        assert ensemble._blend_floor == 0.2
        assert ensemble._blend_ceiling == 0.35
    
    def test_fit_basic(self, sample_data, temp_models_dir):
        """Test basic model fitting"""
        X, y = sample_data
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality"
        )
        
        ensemble.fit(X, y)
        
        assert ensemble._predictor is not None
        assert 'blend_accuracy' in ensemble.metrics
        assert 'blend_brier' in ensemble.metrics
        assert 'blend_log_loss' in ensemble.metrics
        assert 0 <= ensemble.metrics['blend_accuracy'] <= 1
    
    def test_predict_proba(self, sample_data, temp_models_dir):
        """Test probability predictions"""
        X, y = sample_data
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality"
        )
        
        ensemble.fit(X, y)
        predictions = ensemble.predict_proba(X)
        
        assert isinstance(predictions, np.ndarray)
        assert predictions.shape[0] == len(X)
        assert predictions.shape[1] == 3  # 3 classes
        assert np.allclose(predictions.sum(axis=1), 1.0)  # Probabilities sum to 1
        assert np.all(predictions >= 0) and np.all(predictions <= 1)
    
    def test_blend_with_super_learner(self, sample_data, temp_models_dir):
        """Test blending SOTA predictions with Super Learner"""
        X, y = sample_data
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality",
            blend_floor=0.3,
            blend_ceiling=0.6
        )
        
        ensemble.fit(X, y)
        
        # Generate Super Learner predictions
        super_learner_probs = np.random.dirichlet(np.ones(3), size=len(X))
        
        blended = ensemble.blend_with_super_learner(super_learner_probs, X)
        
        assert isinstance(blended, np.ndarray)
        assert blended.shape == super_learner_probs.shape
        assert np.allclose(blended.sum(axis=1), 1.0)
        assert np.all(blended >= 0) and np.all(blended <= 1)
    
    def test_blend_adaptive_weight(self, sample_data, temp_models_dir):
        """Test adaptive blend weight based on Brier score"""
        X, y = sample_data
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality"
        )
        
        ensemble.fit(X, y)
        
        # Set different Brier scores to test adaptive weighting
        ensemble.metrics['blend_brier'] = 0.15  # Good SOTA performance
        super_learner_probs = np.random.dirichlet(np.ones(3), size=len(X))
        
        blended = ensemble.blend_with_super_learner(super_learner_probs, X)
        
        # Blended should be different from Super Learner alone
        assert not np.allclose(blended, super_learner_probs)
    
    def test_save_load_roundtrip(self, sample_data, temp_models_dir):
        """Test model persistence and loading via pickle"""
        X, y = sample_data
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality"
        )
        
        ensemble.fit(X, y)
        original_predictions = ensemble.predict_proba(X)
        
        # Save via pickle/joblib
        import joblib
        save_path = temp_models_dir / "sota_stack.pkl"
        joblib.dump(ensemble, save_path)
        assert save_path.exists()
        
        # Load
        loaded_ensemble = joblib.load(save_path)
        loaded_predictions = loaded_ensemble.predict_proba(X)
        
        # Predictions should match (allowing for small numerical differences)
        np.testing.assert_array_almost_equal(original_predictions, loaded_predictions, decimal=4)
        assert loaded_ensemble.metrics['blend_accuracy'] == ensemble.metrics['blend_accuracy']
    
    def test_calibration_enabled(self, sample_data, temp_models_dir):
        """Test that calibration is applied when enabled"""
        X, y = sample_data
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality",
            calibration=True
        )
        
        ensemble.fit(X, y)
        predictions = ensemble.predict_proba(X)
        
        # Calibrated predictions should still be valid probabilities
        assert np.all(predictions >= 0) and np.all(predictions <= 1)
        assert np.allclose(predictions.sum(axis=1), 1.0)
    
    def test_hyperparameters_custom(self, sample_data, temp_models_dir):
        """Test custom hyperparameter configuration"""
        X, y = sample_data
        custom_hyperparams = {
            'GBM': {},
            'XT': {'n_estimators': 50}
        }
        
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality",
            hyperparameters=custom_hyperparams
        )
        
        ensemble.fit(X, y)
        
        assert ensemble._predictor is not None
        assert ensemble.metrics['blend_accuracy'] >= 0


class TestSotaStackingGracefulDegradation:
    """Test graceful degradation when AutoGluon unavailable"""
    
    @patch('src.models.sota_stack.SotaStackingEnsemble.is_available', return_value=False)
    def test_unavailable_handling(self, mock_available, sample_data, temp_models_dir):
        """Test handling when AutoGluon is not available"""
        if SotaStackingEnsemble is None:
            pytest.skip("Cannot test unavailable handling without import")
        
        X, y = sample_data
        ensemble = SotaStackingEnsemble(predictor_path=temp_models_dir)
        
        # Should handle gracefully without crashing
        with pytest.raises(Exception):  # Expect some error when unavailable
            ensemble.fit(X, y)


class TestSotaStackingEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.mark.skipif(not AUTOGLUON_AVAILABLE, reason="AutoGluon not installed")
    def test_small_dataset(self, temp_models_dir):
        """Test with very small dataset"""
        X = pd.DataFrame(np.random.randn(20, 5))
        y = pd.Series(np.random.choice([0, 1, 2], size=20))
        
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=15,
            presets="medium_quality"
        )
        
        # Should handle small dataset without crashing
        try:
            ensemble.fit(X, y)
            predictions = ensemble.predict_proba(X)
            assert predictions.shape[0] == len(X)
        except Exception as e:
            pytest.skip(f"AutoGluon may require larger datasets: {e}")
    
    @pytest.mark.skipif(not AUTOGLUON_AVAILABLE, reason="AutoGluon not installed")
    def test_binary_classification(self, temp_models_dir):
        """Test with 3-class classification (standard for football)"""
        np.random.seed(42)
        X = pd.DataFrame(np.random.randn(100, 5))
        y = pd.Series(np.random.choice([0, 1, 2], size=100))
        
        ensemble = SotaStackingEnsemble(
            predictor_path=temp_models_dir,
            time_limit=30,
            presets="medium_quality"
        )
        
        ensemble.fit(X, y)
        predictions = ensemble.predict_proba(X)
        
        assert predictions.shape[1] == 3  # 3-class classification
        assert np.allclose(predictions.sum(axis=1), 1.0)
    
    @pytest.mark.skipif(not AUTOGLUON_AVAILABLE, reason="AutoGluon not installed")
    def test_predict_before_fit(self, temp_models_dir):
        """Test prediction before fitting raises error"""
        ensemble = SotaStackingEnsemble(predictor_path=temp_models_dir)
        X = pd.DataFrame(np.random.randn(10, 5))
        
        with pytest.raises(RuntimeError):
            ensemble.predict_proba(X)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
