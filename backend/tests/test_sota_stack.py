import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch
from src.models.sota_stack import SotaStackingEnsemble

class TestSotaStack:
    @pytest.fixture
    def sota_stack(self):
        return SotaStackingEnsemble()

    def test_initialization(self, sota_stack):
        assert sota_stack.time_limit == 3600
        assert sota_stack._predictor is None
        assert sota_stack._tabpfn_state is None
        assert sota_stack._river_pipeline is None

    def test_predict_proba_not_fitted(self, sota_stack):
        X = pd.DataFrame({'feature1': [1, 2], 'feature2': [3, 4]})
        # Should raise RuntimeError because fit() hasn't been called
        with pytest.raises(RuntimeError, match="AutoGluon predictor unavailable"):
            sota_stack.predict_proba(X)

    @patch('src.models.sota_stack.TabularPredictor')
    @patch('src.models.sota_stack.TABPFN_AVAILABLE', False)
    @patch('src.models.sota_stack.RIVER_AVAILABLE', False)
    def test_fit_autogluon_mock(self, MockPredictor, sota_stack):
        # Mock TabularPredictor instance
        mock_predictor_instance = MockPredictor.return_value
        mock_predictor_instance.fit.return_value = None
        # Mock predict_proba to return a DataFrame with columns matching classes
        # Assuming binary classification 0, 1 by default if not specified
        mock_predictor_instance.predict_proba.return_value = pd.DataFrame({0: [0.5, 0.5], 1: [0.5, 0.5]})
        mock_predictor_instance.leaderboard.return_value = pd.DataFrame({'model': ['m1'], 'score_val': [0.9]})
        
        X = pd.DataFrame({'feature1': [1, 2], 'target': [0, 1]})
        y = pd.Series([0, 1])
        
        # Mock _allocate_artifact_dir to avoid filesystem operations
        with patch.object(sota_stack, '_allocate_artifact_dir', return_value=MagicMock()):
             # Mock is_available to ensure we enter the fit logic
             with patch.object(sota_stack, 'is_available', return_value=True):
                 sota_stack.fit(X, y)
            
        assert sota_stack._predictor is not None
        MockPredictor.assert_called()
        mock_predictor_instance.fit.assert_called()


