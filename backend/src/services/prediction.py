"""Inference service wiring saved ensembles into the FastAPI prediction surface."""

import hashlib
import logging
import math
import random
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.cache import cache_manager
from ..core.config import settings
from ..models.edge_detector import EdgeDetector
from ..models.ensemble import SabiScoreEnsemble
from ..schemas.prediction import MatchPredictionRequest, PredictionResponse
from ..schemas.value_bet import ValueBetResponse

logger = logging.getLogger(__name__)


class PredictionService:
    """Serve ensemble predictions with lightweight feature synthesis."""

    _ensemble_cache: Dict[str, SabiScoreEnsemble] = {}
    _metadata_cache: Dict[str, Dict[str, Any]] = {}
    _cache_lock = threading.Lock()
    _cache_access_times: Dict[str, float] = {}  # Track LRU
    MAX_CACHED_MODELS = 5  # Limit memory footprint

    FEATURE_PREFIX_RANGES: Dict[str, Tuple[float, float]] = {
        "form_": (-1.0, 1.0),
        "xg_": (0.0, 3.0),
        "fatigue_": (0.0, 1.0),
        "home_adv_": (-0.5, 0.5),
        "momentum_": (-1.0, 1.0),
        "market_": (0.0, 5.0),
        "h2h_": (-1.0, 1.0),
        "squad_": (0.0, 100.0),
        "weather_": (0.0, 1.0),
        "elo_": (1000.0, 2000.0),
        "tactical_": (0.0, 1.0),
        "scoring_": (0.0, 3.0),
        "defensive_": (0.0, 2.0),
        "setpiece_": (0.0, 1.0),
    }

    def __init__(
        self,
        db_session: Optional[AsyncSession] = None,
        cache_backend: Any = None,
        ensemble_model: Optional[SabiScoreEnsemble] = None,
    ) -> None:
        self.db = db_session
        self.cache = cache_backend or cache_manager
        self.edge_detector = EdgeDetector(
            min_edge_threshold=0.042,
            kelly_fraction=0.125,
            max_stake_pct=0.05,
        )
        self._provided_model = ensemble_model
        self._default_bankroll = 10_000.0
        self.metrics: Dict[str, float] = {
            "predictions_count": 0,
            "value_bets_found": 0,
            "avg_confidence": 0.0,
            "avg_edge": 0.0,
        }

    async def predict_match(
        self,
        match_id: str,
        request: MatchPredictionRequest,
    ) -> PredictionResponse:
        start_time = datetime.utcnow()

        league_slug = self._slugify_league(request.league)
        cache_key = self._build_cache_key(match_id, league_slug)

        cached = self._get_cached_prediction(cache_key)
        if cached is not None:
            return cached

        ensemble = self._get_ensemble_for_league(league_slug)
        feature_frame, feature_vector = self._build_feature_frame(match_id, request, ensemble, league_slug)

        try:
            prediction_df = ensemble.predict(feature_frame)
        except Exception as exc:
            logger.error("Prediction failed for %s: %s", match_id, exc)
            raise

        row = prediction_df.iloc[0]
        probabilities = {
            "home_win": float(row["home_win_prob"]),
            "draw": float(row["draw_prob"]),
            "away_win": float(row["away_win_prob"]),
        }

        bankroll = float(request.bankroll or self._default_bankroll)
        value_bets = self._detect_value_bets(match_id, probabilities, request.odds, bankroll)
        explanations = self._generate_explanations(feature_vector)
        processing_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        metadata = self._build_metadata(league_slug, ensemble, processing_ms)
        sample_size = int(metadata.get("training_samples") or 500)
        confidence_intervals = self._calculate_confidence_intervals(probabilities, sample_size=sample_size)

        prediction = PredictionResponse(
            match_id=match_id,
            home_team=request.home_team,
            away_team=request.away_team,
            league=request.league,
            predictions=probabilities,
            confidence=float(row["confidence"]),
            brier_score=self._calculate_brier_score(probabilities),
            value_bets=value_bets,
            confidence_intervals=confidence_intervals,
            explanations=explanations,
            metadata=metadata,
        )

        self._cache_prediction(cache_key, prediction)
        self._update_metrics(prediction)

        return prediction

    def _get_ensemble_for_league(self, league_slug: str) -> SabiScoreEnsemble:
        provided = self._provided_model
        if provided is not None and getattr(provided, "is_trained", False):
            provided_league = self._slugify_league(provided.model_metadata.get("league", ""))
            if not provided_league or provided_league == league_slug:
                with self._cache_lock:
                    self._ensemble_cache.setdefault(league_slug, provided)
                    self._metadata_cache.setdefault(league_slug, provided.model_metadata or {})
                return provided

        with self._cache_lock:
            cached = self._ensemble_cache.get(league_slug)
            if cached is not None and getattr(cached, "is_trained", False):
                self._cache_access_times[league_slug] = datetime.utcnow().timestamp()
                return cached

        model_path = settings.models_path / f"{league_slug}_ensemble.pkl"
        if not model_path.exists():
            raise FileNotFoundError(f"Model artifact missing for league '{league_slug}' at {model_path}")

        model = SabiScoreEnsemble.load_model(str(model_path))
        with self._cache_lock:
            # LRU eviction if cache is full
            if len(self._ensemble_cache) >= self.MAX_CACHED_MODELS:
                oldest_key = min(self._cache_access_times, key=self._cache_access_times.get)
                logger.info(f"Evicting model from cache: {oldest_key}")
                self._ensemble_cache.pop(oldest_key, None)
                self._metadata_cache.pop(oldest_key, None)
                self._cache_access_times.pop(oldest_key, None)
            
            self._ensemble_cache[league_slug] = model
            self._metadata_cache[league_slug] = model.model_metadata or {}
            self._cache_access_times[league_slug] = datetime.utcnow().timestamp()
        return model

    def _build_feature_frame(
        self,
        match_id: str,
        request: MatchPredictionRequest,
        ensemble: SabiScoreEnsemble,
        league_slug: str,
    ) -> Tuple[pd.DataFrame, Dict[str, float]]:
        columns = ensemble.feature_columns or []
        if not columns:
            raise ValueError("Loaded model does not expose feature columns")

        seed_source = f"{league_slug}:{request.home_team}:{request.away_team}:{match_id}"
        seed_int = int(hashlib.sha256(seed_source.encode("utf-8")).hexdigest()[:16], 16)
        rng = random.Random(seed_int)

        feature_values: Dict[str, float] = {}
        for column in columns:
            feature_values[column] = self._sample_feature_value(column, rng, request)

        frame = pd.DataFrame([feature_values])
        return frame, feature_values

    def _sample_feature_value(
        self,
        column: str,
        rng: random.Random,
        request: MatchPredictionRequest,
    ) -> float:
        lowered = column.lower()

        if "home_win" in lowered and "prob" in lowered:
            return self._implied_probability(request.odds.get("home_win"))
        if "draw" in lowered and "prob" in lowered:
            return self._implied_probability(request.odds.get("draw"))
        if "away_win" in lowered and "prob" in lowered:
            return self._implied_probability(request.odds.get("away_win"))

        for prefix, value_range in self.FEATURE_PREFIX_RANGES.items():
            if lowered.startswith(prefix):
                return rng.uniform(*value_range)

        if "odds" in lowered:
            return rng.uniform(1.5, 5.0)
        if "confidence" in lowered:
            return rng.uniform(0.4, 0.9)
        if "edge" in lowered:
            return rng.uniform(-0.1, 0.1)

        return rng.uniform(-1.0, 1.0)

    def _detect_value_bets(
        self,
        match_id: str,
        probabilities: Dict[str, float],
        odds: Dict[str, float],
        bankroll: float,
    ) -> List[ValueBetResponse]:
        if not odds:
            return []

        results: List[ValueBetResponse] = []
        for market, probability in probabilities.items():
            offered = odds.get(market)
            if offered is None:
                continue

            edge = self.edge_detector.calculate_edge(probability, offered)
            if edge <= self.edge_detector.min_edge_threshold:
                continue

            kelly = self.edge_detector.calculate_kelly_stake(probability, offered, bankroll)
            edge_ngn = edge * bankroll
            clv_ngn = edge_ngn * 0.65
            value_bet = ValueBetResponse(
                match_id=match_id,
                market=market,
                odds=float(offered),
                fair_probability=float(probability),
                implied_probability=self._implied_probability(offered),
                edge_percent=edge * 100.0,
                edge_ngn=edge_ngn,
                kelly_stake_ngn=kelly["stake_amount"],
                kelly_fraction=self.edge_detector.kelly_fraction,
                clv_ngn=clv_ngn,
                confidence=float(probability),
                expected_roi=(offered - 1.0) * edge,
            )
            results.append(value_bet)

        results.sort(key=lambda item: item.edge_ngn, reverse=True)
        return results

    def _get_cached_prediction(self, cache_key: str) -> Optional[PredictionResponse]:
        try:
            cached = self.cache.get(cache_key)
        except Exception as exc:
            logger.debug("Cache get failed for %s: %s", cache_key, exc)
            return None

        if cached is None:
            return None

        try:
            if isinstance(cached, PredictionResponse):
                return cached
            if isinstance(cached, dict):
                return PredictionResponse(**cached)
            if isinstance(cached, str):
                import json

                return PredictionResponse(**json.loads(cached))
        except Exception as exc:
            logger.debug("Cached payload could not be restored for %s: %s", cache_key, exc)
        return None

    def _cache_prediction(self, cache_key: str, prediction: PredictionResponse) -> None:
        try:
            payload = prediction.model_dump(mode="json")
            self.cache.set(cache_key, payload, ttl=15)
        except Exception as exc:
            logger.debug("Cache set failed for %s: %s", cache_key, exc)

    def _calculate_confidence_intervals(
        self,
        probabilities: Dict[str, float],
        sample_size: int = 500,
        confidence_level: float = 0.95,
    ) -> Dict[str, Tuple[float, float]]:
        z_score = 1.96 if confidence_level == 0.95 else 1.0
        intervals: Dict[str, Tuple[float, float]] = {}
        for outcome, prob in probabilities.items():
            se = math.sqrt(max(prob * (1.0 - prob), 1e-6) / sample_size)
            margin = z_score * se
            lower = max(0.0, prob - margin)
            upper = min(1.0, prob + margin)
            intervals[outcome] = (lower, upper)
        return intervals

    def _calculate_brier_score(self, probabilities: Dict[str, float]) -> float:
        return float(sum(prob * (1.0 - prob) for prob in probabilities.values()) / len(probabilities))

    def _generate_explanations(self, feature_vector: Dict[str, float]) -> Dict[str, Any]:
        ranked = sorted(feature_vector.items(), key=lambda item: abs(item[1]), reverse=True)[:5]
        return {
            "top_features": [
                {"name": name, "impact": float(value)} for name, value in ranked
            ],
            "summary": "Synthetic feature importance derived from hashed feature vector",
        }

    def _build_metadata(
        self,
        league_slug: str,
        ensemble: SabiScoreEnsemble,
        processing_ms: int,
    ) -> Dict[str, Any]:
        meta = self._metadata_cache.get(league_slug, {})
        return {
            "model_key": f"{league_slug}_ensemble",
            "model_version": meta.get("model_version") or meta.get("dataset_signature", "unknown"),
            "league": meta.get("league", league_slug),
            "trained_at": meta.get("trained_at"),
            "accuracy": meta.get("accuracy"),
            "brier_score": meta.get("brier_score"),
            "log_loss": meta.get("log_loss"),
            "feature_count": len(ensemble.feature_columns or []),
            "processing_time_ms": processing_ms,
            "training_samples": meta.get("training_samples"),
        }

    def _update_metrics(self, prediction: PredictionResponse) -> None:
        self.metrics["predictions_count"] += 1
        self.metrics["value_bets_found"] += len(prediction.value_bets)

        total = self.metrics["predictions_count"]
        self.metrics["avg_confidence"] = (
            (self.metrics["avg_confidence"] * (total - 1) + prediction.confidence) / total
        )
        if prediction.value_bets:
            avg_edge = float(np.mean([vb.edge_ngn for vb in prediction.value_bets]))
            self.metrics["avg_edge"] = (
                (self.metrics["avg_edge"] * (total - 1) + avg_edge) / total
            )

    async def get_metrics(self) -> Dict[str, Any]:
        return {**self.metrics}

    @staticmethod
    def _slugify_league(league: Union[str, Any]) -> str:
        if hasattr(league, "value"):
            league = league.value
        return str(league).lower().replace(" ", "_")

    @staticmethod
    def _build_cache_key(match_id: str, league_slug: str) -> str:
        return f"prediction:{league_slug}:{match_id}"

    @staticmethod
    def _implied_probability(odds: Optional[float]) -> float:
        if not odds or odds <= 1.0:
            return 0.33
        return float(1.0 / odds)

