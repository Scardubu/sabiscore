#!/usr/bin/env python3
"""
Train machine learning models for all leagues
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.training import train_league_models
import logging
import argparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description='Train ML models for football leagues')
    parser.add_argument('--leagues', nargs='*', help='Specific leagues to train (default: all)')
    parser.add_argument('--force', action='store_true', help='Force retrain existing models')

    args = parser.parse_args()

    try:
        logger.info("Starting model training...")

        # Train models
        results = train_league_models(args.leagues)

        # Report results
        successful = 0
        failed = 0

        for league, result in results.items():
            if 'error' in result:
                logger.error(f"Failed to train {league}: {result['error']}")
                failed += 1
            else:
                logger.info(f"Successfully trained {league}:")
                logger.info(f"  Accuracy: {result.get('accuracy', 0):.4f}")
                logger.info(f"  Brier Score: {result.get('brier_score', 0):.4f}")
                logger.info(f"  Features: {result.get('feature_count', 0)}")
                logger.info(f"  Samples: {result.get('training_samples', 0)}")
                successful += 1

        logger.info(f"Training completed: {successful} successful, {failed} failed")

        if failed > 0:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Training failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
