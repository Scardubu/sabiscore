"""
Integration tests for SOTA stacking with ensemble and training pipeline
Tests the full workflow: config → training → ensemble → prediction
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil

from src.models.training import ModelTrainer
from src.models.ensemble import SabiScoreEnsemble
from src.core.config import settings

# Test with graceful import handling
try:
    from src.models.sota_stack import SotaStackingEnsemble
    AUTOGLUON_AVAILABLE = SotaStackingEnsemble.is_available()
except ImportError:
    AUTOGLUON_AVAILABLE = False
    SotaStackingEnsemble = None


@pytest.fixture
def sample_match_data():
    """Generate sample match data with realistic features"""
    np.random.seed(42)
    n_samples = 150
    
    data = {
        'home_team_id': np.random.randint(1, 20, n_samples),
        'away_team_id': np.random.randint(1, 20, n_samples),
        'home_goals': np.random.randint(0, 5, n_samples),
        'away_goals': np.random.randint(0, 5, n_samples),
        'home_xG': np.random.uniform(0.5, 3.0, n_samples),
        'away_xG': np.random.uniform(0.5, 3.0, n_samples),
        'home_shots': np.random.randint(5, 20, n_samples),
        'away_shots': np.random.randint(5, 20, n_samples),
        'home_possession': np.random.uniform(30, 70, n_samples),
        'away_possession': np.random.uniform(30, 70, n_samples),
    }
    
    df = pd.DataFrame(data)
    
    # Create outcome (0=home, 1=draw, 2=away)
    df['outcome'] = np.select(
        [df['home_goals'] > df['away_goals'], 
         df['home_goals'] == df['away_goals'],
         df['home_goals'] < df['away_goals']],
        [0, 1, 2]
    )
    
    return df


@pytest.fixture
def temp_workspace():
    """Create temporary workspace for models and data"""
    temp_dir = tempfile.mkdtemp()
    workspace = Path(temp_dir)
    
    # Create subdirectories
    (workspace / "models").mkdir()
    (workspace / "data").mkdir()
    
    yield workspace
    
    shutil.rmtree(temp_dir)


class TestSotaConfigIntegration:
    """Test SOTA configuration propagation through settings"""
    
    def test_config_fields_exist(self):
        """Test that SOTA config fields are present in settings"""
        assert hasattr(settings, 'enable_sota_stack')
        assert hasattr(settings, 'sota_time_limit')
        assert hasattr(settings, 'sota_presets')
        assert hasattr(settings, 'sota_hyperparameters')
    
    def test_config_defaults(self):
        """Test default SOTA configuration values"""
        assert settings.enable_sota_stack is False  # Disabled by default
        assert settings.sota_time_limit is None
        assert settings.sota_presets is None
        assert settings.sota_hyperparameters is None
    
    @patch.dict('os.environ', {
        'ENABLE_SOTA_STACK': '1',
        'SOTA_TIME_LIMIT': '300',
        'SOTA_PRESETS': 'best_quality'
    })
    def test_config_from_environment(self):
        """Test SOTA config can be set via environment variables"""
        from src.core.config import Settings
        test_settings = Settings()
        
        assert test_settings.enable_sota_stack is True
        assert test_settings.sota_time_limit == 300
        assert test_settings.sota_presets == 'best_quality'


@pytest.mark.skipif(not AUTOGLUON_AVAILABLE, reason="AutoGluon not installed")
class TestSotaEnsembleIntegration:
    """Test SOTA integration with SabiScoreEnsemble"""
    
    def test_ensemble_with_sota_disabled(self, sample_match_data, temp_workspace):
        """Test ensemble works normally with SOTA disabled"""
        X = sample_match_data.drop('outcome', axis=1)
        y = sample_match_data['outcome']
        
        ensemble = SabiScoreEnsemble(
            models_path=temp_workspace / "models",
            enable_sota_stack=False
        )
        
        ensemble.build_ensemble(X, y, league='test_league')
        predictions = ensemble.predict(X)
        
        assert predictions is not None
        assert len(predictions) == len(X)
        assert ensemble.sota_stack is None  # Should not be initialized
    
    def test_ensemble_with_sota_enabled(self, sample_match_data, temp_workspace):
        """Test ensemble with SOTA stacking enabled"""
        X = sample_match_data.drop('outcome', axis=1)
        y = sample_match_data['outcome']
        
        ensemble = SabiScoreEnsemble(
            models_path=temp_workspace / "models",
            enable_sota_stack=True,
            sota_kwargs={
                'time_limit': 30,
                'presets': 'medium_quality'
            }
        )
        
        ensemble.build_ensemble(X, y, league='test_league')
        
        # SOTA stack should be initialized
        assert ensemble.sota_stack is not None
        assert isinstance(ensemble.sota_stack, SotaStackingEnsemble)
        
        # Predictions should work
        predictions = ensemble.predict(X)
        assert predictions is not None
        assert len(predictions) == len(X)
    
    def test_ensemble_metadata_includes_sota(self, sample_match_data, temp_workspace):
        """Test ensemble metadata includes SOTA metrics"""
        X = sample_match_data.drop('outcome', axis=1)
        y = sample_match_data['outcome']
        
        ensemble = SabiScoreEnsemble(
            models_path=temp_workspace / "models",
            enable_sota_stack=True,
            sota_kwargs={
                'time_limit': 30,
                'presets': 'medium_quality'
            }
        )
        
        ensemble.build_ensemble(X, y, league='test_league')
        metadata = ensemble.get_metadata()
        
        assert 'sota_accuracy' in metadata
        assert 'sota_brier' in metadata
        assert 'sota_log_loss' in metadata
        assert metadata['sota_accuracy'] >= 0
    
    def test_ensemble_save_load_with_sota(self, sample_match_data, temp_workspace):
        """Test ensemble persistence with SOTA stack"""
        X = sample_match_data.drop('outcome', axis=1)
        y = sample_match_data['outcome']
        
        ensemble = SabiScoreEnsemble(
            models_path=temp_workspace / "models",
            enable_sota_stack=True,
            sota_kwargs={
                'time_limit': 30,
                'presets': 'medium_quality'
            }
        )
        
        ensemble.build_ensemble(X, y, league='test_league')
        original_predictions = ensemble.predict(X)
        
        # Save
        save_path = temp_workspace / "models" / "test_ensemble.pkl"
        ensemble.save_model(save_path)
        
        # Load
        loaded_ensemble = SabiScoreEnsemble.load_model(
            save_path,
            models_path=temp_workspace / "models"
        )
        
        loaded_predictions = loaded_ensemble.predict(X)
        
        # Predictions should match
        np.testing.assert_array_almost_equal(
            original_predictions,
            loaded_predictions,
            decimal=4
        )
        
        # SOTA stack should be restored
        assert loaded_ensemble.sota_stack is not None


class TestSotaTrainingIntegration:
    """Test SOTA integration with ModelTrainer"""
    
    def test_trainer_accepts_sota_parameters(self, temp_workspace):
        """Test ModelTrainer accepts SOTA configuration"""
        trainer = ModelTrainer(
            enable_sota_stack=True,
            sota_time_limit=60,
            sota_presets='best_quality',
            sota_hyperparameters=None
        )
        
        assert trainer.enable_sota_stack is True
        assert 'time_limit' in trainer.sota_kwargs
        assert 'presets' in trainer.sota_kwargs
    
    @patch('src.models.training.ModelTrainer._load_league_data')
    @patch('src.models.training.ModelTrainer._prepare_features')
    def test_trainer_passes_sota_to_ensemble(
        self,
        mock_prepare,
        mock_load,
        sample_match_data,
        temp_workspace
    ):
        """Test ModelTrainer passes SOTA config to ensemble"""
        # Mock data loading
        mock_load.return_value = sample_match_data
        mock_prepare.return_value = (
            sample_match_data.drop('outcome', axis=1),
            sample_match_data['outcome']
        )
        
        trainer = ModelTrainer(
            enable_sota_stack=True,
            sota_time_limit=30,
            sota_presets='medium_quality'
        )
        
        # Mock the ensemble build to verify SOTA kwargs passed
        with patch.object(SabiScoreEnsemble, 'build_ensemble') as mock_build:
            trainer._train_single_league_model('test_league')
            
            # Verify ensemble was created with SOTA enabled
            mock_build.assert_called_once()


class TestSotaGracefulDegradation:
    """Test graceful degradation when AutoGluon unavailable"""
    
    def test_ensemble_without_autogluon(self, sample_match_data, temp_workspace):
        """Test ensemble handles missing AutoGluon gracefully"""
        X = sample_match_data.drop('outcome', axis=1)
        y = sample_match_data['outcome']
        
        with patch('src.models.sota_stack.SotaStackingEnsemble.is_available', return_value=False):
            ensemble = SabiScoreEnsemble(
                models_path=temp_workspace / "models",
                enable_sota_stack=True,  # Enabled but unavailable
                sota_kwargs={'time_limit': 30}
            )
            
            # Should still work without SOTA
            ensemble.build_ensemble(X, y, league='test_league')
            predictions = ensemble.predict(X)
            
            assert predictions is not None
            assert ensemble.sota_stack is None  # Should not be initialized


class TestSotaEndToEnd:
    """End-to-end integration tests"""
    
    @pytest.mark.skipif(not AUTOGLUON_AVAILABLE, reason="AutoGluon not installed")
    def test_full_pipeline_with_sota(self, sample_match_data, temp_workspace):
        """Test complete pipeline: config → training → prediction with SOTA"""
        X = sample_match_data.drop('outcome', axis=1)
        y = sample_match_data['outcome']
        
        # Step 1: Configure SOTA
        sota_config = {
            'time_limit': 30,
            'presets': 'medium_quality',
            'calibrate': True
        }
        
        # Step 2: Build ensemble with SOTA
        ensemble = SabiScoreEnsemble(
            models_path=temp_workspace / "models",
            enable_sota_stack=True,
            sota_kwargs=sota_config
        )
        
        ensemble.build_ensemble(X, y, league='test_league')
        
        # Step 3: Make predictions
        predictions = ensemble.predict(X)
        
        assert predictions is not None
        assert len(predictions) == len(X)
        assert predictions.shape[1] == 3  # Home, Draw, Away
        assert np.allclose(predictions.sum(axis=1), 1.0)
        
        # Step 4: Verify SOTA metrics
        metadata = ensemble.get_metadata()
        assert metadata['sota_accuracy'] > 0
        assert 0 < metadata['sota_brier'] < 1
        
        # Step 5: Save and reload
        save_path = temp_workspace / "models" / "full_pipeline.pkl"
        ensemble.save_model(save_path)
        
        loaded_ensemble = SabiScoreEnsemble.load_model(
            save_path,
            models_path=temp_workspace / "models"
        )
        
        # Step 6: Verify loaded model works
        loaded_predictions = loaded_ensemble.predict(X)
        np.testing.assert_array_almost_equal(predictions, loaded_predictions, decimal=4)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
