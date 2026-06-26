"""Phase 7-D: Unified match intelligence endpoint.

Route: GET /matches/upcoming/{match_id}/full-analysis

Orchestrates the 6-layer intelligence pipeline:
  1. Ensemble prediction (league model)
  2. BNN uncertainty breakdown
  3. Causal feature analysis
  4. RL betting recommendation (Kelly fallback)
  5. Elo context
  6. StatsBomb tactical features (via UpcomingMatchFeatureProjector)

Then fuses layers via IntelligenceSynthesizer → FullMatchAnalysisResponse.

Cache: Redis key full_analysis:{match_id}, TTL 60s (B13: stale features are
preferable to synthetic substitution; staleness is surfaced via data_gaps).
Rate limit: 30 req/min per IP (enforced at Fastify gateway; this layer trusts
the gateway).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import numpy as np

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.cache import cache
from ...core.config import settings
from ...data.elo_engine import EloContext
from ...db.session import get_async_session
from ...models.causal_selector import CausalFeatureResult
from ...models.feature_registry import active_canonical_features
from ...services.intelligence_synthesizer import (
    EnsemblePrediction,
    FullMatchAnalysisResponse,
    IntelligenceSynthesizer,
    MatchActionability,
    OddsEdge,
)
from ...models.prediction import PredictionEngine
from ...services.rl_betting_agent import RLBettingAgent, RLRecommendationPayload
from ...services.uncertainty_service import UncertaintyBreakdown, UncertaintyService
from ...services.upcoming_match_feature_service import UpcomingMatchFeatureProjector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/matches", tags=["intelligence"])

_CACHE_TTL_SECONDS = 60


def _default_live_vector(
    league: str,
    canonical_features: List[str],
) -> Dict[str, Any]:
    """Return a zero-filled live payload with all canonical features marked as data gaps."""
    features = np.zeros(len(canonical_features), dtype=np.float32)
    features_dict = {f: 0.0 for f in canonical_features}
    return {
        "features": features,
        "features_58": features[:58],
        "features_dict": features_dict,
        "data_gaps": list(canonical_features),
        "staleness_seconds": 0,
        "staleness_available": False,
        "elo_pre_match": 0.0,
        "league": league,
        "odds": None,
    }


def _empty_ensemble(league: str) -> EnsemblePrediction:
    return EnsemblePrediction(
        home_win_prob=0.0,
        draw_prob=0.0,
        away_win_prob=0.0,
        prediction="unavailable",
        confidence=0.0,
        league=league,
        model_version="unavailable",
        calibration_method="unavailable",
        calibration_applied=False,
        overlay_applied=False,
    )


def _ensemble_from_prediction(pred: Dict[str, Any], league: str) -> Optional[EnsemblePrediction]:
    probs = pred.get("predictions")
    if not isinstance(probs, dict):
        probs = pred

    try:
        h_raw = probs.get("home_win", probs.get("home_win_prob"))
        d_raw = probs.get("draw", probs.get("draw_prob"))
        a_raw = probs.get("away_win", probs.get("away_win_prob"))
        if h_raw is None or d_raw is None or a_raw is None:
            return None
        h = float(h_raw)
        d = float(d_raw)
        a = float(a_raw)
    except (TypeError, ValueError, AttributeError):
        return None

    total = h + d + a
    if total <= 0:
        return None
    h, d, a = h / total, d / total, a / total
    prediction = max({"home_win": h, "draw": d, "away_win": a}, key=lambda k: {"home_win": h, "draw": d, "away_win": a}[k])
    return EnsemblePrediction(
        home_win_prob=h,
        draw_prob=d,
        away_win_prob=a,
        prediction=prediction,
        confidence=max(h, d, a),
        league=league,
        model_version=str(pred.get("model_version", "")),
        calibration_method=str(pred.get("calibration_method", "raw")),
        calibration_applied=bool(pred.get("calibration_applied", False)),
        overlay_applied=bool(pred.get("overlay_applied", False)),
    )


def _uncertainty_from_features(features: Dict[str, Any]) -> UncertaintyBreakdown:
    unc_svc = UncertaintyService()
    try:
        return unc_svc.compute_from_defaults(
            home_win_prob=features.get("market_prob_home", 0.42),
            draw_prob=features.get("market_prob_draw", 0.26),
            away_win_prob=features.get("market_prob_away", 0.32),
        )
    except Exception:
        return UncertaintyBreakdown(
            epistemic_unc=0.15,
            aleatoric_unc=0.12,
            concentration=1.8,
            credible_interval=(0.25, 0.55),
            confidence_tier="OK",
        )


def _causal_results_from_report(
    report_path: str,
    limit: int = 58,
) -> List[CausalFeatureResult]:
    from pathlib import Path

    path = Path(report_path)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        features = payload.get("features", []) if isinstance(payload, dict) else []
        results = []
        for f in features[:limit]:
            if not isinstance(f, dict):
                continue
            ci = f.get("ate_ci", [0.0, 0.0])
            if not isinstance(ci, (list, tuple)) or len(ci) < 2:
                ci = [0.0, 0.0]
            results.append(
                CausalFeatureResult(
                    name=str(f.get("name", "")),
                    ate_win=float(f.get("ate_win", 0.0)),
                    ate_draw=float(f.get("ate_draw", 0.0)),
                    ate_ci=(float(ci[0]), float(ci[1])),
                    p_value=float(f.get("p_value", 1.0)),
                    classification=str(f.get("classification", "INDEPENDENT")),
                )
            )
        return results
    except Exception as exc:
        logger.warning("Could not load causal report from %s: %s", report_path, exc)
        return []


def _rl_from_ensemble(
    ensemble: EnsemblePrediction,
    odds: Optional[Dict[str, float]] = None,
) -> RLRecommendationPayload:
    probs = {
        "home_win": ensemble.home_win_prob,
        "draw": ensemble.draw_prob,
        "away_win": ensemble.away_win_prob,
    }
    if odds is None:
        return RLRecommendationPayload(
            stake_fraction=0.0,
            abstain=True,
            reward_components={"R_pnl": 0.0, "R_ic": 0.0, "R_cal": 0.0, "R_risk": 0.0, "R_abs": 0.05},
            reason="Abstained: market odds unavailable",
        )
    agent = RLBettingAgent()
    return agent.recommend(
        probabilities=probs,
        odds=odds,
        confidence=ensemble.confidence,
        epistemic_unc=0.12,
    )


def _elo_from_features(features: Dict[str, Any]) -> EloContext:
    return EloContext(
        home_elo=float(features.get("home_elo", 1500.0)),
        away_elo=float(features.get("away_elo", 1500.0)),
        elo_difference=float(features.get("elo_difference", 0.0)),
        home_elo_trend_5=float(features.get("elo_home_trend_5", 0.0)),
        away_elo_trend_5=float(features.get("elo_away_trend_5", 0.0)),
        elo_momentum_cross=float(features.get("elo_momentum_cross", 0.0)),
    )


def _odds_edge_from_features(
    ensemble: EnsemblePrediction,
    odds: Optional[Dict[str, float]],
) -> Optional[OddsEdge]:
    if odds is None:
        return None

    normalized_odds = {
        "home_win": float(odds.get("home_win", odds.get("home", 0.0)) or 0.0),
        "draw": float(odds.get("draw", 0.0) or 0.0),
        "away_win": float(odds.get("away_win", odds.get("away", 0.0)) or 0.0),
    }
    if any(value <= 1.0 for value in normalized_odds.values()):
        return None

    raw_implied = {market: 1.0 / price for market, price in normalized_odds.items()}
    overround = sum(raw_implied.values())
    if overround <= 0:
        return None
    fair_market = {market: implied / overround for market, implied in raw_implied.items()}
    model_probs = {
        "home_win": ensemble.home_win_prob,
        "draw": ensemble.draw_prob,
        "away_win": ensemble.away_win_prob,
    }

    best: Optional[tuple[str, float, float, float, float]] = None
    for market, market_odds in normalized_odds.items():
        model_prob = float(model_probs.get(market, 0.0))
        edge = model_prob - fair_market[market]
        expected_value = (model_prob * market_odds) - 1.0
        denom = market_odds - 1.0
        kelly = max(0.0, expected_value / denom) if denom > 0 and expected_value > 0 else 0.0
        candidate = (market, market_odds, model_prob, edge, kelly)
        if best is None or (edge > best[3] and expected_value > 0):
            best = candidate

    if best is None or best[3] <= 0:
        return None

    market, market_odds, model_prob, edge, kelly = best
    from ...core.config import settings

    return OddsEdge(
        market=market,
        market_odds=market_odds,
        model_prob=model_prob,
        edge=edge,
        kelly_stake=min(kelly, settings.rl_max_kelly_cap),
    )


# ─── Edge-quality / actionability helpers (Sprint 4 Slice A) ─────────────────


def _compute_edge_quality_score(
    ensemble: EnsemblePrediction,
    odds_edge: Optional[OddsEdge],
    features_dict: dict,
    data_gaps: List[str],
    n_canonical: int,
) -> float:
    """Return a 0.0–1.0 advisory edge quality score.

    Combines model confidence, market edge alignment, Phase 8 drift direction,
    and data completeness.  score < settings.edge_quality_abstain_threshold
    triggers the advisory ABSTAIN gate.
    """
    # Component 1: confidence above random (1/3) baseline
    confidence_factor = max(0.0, min(1.0, (ensemble.confidence - 0.333) / 0.5))

    # Component 2: market edge relative to a 15pp benchmark
    if odds_edge is not None and odds_edge.edge > 0:
        market_alignment = min(1.0, odds_edge.edge / 0.15)
    else:
        market_alignment = 0.0

    # Component 3: Phase 8 sharp-money drift toward predicted outcome
    drift_map = {
        "home_win": "odds_drift_home",
        "draw": "odds_drift_draw",
        "away_win": "odds_drift_away",
    }
    drift_key = drift_map.get(ensemble.prediction, "")
    if drift_key and drift_key not in data_gaps:
        drift_val = float(features_dict.get(drift_key, 0.0))
        drift_alignment = min(1.0, max(0.0, drift_val / 0.05))
    else:
        drift_alignment = 0.0

    # Component 4: data completeness (fewer gaps = higher completeness)
    completeness = max(0.0, 1.0 - len(data_gaps) / max(1, n_canonical))

    score = (
        0.40 * confidence_factor
        + 0.30 * market_alignment
        + 0.20 * drift_alignment
        + 0.10 * completeness
    )
    return round(min(1.0, max(0.0, score)), 4)


def _closing_line_convergence_delta(
    ensemble: EnsemblePrediction,
    features_dict: dict,
    data_gaps: List[str],
) -> Optional[float]:
    """Return opening→current implied-probability drift for the predicted outcome.

    Positive = market has moved toward that outcome (sharp-money confirms model
    direction).  Returns None when market-drift data is a DATA_GAP.
    """
    drift_map = {
        "home_win": "odds_drift_home",
        "draw": "odds_drift_draw",
        "away_win": "odds_drift_away",
    }
    drift_key = drift_map.get(ensemble.prediction, "")
    if not drift_key or drift_key in data_gaps:
        return None
    val = features_dict.get(drift_key)
    return round(float(val), 4) if val is not None else None


def _build_actionability(
    ensemble: EnsemblePrediction,
    odds_edge: Optional[OddsEdge],
    features_dict: dict,
    data_gaps: List[str],
    causal_results: List[CausalFeatureResult],
    rl_rec,
    uncertainty,
    canonical_feature_count: int,
) -> MatchActionability:
    """Build the advisory MatchActionability block for this analysis."""
    edge_score = _compute_edge_quality_score(
        ensemble, odds_edge, features_dict, data_gaps, canonical_feature_count
    )
    conv_delta = _closing_line_convergence_delta(ensemble, features_dict, data_gaps)

    should_abstain = rl_rec.abstain or edge_score < settings.edge_quality_abstain_threshold
    if should_abstain:
        suggested_stake_pct = 0.0
    else:
        suggested_stake_pct = round(
            (odds_edge.kelly_stake * 100)
            if odds_edge is not None and odds_edge.kelly_stake > 0
            else 0.0,
            2,
        )

    # Top evidence: causal drivers first, then market and drift signals
    top_evidence: List[str] = []
    for r in causal_results:
        if r.classification == "CAUSAL_DRIVER" and len(top_evidence) < 3:
            top_evidence.append(r.name.replace("_", " ").title())
    if odds_edge is not None and odds_edge.edge > 0 and len(top_evidence) < 3:
        top_evidence.append(
            f"Market edge +{round(odds_edge.edge * 100, 1)}pp on {odds_edge.market.replace('_', ' ')}"
        )
    if conv_delta is not None and conv_delta > 0.02 and len(top_evidence) < 3:
        top_evidence.append(
            f"Sharp drift +{conv_delta:.3f} toward {ensemble.prediction.replace('_', ' ')}"
        )

    # Caveats: low evidence, data gaps, or score-below-threshold warnings
    caveats: List[str] = []
    if uncertainty.confidence_tier == "LOW_EVIDENCE":
        caveats.append(f"Low model evidence (epistemic {uncertainty.epistemic_unc:.2f})")
    # Exclude structural always-gap features from user-visible caveat count
    important_gaps = [g for g in data_gaps if g not in ("shot_quality_diff",)]
    if important_gaps:
        caveats.append(
            f"{len(important_gaps)} live data gap(s): {', '.join(important_gaps[:3])}"
        )
    if not rl_rec.abstain and edge_score < settings.edge_quality_abstain_threshold:
        caveats.append(
            f"Edge quality below threshold ({edge_score:.2f} < {settings.edge_quality_abstain_threshold:.2f})"
        )

    return MatchActionability(
        edge_quality_score=edge_score,
        clv_pct=None,  # pre-kick-off: true CLV requires closing odds (Sprint 5)
        closing_line_convergence_delta=conv_delta,
        suggested_stake_pct=suggested_stake_pct,
        abstain=should_abstain,
        abstain_reason=rl_rec.reason if should_abstain else None,
        top_evidence=top_evidence,
        caveats=caveats,
    )


@router.get(
    "/upcoming/{match_id}/full-analysis",
    summary="Unified 6-layer match intelligence",
    response_model=None,
)
async def get_full_analysis(
    match_id: str,
    league: str = Query(default="EPL", description="League for matchup-based lookups"),
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """Return fused TYPE-F verdict: ensemble × BNN × causal × RL × Elo × StatsBomb.

    `match_id` may be either:
    - A database UUID / integer ID ("123", "abc-...")
    - A matchup string ("Arsenal vs Chelsea") — home/away are parsed and features
      are built without requiring a DB match record (P7-E live data wiring).
    """

    cache_key = f"full_analysis:{match_id}:{league}"
    cached = cache.get(cache_key) if cache else None
    if cached:
        try:
            return json.loads(cached) if isinstance(cached, str) else cached
        except Exception:
            pass

    projector = UpcomingMatchFeatureProjector()
    prediction_engine = PredictionEngine()
    synthesizer = IntelligenceSynthesizer()
    canonical_features = active_canonical_features(
        use_phase7=settings.use_phase7_models,
        use_phase8=settings.phase8_enabled,
    )

    # Detect matchup strings like "Arsenal vs Chelsea"
    _is_matchup = " vs " in match_id or " VS " in match_id

    try:
        if _is_matchup:
            sep = " vs " if " vs " in match_id else " VS "
            parts = match_id.split(sep, 1)
            home_team = parts[0].strip()
            away_team = parts[1].strip() if len(parts) > 1 else "Unknown"
            live = await projector.build_live_feature_vector_from_matchup(
                home_team=home_team,
                away_team=away_team,
                league=league,
                db=db,
            )
        else:
            live = await projector.build_live_feature_vector(
                match_id=match_id,
                league=league,
                db=db,
            )
    except Exception as exc:
        logger.warning(
            "Feature projection failed for match_id=%r league=%r: %s: %s — "
            "falling back to default zero-vector (all DATA_GAP)",
            match_id, league, type(exc).__name__, exc,
        )
        # Return a partial analysis rather than 404: all features are DATA_GAP,
        # but the synthesis pipeline still runs and sets partial_intelligence=true.
        live = _default_live_vector(league, list(canonical_features))

    league = str(live.get("league", league) or league)
    data_gaps: List[str] = list(live.get("data_gaps", []))

    # Layer 1: Ensemble prediction (Phase 8 canonical path — full feature vector)
    try:
        full_features = np.asarray(
            live.get("features")
            if live.get("features") is not None
            else np.asarray(list(live.get("features_dict", {}).values()), dtype=np.float32),
            dtype=np.float32,
        )
        pred_result = await prediction_engine.predict(
            features=full_features,
            league=league,
            match_id=match_id,
        )
        raw_pred = pred_result.to_dict()
    except Exception as exc:
        logger.warning("Ensemble prediction failed for %s: %s", match_id, exc)
        data_gaps.append("ensemble_prediction")
        raw_pred = {}

    ensemble = _ensemble_from_prediction(raw_pred, league)
    if ensemble is None:
        data_gaps.append("ensemble_prediction")
        ensemble = _empty_ensemble(league)
    features_dict = live.get("features_dict", {})

    # Layer 2: BNN uncertainty
    uncertainty = _uncertainty_from_features(features_dict)

    # Layer 3: Causal drivers (read-only; path controlled via CAUSAL_REPORT_PATH env var)
    causal_results = _causal_results_from_report(str(settings.causal_report_path))
    if not causal_results:
        data_gaps.append("causal_analysis")

    # Layer 4: RL recommendation
    market_odds: Optional[Dict[str, float]] = live.get("odds") or None
    rl_rec = _rl_from_ensemble(ensemble, odds=market_odds)

    # Layer 5: Elo context
    elo_ctx = _elo_from_features(features_dict)
    if elo_ctx.elo_difference == 0.0 and elo_ctx.home_elo == 1500.0:
        data_gaps.append("elo_ratings")

    # Layer 6: Odds edge (optional)
    odds_edge = _odds_edge_from_features(ensemble, market_odds)

    # Advisory actionability block (Sprint 4 Slice A)
    deduped_gaps = sorted(set(data_gaps))
    actionability = _build_actionability(
        ensemble=ensemble,
        odds_edge=odds_edge,
        features_dict=features_dict,
        data_gaps=deduped_gaps,
        causal_results=causal_results,
        rl_rec=rl_rec,
        uncertainty=uncertainty,
        canonical_feature_count=len(canonical_features),
    )

    # Fuse
    response: FullMatchAnalysisResponse = synthesizer.synthesize(
        match_id=match_id,
        ensemble=ensemble,
        uncertainty=uncertainty,
        causal_results=causal_results,
        rl_rec=rl_rec,
        elo_ctx=elo_ctx,
        odds_edge=odds_edge,
        data_gaps=deduped_gaps,
        actionability=actionability,
        staleness_seconds=int(live.get("staleness_seconds", 0)),
        staleness_available=bool(live.get("staleness_available", "staleness_seconds" in live)),
        feature_freshness_seconds=dict(live.get("feature_freshness_seconds") or {}),
        feature_source=dict(live.get("feature_source") or {}),
        features_dict=features_dict,
    )

    result = response.to_dict()

    if cache:
        try:
            cache.set(cache_key, json.dumps(result), ttl=_CACHE_TTL_SECONDS)
        except Exception as exc:
            logger.debug("Cache write failed for %s: %s", match_id, exc)

    return result
