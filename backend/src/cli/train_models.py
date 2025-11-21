"""
Training CLI - Execute model training for all leagues
Run with: python -m backend.src.cli.train_models
"""

import argparse
import sys
import logging
from pathlib import Path

from ..core.logging import configure_logging
from ..models.training import ModelTrainer

configure_logging()
logger = logging.getLogger(__name__)
DEFAULT_LEAGUES = ['EPL', 'Bundesliga', 'La Liga', 'Serie A', 'Ligue 1']


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train SabiScore Super Learner ensembles")
    parser.add_argument(
        "--leagues",
        nargs="+",
        help="List of leagues to train (defaults to core five if omitted)",
    )
    parser.add_argument(
        "--engine",
        choices=["auto", "sklearn", "h2o"],
        help="Preferred Super Learner engine backend",
    )
    parser.add_argument(
        "--h2o-max-mem",
        dest="h2o_max_mem",
        help="Custom max memory allocation for the H2O cluster (e.g. 8G)",
    )
    parser.add_argument(
        "--prefer-gpu",
        action="store_true",
        help="Use GPU-accelerated tree boosters when supported",
    )
    parser.add_argument(
        "--disable-online-adapter",
        action="store_true",
        help="Disable River online adapter blending for deterministic offline runs",
    )
    
    # SOTA Stacking (AutoGluon) Configuration
    parser.add_argument(
        "--enable-sota-stack",
        action="store_true",
        help="Enable SOTA stacking layer with AutoGluon TabularPredictor (requires autogluon.tabular)",
    )
    parser.add_argument(
        "--sota-time-limit",
        type=int,
        help="AutoGluon training time budget in seconds (e.g., 300 for 5 minutes)",
    )
    parser.add_argument(
        "--sota-presets",
        choices=["best_quality", "high_quality", "good_quality", "medium_quality", "optimize_for_deployment"],
        help="AutoGluon quality preset (default: best_quality)",
    )
    parser.add_argument(
        "--sota-hyperparameters",
        help="AutoGluon hyperparameter config as JSON string",
    )
    return parser.parse_args()


def main():
    """Main entry point for model training"""
    args = _parse_args()
    logger.info("=== SabiScore Model Training ===")
    
    # Define leagues to train
    leagues = args.leagues or DEFAULT_LEAGUES
    
    logger.info(f"Training models for {len(leagues)} leagues: {', '.join(leagues)}")
    
    try:
        # Prepare SOTA stacking kwargs
        sota_kwargs = {}
        if args.enable_sota_stack:
            logger.info("🚀 SOTA Stacking enabled with AutoGluon TabularPredictor")
            if args.sota_time_limit:
                sota_kwargs['time_limit'] = args.sota_time_limit
                logger.info(f"  - Time budget: {args.sota_time_limit}s")
            if args.sota_presets:
                sota_kwargs['presets'] = args.sota_presets
                logger.info(f"  - Quality preset: {args.sota_presets}")
            if args.sota_hyperparameters:
                import json
                sota_kwargs['hyperparameters'] = json.loads(args.sota_hyperparameters)
                logger.info(f"  - Custom hyperparameters provided")
        
        trainer = ModelTrainer(
            super_learner_engine=args.engine,
            h2o_max_mem=args.h2o_max_mem,
            prefer_gpu=True if args.prefer_gpu else None,
            enable_online_adapter=False if args.disable_online_adapter else None,
            enable_sota_stack=args.enable_sota_stack,
            sota_time_limit=args.sota_time_limit,
            sota_presets=args.sota_presets,
            sota_hyperparameters=args.sota_hyperparameters,
        )
        
        # Check for training data
        logger.info(f"Data path: {trainer.data_path}")
        logger.info(f"Models path: {trainer.models_path}")
        
        if not trainer.data_path.exists():
            logger.error(f"Data directory not found: {trainer.data_path}")
            logger.error("Please run data processing pipeline first")
            sys.exit(1)
        
        # Train all models
        results = trainer.train_league_models(leagues)
        
        # Print summary
        logger.info("\n" + "=" * 60)
        logger.info("TRAINING SUMMARY")
        logger.info("=" * 60)
        
        successful = 0
        failed = 0
        
        for league, result in results.items():
            if 'error' in result:
                logger.error(f"✗ {league}: {result['error']}")
                failed += 1
            else:
                logger.info(f"✓ {league}:")
                logger.info(f"  - Accuracy: {result.get('accuracy', 0):.2%}")
                logger.info(f"  - Brier Score: {result.get('brier_score', 0):.4f}")
                logger.info(f"  - Log Loss: {result.get('log_loss', 0):.4f}")
                if result.get('engine') == 'god_stack_superlearner':
                    backend = result.get('engine_backend', 'sklearn')
                    logger.info(f"  - Engine: GodStack Super Learner [{backend}]")
                    if result.get('level1_accuracy'):
                        logger.info(f"  - Level-1 Accuracy: {result.get('level1_accuracy', 0):.2%}")
                    if result.get('brier_guardrail_triggered'):
                        logger.info(f"  - Brier Guardrail: ACTIVE (level-2 bypassed)")
                
                # SOTA Stacking Metrics
                if result.get('sota_accuracy'):
                    logger.info(f"  - 🚀 SOTA Accuracy: {result.get('sota_accuracy', 0):.2%}")
                    logger.info(f"  - 🚀 SOTA Brier: {result.get('sota_brier', 0):.4f}")
                    logger.info(f"  - 🚀 SOTA Log Loss: {result.get('sota_log_loss', 0):.4f}")
                    logger.info(f"  - 🚀 SOTA Engine: {result.get('sota_engine', 'AutoGluon')}")
                logger.info(f"  - Features: {result.get('feature_count', 0)}")
                logger.info(f"  - Samples: {result.get('training_samples', 0):,}")
                logger.info(f"  - Model: {Path(result.get('model_path', '')).name}")
                successful += 1
        
        logger.info("=" * 60)
        logger.info(f"Successful: {successful}/{len(leagues)}")
        logger.info(f"Failed: {failed}/{len(leagues)}")
        logger.info("=" * 60)
        
        # Update metadata
        trainer.update_model_metadata()
        logger.info("Model metadata updated")
        
        if failed > 0:
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Training interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
