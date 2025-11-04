import pytest
from unittest.mock import patch, MagicMock

def test_engine_basic_flow():
    """Test core engine workflow with minimal mocks"""
    with patch('src.insights.engine.DataAggregator') as mock_agg, \
         patch('src.insights.engine.SabiScoreEnsemble') as mock_model:

        # Setup mocks
        mock_agg_instance = mock_agg.return_value
        mock_model_instance = mock_model.return_value
        mock_agg_instance.fetch_match_data.return_value = {}
        mock_model_instance.is_trained = False

        # Import after mocking
        from src.insights.engine import InsightsEngine
        engine = InsightsEngine(model=mock_model_instance, aggregator=mock_agg_instance)

        # Test
        result = engine.generate_match_insights('TeamA vs TeamB', 'EPL')
        assert isinstance(result, dict)
        assert 'predictions' in result
        mock_agg_instance.fetch_match_data.assert_called_once()
