import hashlib
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple

import pandas as pd
from tqdm import tqdm

from .ensemble import SabiScoreEnsemble
from ..data.transformers import FeatureTransformer
from ..core.config import settings

logger = logging.getLogger(__name__)

class ModelTrainer:
    """Handles model training pipeline"""

    def __init__(self):
        self.transformer = FeatureTransformer()
        self.models_path = settings.models_path
        self.data_path = settings.data_path
        self.models_path.mkdir(parents=True, exist_ok=True)
        self.data_path.mkdir(parents=True, exist_ok=True)

    def train_league_models(self, leagues: List[str] = None) -> Dict[str, Any]:
        """Train models for specified leagues"""
        if leagues is None:
            leagues = ['EPL', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1']

        results: Dict[str, Any] = {}

        for league in tqdm(leagues, desc="Training league models"):
            try:
                logger.info(f"Training model for {league}")
                result = self._train_single_league_model(league)
                results[league] = result
                logger.info(f"Successfully trained {league} model")

            except Exception as e:
                logger.error(f"Failed to train {league} model: {e}")
                results[league] = {'error': str(e)}

        return results

    def _train_single_league_model(self, league: str) -> Dict[str, Any]:
        """Train model for a single league"""
        try:
            training_data = self._load_training_data(league)
            if training_data.empty:
                raise ValueError(f"No training data available for {league}")

            X, y = self._prepare_training_data(training_data)

            ensemble = SabiScoreEnsemble()
            ensemble.feature_columns = list(X.columns)
            ensemble.build_ensemble(X, y)

            dataset_signature = self._compute_dataset_signature(training_data)
            model_filename = f"{self._slugify_league(league)}_ensemble"
            ensemble.model_metadata.update(
                {
                    "league": league,
                    "dataset_signature": dataset_signature,
                    "training_samples": len(X),
                }
            )

            ensemble.save_model(self.models_path, model_filename)
            self._update_league_metadata(model_filename, ensemble.model_metadata)

            return {
                "model_path": os.path.join(self.models_path, f"{model_filename}.pkl"),
                "accuracy": ensemble.model_metadata.get("accuracy", 0),
                "brier_score": ensemble.model_metadata.get("brier_score", 0),
                "log_loss": ensemble.model_metadata.get("log_loss", 0),
                "feature_count": len(ensemble.feature_columns),
                "training_samples": len(X),
                "trained_at": ensemble.model_metadata.get("trained_at"),
                "dataset_signature": dataset_signature,
            }

        except Exception as e:
            logger.error(f"Training failed for {league}: {e}")
            raise

    def _load_training_data(self, league: str) -> pd.DataFrame:
        """Load training data for a league from processed datasets."""
        league_slug = self._slugify_league(league)
        candidates = [
            self.data_path / f"{league_slug}_training.parquet",
            self.data_path / f"{league_slug}_training.feather",
            self.data_path / f"{league_slug}_training.csv",
        ]

        for path in candidates:
            if path.exists():
                logger.info("Loading training data from %s", path)
                if path.suffix == ".parquet":
                    df = pd.read_parquet(path)
                elif path.suffix == ".feather":
                    df = pd.read_feather(path)
                else:
                    df = pd.read_csv(path)

                df = df.dropna(subset=["result"]).reset_index(drop=True)
                logger.info("Loaded %s samples with %s columns for %s", len(df), len(df.columns), league)
                return df

        raise FileNotFoundError(
            f"No processed dataset found for league '{league}'. Expected one of: "
            + ", ".join(str(path.name) for path in candidates)
        )

    def _prepare_training_data(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Prepare features and target for training"""
        # Separate features and target (exclude non-feature columns)
        exclude_cols = ['result', 'match_id', 'kickoff_time']
        feature_cols = [col for col in data.columns if col not in exclude_cols]
        X = data[feature_cols]
        y = data['result'].copy()

        # Normalize target encoding to numerical classes 0,1,2 regardless of source format
        target_mapping = {
            'home_win': 0,
            'draw': 1,
            'away_win': 2,
            0: 0,
            1: 1,
            2: 2
        }
        y = y.map(target_mapping)

        if y.isnull().any():
            raise ValueError("Encountered unknown result labels while preparing training data")

        y = y.astype(int)
        # Convert to DataFrame for compatibility
        y = pd.DataFrame(y, columns=['result'])

        logger.info(f"Prepared {len(X)} samples with {len(feature_cols)} features")
        return X, y

    def _compute_dataset_signature(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate a signature of the dataset for drift detection."""
        buffer = df.to_csv(index=False).encode("utf-8")
        digest = hashlib.sha256(buffer).hexdigest()
        return {
            "checksum": digest,
            "rows": int(len(df)),
            "generated_at": datetime.utcnow().isoformat(),
        }

    def _update_league_metadata(self, model_filename: str, metadata: Dict[str, Any]) -> None:
        league_key = metadata.get("league", model_filename.split("_ensemble")[0]).upper()
        global_meta = self._load_global_metadata()
        global_meta.setdefault("models", {})[league_key] = metadata
        global_meta["last_updated"] = datetime.utcnow().isoformat()

        metadata_file = self.models_path / "models_metadata.json"
        with metadata_file.open("w", encoding="utf-8") as fh:
            json.dump(global_meta, fh, indent=2)

    def _load_global_metadata(self) -> Dict[str, Any]:
        metadata_file = self.models_path / "models_metadata.json"
        if metadata_file.exists():
            try:
                with metadata_file.open("r", encoding="utf-8") as fh:
                    return json.load(fh)
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("Failed to read metadata file %s: %s", metadata_file, exc)
        return {"models": {}, "last_updated": None}

    def _slugify_league(self, league: str) -> str:
        return league.lower().replace(" ", "_").replace("-", "_")

    def update_model_metadata(self) -> None:
        """Update model metadata file"""
        try:
            metadata = {
                'last_updated': datetime.utcnow().isoformat(),
                'models': {}
            }

            # Check for existing models
            if os.path.exists(self.models_path):
                for file in os.listdir(self.models_path):
                    if file.endswith('_metadata.json'):
                        league = file.replace('_metadata.json', '').replace('_ensemble', '').title()
                        metadata_path = os.path.join(self.models_path, file)
                        with open(metadata_path, 'r') as f:
                            model_meta = json.load(f)
                        metadata['models'][league] = model_meta

            # Save global metadata
            metadata_file = os.path.join(self.models_path, 'models_metadata.json')
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)

            logger.info("Model metadata updated")

        except Exception as e:
            logger.error(f"Failed to update metadata: {e}")

def train_league_models(leagues: List[str] = None) -> Dict[str, Any]:
    """Convenience function to train league models"""
    trainer = ModelTrainer()
    results = trainer.train_league_models(leagues)
    trainer.update_model_metadata()
    return results
