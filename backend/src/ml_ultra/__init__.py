"""ml_ultra package - Production ML system for SabiScore"""

from .meta_learner import DiverseEnsemble
from .feature_engineering import AdvancedFeatureEngineer
from .training_pipeline import ProductionMLPipeline
from .ultra_predictor import UltraPredictor, LegacyPredictorAdapter

__version__ = "3.0.0"
__all__ = [
    "DiverseEnsemble",
    "AdvancedFeatureEngineer", 
    "ProductionMLPipeline",
    "UltraPredictor",
    "LegacyPredictorAdapter"
]
