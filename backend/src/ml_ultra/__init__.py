"""ml_ultra package - Production ML system for SabiScore

Uses lazy imports to allow graceful degradation if Ultra ML dependencies 
(catboost, xgboost, lightgbm) are not installed.
"""

import logging
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

__version__ = "3.0.0"

# Use TYPE_CHECKING for static analysis while deferring actual imports
if TYPE_CHECKING:
    from .meta_learner import DiverseEnsemble
    from .feature_engineering import AdvancedFeatureEngineer
    from .training_pipeline import ProductionMLPipeline
    from .ultra_predictor import UltraPredictor, LegacyPredictorAdapter

# Track which components are available
_available_components = {}

def _lazy_import(name: str):
    """Lazy import with graceful fallback"""
    global _available_components
    
    if name in _available_components:
        return _available_components[name]
    
    try:
        if name == "DiverseEnsemble":
            from .meta_learner import DiverseEnsemble
            _available_components[name] = DiverseEnsemble
        elif name == "AdvancedFeatureEngineer":
            from .feature_engineering import AdvancedFeatureEngineer
            _available_components[name] = AdvancedFeatureEngineer
        elif name == "ProductionMLPipeline":
            from .training_pipeline import ProductionMLPipeline
            _available_components[name] = ProductionMLPipeline
        elif name == "UltraPredictor":
            from .ultra_predictor import UltraPredictor
            _available_components[name] = UltraPredictor
        elif name == "LegacyPredictorAdapter":
            from .ultra_predictor import LegacyPredictorAdapter
            _available_components[name] = LegacyPredictorAdapter
        else:
            raise ImportError(f"Unknown component: {name}")
        
        return _available_components[name]
    except ImportError as e:
        logger.warning(f"Ultra ML component '{name}' not available: {e}")
        return None


def __getattr__(name: str):
    """Module-level lazy attribute access"""
    if name in ("DiverseEnsemble", "AdvancedFeatureEngineer", 
                "ProductionMLPipeline", "UltraPredictor", "LegacyPredictorAdapter"):
        result = _lazy_import(name)
        if result is None:
            raise ImportError(
                f"Ultra ML component '{name}' requires additional dependencies. "
                f"Install with: pip install catboost xgboost lightgbm"
            )
        return result
    raise AttributeError(f"module 'ml_ultra' has no attribute '{name}'")


def is_ultra_available() -> bool:
    """Check if Ultra ML dependencies are available"""
    try:
        _lazy_import("DiverseEnsemble")
        _lazy_import("UltraPredictor")
        return True
    except Exception:
        return False


__all__ = [
    "DiverseEnsemble",
    "AdvancedFeatureEngineer", 
    "ProductionMLPipeline",
    "UltraPredictor",
    "LegacyPredictorAdapter",
    "is_ultra_available",
    "__version__"
]
