from unittest.mock import patch, MagicMock

def test_engine_minimal():
    """Minimal engine test with maximum mocking"""
    with patch('src.insights.engine.DataAggregator') as mock_agg, \
         patch('src.insights.engine.SabiScoreEnsemble') as mock_model:

        from src.insights.engine import InsightsEngine
        mock_agg_instance = mock_agg.return_value
        mock_model_instance = mock_model.return_value

        mock_agg_instance.fetch_match_data.return_value = {}
        mock_model_instance.is_trained = False
        mock_model_instance.predict.return_value = {'minimal': 'test'}

        engine = InsightsEngine(model=mock_model_instance, aggregator=mock_agg_instance)

        # Test
        result = engine.generate_match_insights('TeamA vs TeamB', 'EPL')
        assert isinstance(result, dict)
        assert 'predictions' in result
        mock_agg_instance.fetch_match_data.assert_called_once()
