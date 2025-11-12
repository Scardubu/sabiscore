# backend/src/tasks/background.py
"""
Background Tasks - Model retraining, calibration, monitoring, and data refresh
Runs via Celery workers for production scalability
"""

from celery import Celery
from celery.schedules import crontab
import redis
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Dict, List
import numpy as np

from ..db.session import SessionLocal
from ..models.orchestrator import ModelOrchestrator
from ..models.prediction import Prediction
from ..models.match import Match
from ..services.odds import OddsService
from ..core.logging import get_logger

logger = get_logger(__name__)

# Initialize Celery
celery_app = Celery(
    'sabiscore_tasks',
    broker='redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379',
    backend='redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379'
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    task_soft_time_limit=3000,  # 50 min warning
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50
)

# Periodic tasks schedule
celery_app.conf.beat_schedule = {
    'calibrate-models-every-3-minutes': {
        'task': 'backend.src.tasks.background.calibrate_models',
        'schedule': crontab(minute='*/3'),  # Every 3 minutes
    },
    'fetch-odds-every-5-minutes': {
        'task': 'backend.src.tasks.background.fetch_latest_odds',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
    'retrain-models-daily': {
        'task': 'backend.src.tasks.background.retrain_all_models',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
    },
    'generate-value-bets-hourly': {
        'task': 'backend.src.tasks.background.generate_value_bets',
        'schedule': crontab(minute=0),  # Every hour
    },
    'cleanup-old-predictions': {
        'task': 'backend.src.tasks.background.cleanup_old_data',
        'schedule': crontab(hour=3, minute=0),  # 3 AM daily
    },
    'calculate-model-performance': {
        'task': 'backend.src.tasks.background.calculate_performance_metrics',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'refresh-league-standings': {
        'task': 'backend.src.tasks.background.refresh_standings',
        'schedule': crontab(hour='*/2'),  # Every 2 hours
    }
}


@celery_app.task(name='backend.src.tasks.background.calibrate_models', bind=True)
def calibrate_models(self):
    """
    Live Platt calibration every 3 minutes
    Updates Redis with new calibration parameters (platt_a, platt_b)
    """
    logger.info("🔄 Starting model calibration task")
    db = SessionLocal()
    redis_client = redis.from_url("redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379", decode_responses=True)
    
    try:
        orchestrator = ModelOrchestrator()
        
        # Calibrate each league model
        for league_key in orchestrator.models.keys():
            logger.info(f"Calibrating {league_key.upper()} model")
            
            # Get predictions from last 24 hours
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            
            predictions = db.query(Prediction).join(Match).filter(
                Prediction.league == league_key,
                Prediction.created_at >= cutoff_time,
                Match.home_score.isnot(None),  # Only settled matches
                Match.away_score.isnot(None)
            ).all()
            
            if len(predictions) < 20:
                logger.warning(f"Insufficient data for {league_key}: {len(predictions)} predictions")
                continue
            
            # Extract predictions and outcomes
            y_pred = []
            y_true = []
            
            for pred in predictions:
                match = pred.match
                
                # Get predicted probability for outcome
                probs = json.loads(pred.probabilities)
                max_prob = max(probs['home_win'], probs['draw'], probs['away_win'])
                y_pred.append(max_prob)
                
                # Get actual outcome
                if match.home_score > match.away_score:
                    actual_outcome = 'home_win'
                elif match.home_score == match.away_score:
                    actual_outcome = 'draw'
                else:
                    actual_outcome = 'away_win'
                
                # Binary: 1 if prediction correct, 0 otherwise
                predicted_outcome = max(probs, key=probs.get)
                y_true.append(1 if predicted_outcome == actual_outcome else 0)
            
            # Perform Platt scaling
            from sklearn.linear_model import LogisticRegression
            from sklearn.preprocessing import StandardScaler
            
            # Reshape for sklearn
            X = np.array(y_pred).reshape(-1, 1)
            y = np.array(y_true)
            
            # Fit logistic regression
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            lr = LogisticRegression(random_state=42, max_iter=1000)
            lr.fit(X_scaled, y)
            
            # Extract Platt parameters
            platt_a = float(lr.coef_[0][0])
            platt_b = float(lr.intercept_[0])
            
            # Calculate Brier score
            calibrated_probs = lr.predict_proba(X_scaled)[:, 1]
            brier_score = np.mean((calibrated_probs - y) ** 2)
            
            # Store in Redis
            calibration_data = {
                'platt_a': platt_a,
                'platt_b': platt_b,
                'brier_score': float(brier_score),
                'samples_used': len(predictions),
                'calibrated_at': datetime.utcnow().isoformat(),
                'accuracy': float(np.mean(y)),
                'avg_confidence': float(np.mean(y_pred))
            }
            
            redis_client.setex(
                f"calibration:{league_key}",
                86400,  # 24 hours TTL
                json.dumps(calibration_data)
            )
            
            logger.info(
                f"✅ {league_key.upper()}: Brier={brier_score:.4f}, "
                f"platt_a={platt_a:.3f}, platt_b={platt_b:.3f}, "
                f"samples={len(predictions)}"
            )
        
        return {"status": "success", "leagues_calibrated": len(orchestrator.models)}
    
    except Exception as e:
        logger.error(f"Calibration failed: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


@celery_app.task(name='backend.src.tasks.background.fetch_latest_odds', bind=True)
def fetch_latest_odds(self):
    """
    Fetch latest odds from multiple bookmakers every 5 minutes
    Stores in PostgreSQL and Redis cache
    """
    logger.info("🎲 Fetching latest odds")
    db = SessionLocal()
    
    try:
        odds_service = OddsService(db)
        
        # Get upcoming matches (next 7 days)
        upcoming_matches = db.query(Match).filter(
            Match.match_date >= datetime.utcnow(),
            Match.match_date <= datetime.utcnow() + timedelta(days=7),
            Match.home_score.is_(None)  # Not yet played
        ).all()
        
        logger.info(f"Found {len(upcoming_matches)} upcoming matches")
        
        odds_fetched = 0
        for match in upcoming_matches:
            try:
                # Fetch from odds API (The Odds API, OddsAPI.io, etc.)
                odds_data = odds_service.fetch_match_odds(
                    match.home_team.name,
                    match.away_team.name,
                    match.league
                )
                
                if odds_data:
                    odds_service.store_odds(match.id, odds_data)
                    odds_fetched += 1
                    
            except Exception as e:
                logger.error(f"Error fetching odds for match {match.id}: {e}")
                continue
        
        logger.info(f"✅ Fetched odds for {odds_fetched}/{len(upcoming_matches)} matches")
        return {"status": "success", "odds_fetched": odds_fetched}
    
    except Exception as e:
        logger.error(f"Odds fetching failed: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


@celery_app.task(name='backend.src.tasks.background.retrain_all_models', bind=True)
def retrain_all_models(self):
    """
    Full model retraining daily at 2 AM
    Uses last 180 days of data with 5-fold cross-validation
    """
    logger.info("🚀 Starting full model retraining")
    db = SessionLocal()
    
    try:
        orchestrator = ModelOrchestrator()
        
        # Train all league models
        orchestrator.train_all_models(db)
        
        # Run validation suite
        validation_results = orchestrator._run_validation_suite(db)
        
        logger.info(f"✅ Model retraining complete: {validation_results}")
        return {"status": "success", "validation": validation_results}
    
    except Exception as e:
        logger.error(f"Retraining failed: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


@celery_app.task(name='backend.src.tasks.background.generate_value_bets', bind=True)
def generate_value_bets(self):
    """
    Generate value bet recommendations every hour
    Scans all upcoming matches and identifies +4.2% edge opportunities
    """
    logger.info("💎 Generating value bets")
    db = SessionLocal()
    redis_client = redis.from_url("redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379", decode_responses=True)
    
    try:
        from ..services.prediction import PredictionService
        
        prediction_service = PredictionService(db, redis_client)
        
        # Get matches in next 24 hours
        upcoming_matches = db.query(Match).filter(
            Match.match_date >= datetime.utcnow(),
            Match.match_date <= datetime.utcnow() + timedelta(hours=24),
            Match.home_score.is_(None)
        ).all()
        
        logger.info(f"Analyzing {len(upcoming_matches)} upcoming matches")
        
        value_bets = []
        for match in upcoming_matches:
            try:
                # Get prediction
                prediction = prediction_service.predict_match(
                    home_team_id=match.home_team_id,
                    away_team_id=match.away_team_id,
                    league=match.league,
                    match_date=match.match_date
                )
                
                # Check for value bets
                if prediction['value_bets']:
                    value_bets.extend(prediction['value_bets'])
                    
            except Exception as e:
                logger.error(f"Error predicting match {match.id}: {e}")
                continue
        
        # Store value bets in Redis for dashboard
        if value_bets:
            redis_client.setex(
                'value_bets:latest',
                3600,  # 1 hour TTL
                json.dumps(value_bets)
            )
        
        logger.info(f"✅ Found {len(value_bets)} value bets")
        return {"status": "success", "value_bets_found": len(value_bets)}
    
    except Exception as e:
        logger.error(f"Value bet generation failed: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


@celery_app.task(name='backend.src.tasks.background.cleanup_old_data', bind=True)
def cleanup_old_data(self):
    """
    Cleanup predictions and cache older than 30 days
    Runs daily at 3 AM
    """
    logger.info("🧹 Cleaning up old data")
    db = SessionLocal()
    redis_client = redis.from_url("redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379", decode_responses=True)
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        
        # Delete old predictions
        deleted_predictions = db.query(Prediction).filter(
            Prediction.created_at < cutoff_date
        ).delete()
        
        db.commit()
        
        # Clear old Redis keys
        cleared_keys = 0
        for key in redis_client.scan_iter(match="*:*"):
            try:
                ttl = redis_client.ttl(key)
                if ttl == -1:  # No expiration set
                    redis_client.expire(key, 86400)  # Set 24h expiration
                    cleared_keys += 1
            except:
                continue
        
        logger.info(
            f"✅ Cleanup complete: {deleted_predictions} predictions, "
            f"{cleared_keys} Redis keys updated"
        )
        
        return {
            "status": "success",
            "predictions_deleted": deleted_predictions,
            "redis_keys_updated": cleared_keys
        }
    
    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}", exc_info=True)
        db.rollback()
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


@celery_app.task(name='backend.src.tasks.background.calculate_performance_metrics', bind=True)
def calculate_performance_metrics(self):
    """
    Calculate real-time model performance metrics every 15 minutes
    Tracks accuracy, CLV, ROI, Brier score
    """
    logger.info("📊 Calculating performance metrics")
    db = SessionLocal()
    redis_client = redis.from_url("redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379", decode_responses=True)
    
    try:
        # Get predictions from last 7 days
        cutoff = datetime.utcnow() - timedelta(days=7)
        
        predictions = db.query(Prediction).join(Match).filter(
            Prediction.created_at >= cutoff,
            Match.home_score.isnot(None)
        ).all()
        
        if not predictions:
            logger.warning("No settled predictions for metrics calculation")
            return {"status": "no_data"}
        
        # Calculate metrics
        correct = 0
        total = 0
        brier_scores = []
        roi_sum = 0
        bets_placed = 0
        
        for pred in predictions:
            match = pred.match
            probs = json.loads(pred.probabilities)
            
            # Determine actual outcome
            if match.home_score > match.away_score:
                actual = 'home_win'
                actual_vector = [1, 0, 0]
            elif match.home_score == match.away_score:
                actual = 'draw'
                actual_vector = [0, 1, 0]
            else:
                actual = 'away_win'
                actual_vector = [0, 0, 1]
            
            # Accuracy
            predicted = max(probs, key=probs.get)
            if predicted == actual:
                correct += 1
            total += 1
            
            # Brier score
            pred_vector = [probs['home_win'], probs['draw'], probs['away_win']]
            brier = np.sum((np.array(pred_vector) - np.array(actual_vector)) ** 2)
            brier_scores.append(brier)
            
            # ROI (if bet was placed)
            if pred.recommended_stake and pred.recommended_stake > 0:
                bets_placed += 1
                if predicted == actual:
                    # Won bet
                    profit = pred.recommended_stake * (pred.odds - 1)
                    roi_sum += profit
                else:
                    # Lost bet
                    roi_sum -= pred.recommended_stake
        
        # Aggregate metrics
        metrics = {
            'accuracy': round(correct / total, 4) if total > 0 else 0,
            'brier_score': round(np.mean(brier_scores), 4) if brier_scores else 0,
            'total_predictions': total,
            'bets_placed': bets_placed,
            'roi': round(roi_sum, 2),
            'roi_percent': round((roi_sum / (bets_placed * 10000)) * 100, 2) if bets_placed > 0 else 0,
            'calculated_at': datetime.utcnow().isoformat()
        }
        
        # Store in Redis
        redis_client.setex(
            'performance:metrics:latest',
            900,  # 15 minutes TTL
            json.dumps(metrics)
        )
        
        logger.info(
            f"✅ Metrics: Accuracy={metrics['accuracy']:.1%}, "
            f"Brier={metrics['brier_score']:.4f}, "
            f"ROI={metrics['roi_percent']:.1f}%"
        )
        
        return {"status": "success", "metrics": metrics}
    
    except Exception as e:
        logger.error(f"Metrics calculation failed: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


@celery_app.task(name='backend.src.tasks.background.refresh_standings', bind=True)
def refresh_standings(self):
    """
    Refresh league standings every 2 hours
    Scrapes from official sources or APIs
    """
    logger.info("📋 Refreshing league standings")
    db = SessionLocal()
    
    try:
        from ..models.league_standing import LeagueStanding
        
        leagues = ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1']
        updated_leagues = 0
        
        for league in leagues:
            try:
                # Fetch standings (integrate with API)
                # Placeholder: In production, integrate with Football-Data.org API
                standings_data = _fetch_league_standings(league)
                
                if standings_data:
                    # Update database
                    for standing in standings_data:
                        db.merge(LeagueStanding(**standing))
                    
                    db.commit()
                    updated_leagues += 1
                    
            except Exception as e:
                logger.error(f"Error updating {league} standings: {e}")
                continue
        
        logger.info(f"✅ Updated standings for {updated_leagues} leagues")
        return {"status": "success", "leagues_updated": updated_leagues}
    
    except Exception as e:
        logger.error(f"Standings refresh failed: {str(e)}", exc_info=True)
        db.rollback()
        return {"status": "error", "message": str(e)}
    
    finally:
        db.close()


def _fetch_league_standings(league: str) -> List[Dict]:
    """
    Fetch league standings from API
    TODO: Integrate with Football-Data.org or similar
    """
    # Placeholder implementation
    return []


# Health check endpoint for monitoring
@celery_app.task(name='backend.src.tasks.background.health_check', bind=True)
def health_check(self):
    """Health check for Celery workers"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "worker_id": self.request.id
    }
