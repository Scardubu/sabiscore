"""
Model Registry with MLflow Integration
Manages model versioning, tracking, and deployment lifecycle
"""

import os
import joblib
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import pandas as pd

logger = logging.getLogger(__name__)

# Optional MLflow imports (graceful degradation if not installed)
try:
    import mlflow
    import mlflow.sklearn
    MLFLOW_AVAILABLE = True
except ImportError:
    logger.warning("MLflow not installed. Model tracking disabled.")
    MLFLOW_AVAILABLE = False


class ModelRegistry:
    """
    Centralized model registry for versioning and tracking
    
    Features:
    - Model versioning with semantic versioning
    - Performance metrics tracking
    - Model comparison and rollback
    - MLflow integration for experiment tracking
    - Model promotion (staging -> production)
    """
    
    def __init__(
        self, 
        registry_path: str,
        mlflow_tracking_uri: Optional[str] = None,
        experiment_name: str = "SabiScore_Ensemble"
    ):
        """
        Initialize Model Registry
        
        Args:
            registry_path: Local directory for model storage
            mlflow_tracking_uri: MLflow tracking server URI
            experiment_name: MLflow experiment name
        """
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)
        
        self.metadata_path = self.registry_path / "metadata.json"
        self.models_dir = self.registry_path / "models"
        self.models_dir.mkdir(exist_ok=True)
        
        # MLflow setup
        if MLFLOW_AVAILABLE and mlflow_tracking_uri:
            mlflow.set_tracking_uri(mlflow_tracking_uri)
            mlflow.set_experiment(experiment_name)
            self.mlflow_enabled = True
            logger.info(f"MLflow tracking enabled: {mlflow_tracking_uri}")
        else:
            self.mlflow_enabled = False
            logger.info("MLflow tracking disabled (local storage only)")
        
        # Load or initialize registry metadata
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict[str, Any]:
        """Load registry metadata from disk"""
        if self.metadata_path.exists():
            with open(self.metadata_path, 'r') as f:
                return json.load(f)
        
        return {
            'models': {},
            'production_model': None,
            'staging_model': None
        }
    
    def _save_metadata(self) -> None:
        """Save registry metadata to disk"""
        with open(self.metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)
    
    def register_model(
        self,
        model: Any,
        model_name: str,
        model_version: str,
        metrics: Dict[str, float],
        params: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Register a new model version
        
        Args:
            model: Trained model object
            model_name: Model identifier
            model_version: Semantic version string (e.g., "1.0.0")
            metrics: Performance metrics (accuracy, brier_score, etc.)
            params: Model hyperparameters
            tags: Optional metadata tags
            
        Returns:
            Model ID (name + version)
        """
        model_id = f"{model_name}_v{model_version}"
        model_path = self.models_dir / f"{model_id}.pkl"
        
        try:
            # Save model locally
            joblib.dump(model, model_path)
            logger.info(f"Model saved locally: {model_path}")
            
            # Update registry metadata
            self.metadata['models'][model_id] = {
                'model_name': model_name,
                'model_version': model_version,
                'model_path': str(model_path),
                'metrics': metrics,
                'params': params,
                'tags': tags or {},
                'registered_at': datetime.utcnow().isoformat(),
                'status': 'staging'  # Default to staging
            }
            self._save_metadata()
            
            # MLflow tracking
            if self.mlflow_enabled:
                with mlflow.start_run(run_name=model_id):
                    # Log parameters
                    mlflow.log_params(params)
                    
                    # Log metrics
                    mlflow.log_metrics(metrics)
                    
                    # Log tags
                    if tags:
                        mlflow.set_tags(tags)
                    
                    # Log model
                    mlflow.sklearn.log_model(model, "model")
                    
                    logger.info(f"Model logged to MLflow: {model_id}")
            
            return model_id
            
        except Exception as e:
            logger.error(f"Failed to register model {model_id}: {e}")
            raise
    
    def get_model(self, model_id: str) -> Any:
        """
        Load a registered model
        
        Args:
            model_id: Model identifier (name + version)
            
        Returns:
            Loaded model object
        """
        if model_id not in self.metadata['models']:
            raise ValueError(f"Model {model_id} not found in registry")
        
        model_path = Path(self.metadata['models'][model_id]['model_path'])
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        return joblib.load(model_path)
    
    def get_production_model(self) -> Optional[Any]:
        """
        Get the current production model
        
        Returns:
            Production model or None if not set
        """
        prod_id = self.metadata.get('production_model')
        
        if not prod_id:
            logger.warning("No production model set")
            return None
        
        return self.get_model(prod_id)
    
    def promote_to_production(self, model_id: str) -> None:
        """
        Promote a model to production
        
        Args:
            model_id: Model to promote
        """
        if model_id not in self.metadata['models']:
            raise ValueError(f"Model {model_id} not found")
        
        # Demote current production model to staging
        current_prod = self.metadata.get('production_model')
        if current_prod and current_prod in self.metadata['models']:
            self.metadata['models'][current_prod]['status'] = 'staging'
        
        # Promote new model
        self.metadata['production_model'] = model_id
        self.metadata['models'][model_id]['status'] = 'production'
        self.metadata['models'][model_id]['promoted_at'] = datetime.utcnow().isoformat()
        
        self._save_metadata()
        logger.info(f"Model {model_id} promoted to production")
    
    def compare_models(
        self, 
        model_ids: List[str],
        metric: str = 'accuracy'
    ) -> pd.DataFrame:
        """
        Compare performance metrics across models
        
        Args:
            model_ids: List of model IDs to compare
            metric: Primary metric for ranking
            
        Returns:
            DataFrame with comparison results
        """
        comparison = []
        
        for model_id in model_ids:
            if model_id not in self.metadata['models']:
                logger.warning(f"Model {model_id} not found, skipping")
                continue
            
            model_info = self.metadata['models'][model_id]
            comparison.append({
                'model_id': model_id,
                'model_name': model_info['model_name'],
                'version': model_info['model_version'],
                'status': model_info['status'],
                **model_info['metrics'],
                'registered_at': model_info['registered_at']
            })
        
        df = pd.DataFrame(comparison)
        
        if not df.empty and metric in df.columns:
            df = df.sort_values(by=metric, ascending=False)
        
        return df
    
    def list_models(
        self, 
        status: Optional[str] = None
    ) -> List[str]:
        """
        List all registered models
        
        Args:
            status: Filter by status ('production', 'staging', 'archived')
            
        Returns:
            List of model IDs
        """
        models = []
        
        for model_id, info in self.metadata['models'].items():
            if status is None or info['status'] == status:
                models.append(model_id)
        
        return models
    
    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a model
        
        Args:
            model_id: Model identifier
            
        Returns:
            Model metadata dictionary
        """
        if model_id not in self.metadata['models']:
            raise ValueError(f"Model {model_id} not found")
        
        return self.metadata['models'][model_id]
    
    def archive_model(self, model_id: str) -> None:
        """
        Archive a model (keep metadata, remove from active use)
        
        Args:
            model_id: Model to archive
        """
        if model_id not in self.metadata['models']:
            raise ValueError(f"Model {model_id} not found")
        
        if self.metadata.get('production_model') == model_id:
            raise ValueError("Cannot archive production model. Promote another model first.")
        
        self.metadata['models'][model_id]['status'] = 'archived'
        self.metadata['models'][model_id]['archived_at'] = datetime.utcnow().isoformat()
        
        self._save_metadata()
        logger.info(f"Model {model_id} archived")
