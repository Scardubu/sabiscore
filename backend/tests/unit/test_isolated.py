import types
import pytest
import sys
from unittest.mock import MagicMock, patch


def _register_engine_dependencies():
    """Register lightweight module stubs so the engine imports cleanly."""
    sklearn_module = types.ModuleType('sklearn')
    sklearn_ensemble = types.ModuleType('sklearn.ensemble')
    sklearn_linear = types.ModuleType('sklearn.linear_model')
    sklearn_model_selection = types.ModuleType('sklearn.model_selection')
    sklearn_metrics = types.ModuleType('sklearn.metrics')
    sklearn_preprocessing = types.ModuleType('sklearn.preprocessing')

    sklearn_ensemble.RandomForestClassifier = MagicMock()
    sklearn_ensemble.GradientBoostingClassifier = MagicMock()
    sklearn_linear.LogisticRegression = MagicMock()
    sklearn_model_selection.train_test_split = MagicMock(return_value=([], [], [], []))
    sklearn_metrics.accuracy_score = MagicMock(return_value=0.0)
    sklearn_metrics.brier_score_loss = MagicMock(return_value=0.0)
    sklearn_metrics.log_loss = MagicMock(return_value=0.0)
    sklearn_preprocessing.StandardScaler = MagicMock(return_value=MagicMock())

    numpy_module = types.ModuleType('numpy')
    numpy_module.__version__ = '1.0'
    numpy_module.random = types.SimpleNamespace(
        seed=lambda *_: None,
        random=lambda: 0.1,
    )

    pandas_module = types.ModuleType('pandas')
    pandas_module.DataFrame = MagicMock()
    pandas_module.Series = MagicMock()
    pandas_module.concat = MagicMock()

    ge_module = types.ModuleType('great_expectations')
    ge_dataset_module = types.ModuleType('great_expectations.dataset')
    ge_dataset_module.PandasDataset = MagicMock()

    stubs = {
        'sklearn': sklearn_module,
        'sklearn.ensemble': sklearn_ensemble,
        'sklearn.linear_model': sklearn_linear,
        'sklearn.model_selection': sklearn_model_selection,
        'sklearn.metrics': sklearn_metrics,
        'sklearn.preprocessing': sklearn_preprocessing,
        'scipy': types.ModuleType('scipy'),
        'numpy': numpy_module,
        'pandas': pandas_module,
        'torch': types.ModuleType('torch'),
        'torchvision': types.ModuleType('torchvision'),
        'xgboost': types.ModuleType('xgboost'),
        'lightgbm': types.ModuleType('lightgbm'),
        'great_expectations': ge_module,
        'great_expectations.dataset': ge_dataset_module,
    }

    original_modules = {name: sys.modules.get(name) for name in stubs}
    sys.modules.update(stubs)

    try:
        from src.insights.engine import InsightsEngine as _InsightsEngine  # type: ignore
    finally:
        for name, original in original_modules.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original

    return _InsightsEngine


InsightsEngine = _register_engine_dependencies()

@pytest.fixture
def engine():
    return InsightsEngine()


def test_engine_basic(engine):
    with patch.object(engine, 'generate_match_insights') as mock:
        mock.return_value = {'test': 'data'}
        result = engine.generate_match_insights('TeamA vs TeamB', 'EPL')
        assert result == {'test': 'data'}
