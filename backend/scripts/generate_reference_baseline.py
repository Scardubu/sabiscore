import os
import asyncio
import logging
import pandas as pd
from src.core.database import get_db_session
from src.db.crud import get_settled_fixtures
from src.ml.features import build_live_feature_vector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sabiscore.ml.baseline")

REFERENCE_EXPORT_PATH = "data/reference/baseline_v1.parquet"
MINIMUM_SETTLED_SAMPLE = 1000  

async def generate_baseline():
    """
    Extracts settled matches and passes them through the production inference 
    feature-construction pipeline to ensure zero structural divergence.
    """
    logger.info("Initializing baseline generation sequence...")
    
    async for session in get_db_session():
        fixtures = await get_settled_fixtures(session, limit=5000)
        
        if len(fixtures) < MINIMUM_SETTLED_SAMPLE:
            logger.error(f"Insufficient settled fixtures. Found {len(fixtures)}, require {MINIMUM_SETTLED_SAMPLE}.")
            return

        logger.info(f"Retrieved {len(fixtures)} settled fixtures. Constructing feature vectors...")
        
        feature_rows = []
        for fixture in fixtures:
            vector = await build_live_feature_vector(session, fixture.match_id)
            if vector is not None:
                feature_rows.append(vector)
                
        if not feature_rows:
            logger.error("Feature construction failed for all fixtures.")
            return

        features_df = pd.DataFrame(feature_rows)
        
        # Strip identifiers that should not be evaluated for statistical drift
        columns_to_drop = ['match_id', 'home_team_id', 'away_team_id', 'outcome']
        features_df = features_df.drop(columns=[col for col in columns_to_drop if col in features_df.columns])
        
        os.makedirs(os.path.dirname(REFERENCE_EXPORT_PATH), exist_ok=True)
        features_df.to_parquet(REFERENCE_EXPORT_PATH, index=False)
        
        logger.info(f"Baseline matrix ({features_df.shape[0]}x{features_df.shape[1]}) serialized to {REFERENCE_EXPORT_PATH}")
        break

if __name__ == "__main__":
    asyncio.run(generate_baseline())
