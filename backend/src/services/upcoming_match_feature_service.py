"""
Upcoming Match Feature Projection Service

Projects upcoming match data to 58-dimensional canonical feature space
for use with trained ML models. Handles missing historical data via defaults.

Phase 8 Sprint 4: _inject_phase8_features now wires real market drift (via
OddsHistory opening snapshot + current OddsService) and real match importance
(via LeagueStanding query), returning per-feature freshness metadata.
shot_quality_diff is permanently DATA_GAP per PHASE7_FEATURES_ALWAYS_DATA_GAP.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.database import Match, MatchStats, Team
from ..data.elo_engine import EloEngine
from ..data.enrichment.statsbomb_aggregator import StatsBombAggregator
from ..features.berrar_ratings import BerrarRatingSystem
from ..features.form import weighted_form_features
from ..features.market import MARKET_FEATURE_NAMES, compute_market_drift
from ..features.match_context import CONTEXT_FEATURE_NAMES, compute_match_context
from ..features.pi_ratings import PiRatingSystem
from ..models.feature_registry import (
    CANONICAL_FEATURES_58,
    PHASE7_FEATURES_ALWAYS_DATA_GAP,
    PHASE8_FEATURES_CONTEXT,
    PHASE8_FEATURES_MARKET,
    active_canonical_features,
    active_default_feature_values,
)
from .odds_service import OddsService
from .scraped_feature_store import ScrapedTeamFormStore

logger = logging.getLogger(__name__)


def _canonical_form_features(stats: Dict[str, float], side: str) -> Dict[str, float]:
    """Map real database/scraper form statistics into the canonical model schema."""
    prefix = "home" if side == "home" else "away"
    ppg = float(stats.get("ppg_5", float(stats.get("home_form_5", 0.0)) * 3.0))
    wins = float(stats.get("wins_5", round(float(stats.get("home_win_rate_5", 0.0)) * 5.0)))
    draws = float(stats.get("draws_5", 0.0))
    losses = float(stats.get("losses_5", max(0.0, 5.0 - wins - draws)))
    goals_for = float(stats.get("goals_for_avg_5", stats.get("home_goals_per_match_5", 0.0)))
    goals_against = float(stats.get("goals_against_avg_5", stats.get("home_goals_conceded_per_match_5", 0.0)))
    gd = float(stats.get("gd_avg_5", stats.get("home_gd_avg_5", goals_for - goals_against)))

    if prefix == "home":
        return {
            "home_form_last5_home": ppg,
            "home_wins_last5_home": wins,
            "home_draws_last5_home": draws,
            "home_losses_last5_home": losses,
            "home_goals_for_avg": goals_for,
            "home_goals_against_avg": goals_against,
            "home_gd_recent": gd,
        }
    return {
        "away_form_last5_away": ppg,
        "away_wins_last5_away": wins,
        "away_draws_last5_away": draws,
        "away_losses_last5_away": losses,
        "away_goals_for_avg": goals_for,
        "away_goals_against_avg": goals_against,
        "away_gd_recent": gd,
    }


class UpcomingMatchFeatureProjector:
    """Project upcoming matches to canonical feature space (68 or 86 dimensions)."""

    def __init__(self) -> None:
        self._use_phase8 = settings.phase8_enabled
        self.canonical_features = active_canonical_features(
            use_phase7=settings.use_phase7_models,
            use_phase8=self._use_phase8,
        )
        self.defaults = active_default_feature_values(
            use_phase7=settings.use_phase7_models,
            use_phase8=self._use_phase8,
        )
        self.elo_engine = EloEngine()
        self.statsbomb = StatsBombAggregator()
        self.pi_engine = PiRatingSystem(
            parquet_path=settings.pi_ratings_parquet_path
        )
        self.berrar_engine = BerrarRatingSystem(
            parquet_path=settings.berrar_ratings_parquet_path
        )
        self.odds_service = OddsService()
        self.scraped_form_store = ScrapedTeamFormStore()

    async def project_match_features(
        self,
        match_dict: Dict[str, Any],
        db: AsyncSession,
        match_date: datetime,
    ) -> Dict[str, Any]:
        """
        Project upcoming match to 58-dimensional feature vector.

        Args:
            match_dict: Normalized match from FootballDataAPIClient
                {"id", "home_team", "away_team", "league", "match_date", ...}
            db: Database session
            match_date: Match datetime

        Returns:
            {
                "match_id": str,
                "home_team": str,
                "away_team": str,
                "features_68": np.ndarray (68,),
                "features_dict": Dict with feature names,
                "data_quality": {
                    "historical_data_ratio": float (0-1),
                    "defaults_used_count": int,
                    "is_synthetic": bool
                }
            }
        """

        home_team_id = await self._get_team_id_by_name(match_dict["home_team"], db)
        away_team_id = await self._get_team_id_by_name(match_dict["away_team"], db)

        if not home_team_id or not away_team_id:
            logger.warning(
                "Could not find teams: %s vs %s",
                match_dict["home_team"],
                match_dict["away_team"],
            )
            home_team_id = home_team_id or match_dict["home_team"]
            away_team_id = away_team_id or match_dict["away_team"]

        home_stats = await self._get_team_stats(home_team_id, db, match_date)
        away_stats = await self._get_team_stats(away_team_id, db, match_date)
        feature_sources: Dict[str, str] = {}
        league = str(match_dict.get("league") or "EPL").upper()

        if home_stats is None:
            scraped = self.scraped_form_store.get_team_form(
                competition=league,
                team=str(match_dict["home_team"]),
                information_cutoff=match_date,
            )
            if scraped is not None:
                home_stats = scraped.to_projection_stats()
                feature_sources["home_form"] = f"node-scraper:{scraped.source_file.name}"
        else:
            feature_sources["home_form"] = "database"

        if away_stats is None:
            scraped = self.scraped_form_store.get_team_form(
                competition=league,
                team=str(match_dict["away_team"]),
                information_cutoff=match_date,
            )
            if scraped is not None:
                away_stats = scraped.to_projection_stats()
                feature_sources["away_form"] = f"node-scraper:{scraped.source_file.name}"
        else:
            feature_sources["away_form"] = "database"

        features_dict = dict(self.defaults)
        resolved_features: set[str] = set()

        if home_stats:
            mapped = _canonical_form_features(home_stats, "home")
            features_dict.update(mapped)
            resolved_features.update(mapped)

        if away_stats:
            mapped = _canonical_form_features(away_stats, "away")
            features_dict.update(mapped)
            resolved_features.update(mapped)

        if home_stats and away_stats:
            derived = {
                "total_goals_expected": features_dict["home_goals_for_avg"] + features_dict["away_goals_for_avg"],
                "combined_attack": features_dict["home_goals_for_avg"] + features_dict["away_goals_for_avg"],
                "combined_defense_weakness": features_dict["home_goals_against_avg"] + features_dict["away_goals_against_avg"],
                "home_attack_vs_away_defense": features_dict["home_goals_for_avg"] - features_dict["away_goals_against_avg"],
                "away_attack_vs_home_defense": features_dict["away_goals_for_avg"] - features_dict["home_goals_against_avg"],
            }
            features_dict.update(derived)
            resolved_features.update(derived)

        defaults_count = max(0, len(self.defaults) - len(resolved_features))

        features_array = np.array(
            [features_dict.get(f, self.defaults.get(f, 0.0)) for f in self.canonical_features],
            dtype=np.float32,
        )

        data_gaps = [
            feature for feature in self.canonical_features
            if feature not in resolved_features
        ]

        # Preserve DATA_GAP semantics for Phase 7 tactical features that require
        # live StatsBomb data. PHASE7_FEATURES_ALWAYS_DATA_GAP (shot_quality_diff)
        # is always flagged regardless of whether it appears in features_dict.
        for tactical in ("home_pressing_intensity", "progressive_carry_diff"):
            if tactical not in features_dict:
                features_dict[tactical] = self.defaults.get(tactical, 0.0)
                if tactical not in data_gaps:
                    data_gaps.append(tactical)

        for always_gap in PHASE7_FEATURES_ALWAYS_DATA_GAP:
            features_dict[always_gap] = self.defaults.get(always_gap, 0.0)
            if always_gap not in data_gaps:
                data_gaps.append(always_gap)

        if len(features_array) != len(self.canonical_features):
            logger.error(
                "Feature array has %d dimensions, expected %d. Padding with defaults.",
                len(features_array),
                len(self.canonical_features),
            )
            if len(features_array) < len(self.canonical_features):
                features_array = np.pad(
                    features_array,
                    (0, len(self.canonical_features) - len(features_array)),
                    mode="constant",
                    constant_values=0.0,
                )

        data_quality = {
            "historical_data_ratio": max(0.0, 1.0 - (defaults_count / len(self.defaults)))
            if self.defaults
            else 0.0,
            "defaults_used_count": max(0, defaults_count),
            "is_synthetic": home_stats is None or away_stats is None,
            "feature_sources": feature_sources,
        }

        return {
            "match_id": match_dict["id"],
            "home_team": match_dict["home_team"],
            "away_team": match_dict["away_team"],
            "home_team_id": home_team_id,
            "away_team_id": away_team_id,
            "features_68": features_array,
            "features_58": features_array[: len(CANONICAL_FEATURES_58)],
            "features_dict": {f: float(features_array[i]) for i, f in enumerate(self.canonical_features)},
            "data_gaps": sorted(set(data_gaps)),
            "data_quality": data_quality,
        }

    async def build_live_feature_vector(
        self,
        match_id: str,
        league: str,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Build 68-dim live feature vector with data gap and staleness metadata."""
        match = await self._get_match(match_id, db)
        if match is None:
            raise ValueError(f"Unknown match_id: {match_id}")

        home_team = await self._get_team_name(match.home_team_id, db)
        away_team = await self._get_team_name(match.away_team_id, db)
        match_date = pd.Timestamp(match.match_date).to_pydatetime()
        season = self._derive_season(match_date)

        projected = await self.project_match_features(
            {
                "id": str(match.id),
                "home_team": home_team or str(match.home_team_id),
                "away_team": away_team or str(match.away_team_id),
                "league": league,
                "match_date": match_date.isoformat(),
            },
            db,
            match_date,
        )

        elo = self.elo_engine.get_context(
            home_team_id=str(match.home_team_id),
            away_team_id=str(match.away_team_id),
            league=league,
            season=season,
            match_date=match_date,
        )
        sb_home = self.statsbomb.get_team_features(str(match.home_team_id), league, match_date)
        sb_away = self.statsbomb.get_team_features(str(match.away_team_id), league, match_date)

        features_dict = dict(projected["features_dict"])
        features_dict["elo_difference"] = float(elo.elo_difference)
        features_dict["elo_home_trend_5"] = float(elo.home_elo_trend_5)
        features_dict["elo_away_trend_5"] = float(elo.away_elo_trend_5)
        features_dict["elo_momentum_cross"] = float(elo.elo_momentum_cross)

        features_dict["home_pressing_intensity"] = float(
            sb_home.features.get("ppda_ratio", 1.0)
            / max(sb_away.features.get("ppda_ratio", 1.0), 1e-6)
        )
        features_dict["progressive_carry_diff"] = float(
            sb_home.features.get("progressive_carry_diff", 0.0)
            - sb_away.features.get("progressive_carry_diff", 0.0)
        )
        # shot_quality_diff is PHASE7_FEATURES_ALWAYS_DATA_GAP — use registry default,
        # never compute from proxy; the injector will enforce DATA_GAP below.
        features_dict["shot_quality_diff"] = self.defaults.get("shot_quality_diff", 0.0)

        match_competition_stage = getattr(match, "competition_stage", None) or "group"
        phase8_gaps, phase8_freshness, phase8_sources = await self._inject_phase8_features(
            features_dict=features_dict,
            home_team_id=str(match.home_team_id),
            away_team_id=str(match.away_team_id),
            home_team=home_team or str(match.home_team_id),
            away_team=away_team or str(match.away_team_id),
            league=league,
            match_id=str(match.id),
            db=db,
            match_date=match_date,
            competition_stage=match_competition_stage,
        )

        features = np.array(
            [float(features_dict.get(name, self.defaults.get(name, 0.0))) for name in self.canonical_features],
            dtype=np.float32,
        )

        data_gaps = sorted(
            set(projected.get("data_gaps", []))
            | set(sb_home.data_gaps)
            | set(sb_away.data_gaps)
            | set(PHASE7_FEATURES_ALWAYS_DATA_GAP)
            | set(phase8_gaps)
        )
        staleness_seconds = max(sb_home.staleness_seconds, sb_away.staleness_seconds)

        return {
            "features": features,
            "features_58": features[: len(CANONICAL_FEATURES_58)],
            "data_gaps": data_gaps,
            "staleness_seconds": staleness_seconds,
            "elo_pre_match": float(elo.elo_difference),
            "features_dict": features_dict,
            "league": league,
            "feature_freshness_seconds": phase8_freshness,
            "feature_source": phase8_sources,
        }

    async def build_live_feature_vector_from_matchup(
        self,
        home_team: str,
        away_team: str,
        league: str,
        db: AsyncSession,
        match_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Build 68-dim live feature vector from team names without a DB match record.

        Used by the full-analysis endpoint when the caller passes a matchup string
        ("Arsenal vs Chelsea") instead of a database match ID (P7-E live data wiring).
        Falls back gracefully to defaults; missing historical data is surfaced in
        data_gaps so the frontend can render the PARTIAL verdict and DATA_GAP badges.
        """
        if match_date is None:
            match_date = datetime.utcnow()

        season = self._derive_season(match_date)

        home_team_id = await self._get_team_id_by_name(home_team, db) or home_team
        away_team_id = await self._get_team_id_by_name(away_team, db) or away_team
        synthetic_match_id = f"{home_team} vs {away_team}"

        projected = await self.project_match_features(
            {
                "id": synthetic_match_id,
                "home_team": home_team,
                "away_team": away_team,
                "league": league,
                "match_date": match_date.isoformat(),
            },
            db,
            match_date,
        )

        elo = self.elo_engine.get_context(
            home_team_id=str(home_team_id),
            away_team_id=str(away_team_id),
            league=league,
            season=season,
            match_date=match_date,
        )
        sb_home = self.statsbomb.get_team_features(str(home_team_id), league, match_date)
        sb_away = self.statsbomb.get_team_features(str(away_team_id), league, match_date)

        features_dict = dict(projected["features_dict"])
        features_dict["elo_difference"] = float(elo.elo_difference)
        features_dict["elo_home_trend_5"] = float(elo.home_elo_trend_5)
        features_dict["elo_away_trend_5"] = float(elo.away_elo_trend_5)
        features_dict["elo_momentum_cross"] = float(elo.elo_momentum_cross)

        features_dict["home_pressing_intensity"] = float(
            sb_home.features.get("ppda_ratio", 1.0)
            / max(sb_away.features.get("ppda_ratio", 1.0), 1e-6)
        )
        features_dict["progressive_carry_diff"] = float(
            sb_home.features.get("progressive_carry_diff", 0.0)
            - sb_away.features.get("progressive_carry_diff", 0.0)
        )
        features_dict["shot_quality_diff"] = self.defaults.get("shot_quality_diff", 0.0)

        phase8_gaps, phase8_freshness, phase8_sources = await self._inject_phase8_features(
            features_dict=features_dict,
            home_team_id=str(home_team_id),
            away_team_id=str(away_team_id),
            home_team=home_team,
            away_team=away_team,
            league=league,
            match_id=synthetic_match_id,
            db=db,
            match_date=match_date,
        )

        features = np.array(
            [float(features_dict.get(name, self.defaults.get(name, 0.0))) for name in self.canonical_features],
            dtype=np.float32,
        )

        data_gaps = sorted(
            set(projected.get("data_gaps", []))
            | set(sb_home.data_gaps)
            | set(sb_away.data_gaps)
            | set(PHASE7_FEATURES_ALWAYS_DATA_GAP)
            | set(phase8_gaps)
        )
        staleness_seconds = max(sb_home.staleness_seconds, sb_away.staleness_seconds)

        return {
            "features": features,
            "features_58": features[: len(CANONICAL_FEATURES_58)],
            "data_gaps": data_gaps,
            "staleness_seconds": staleness_seconds,
            "elo_pre_match": float(elo.elo_difference),
            "features_dict": features_dict,
            "league": league,
            "feature_freshness_seconds": phase8_freshness,
            "feature_source": phase8_sources,
        }

    async def _inject_phase8_features(
        self,
        features_dict: dict,
        home_team_id: str,
        away_team_id: str,
        home_team: str,
        away_team: str,
        league: str,
        match_id: str,
        db: AsyncSession,
        match_date: datetime,
        competition_stage: str = "group",
    ) -> Tuple[List[str], Dict[str, Optional[int]], Dict[str, str]]:
        """Inject Phase 8 features into features_dict in-place.

        Wires real market drift (via OddsHistory) and real match importance
        (via LeagueStanding). In shadow mode (PHASE8_ENRICHMENT_SHADOW=true)
        computed values are logged but not served — response stays DATA_GAP.

        Returns:
            (phase8_data_gaps, feature_freshness_seconds, feature_source)
            - phase8_data_gaps: feature names that could not be live-computed
            - feature_freshness_seconds: feature_name → seconds since source data
              was captured; None means DATA_GAP (not 0 — 0 means "fresh/parquet")
            - feature_source: feature_name → source identifier string
        """
        phase8_gaps: List[str] = []
        freshness: Dict[str, Optional[int]] = {}
        sources: Dict[str, str] = {}

        if not self._use_phase8:
            return phase8_gaps, freshness, sources

        # ── Pi-ratings ────────────────────────────────────────────────────────
        _pi_keys = ("home_pi_attack", "home_pi_defense", "away_pi_attack",
                    "away_pi_defense", "pi_attack_diff", "pi_defense_diff")
        try:
            pi = self.pi_engine.get_context(home_team_id, away_team_id)
            features_dict["home_pi_attack"] = pi.home_pi_attack
            features_dict["home_pi_defense"] = pi.home_pi_defense
            features_dict["away_pi_attack"] = pi.away_pi_attack
            features_dict["away_pi_defense"] = pi.away_pi_defense
            features_dict["pi_attack_diff"] = pi.pi_attack_diff
            features_dict["pi_defense_diff"] = pi.pi_defense_diff
            for k in _pi_keys:
                freshness[k] = 0
                sources[k] = "pi_ratings"
        except Exception:
            logger.warning("Pi-rating context unavailable for %s vs %s", home_team_id, away_team_id)
            for k in _pi_keys:
                features_dict.setdefault(k, self.defaults.get(k, 0.0))
                phase8_gaps.append(k)
                freshness[k] = None  # DATA_GAP — not a freshness value
                sources[k] = "pi_ratings"

        # ── Berrar ratings ────────────────────────────────────────────────────
        _berrar_keys = ("home_berrar_rating", "away_berrar_rating", "berrar_rating_diff")
        try:
            berrar = self.berrar_engine.get_context(home_team_id, away_team_id)
            features_dict["home_berrar_rating"] = berrar.home_berrar_rating
            features_dict["away_berrar_rating"] = berrar.away_berrar_rating
            features_dict["berrar_rating_diff"] = berrar.berrar_rating_diff
            for k in _berrar_keys:
                freshness[k] = 0
                sources[k] = "berrar_ratings"
        except Exception:
            logger.warning("Berrar rating context unavailable for %s vs %s", home_team_id, away_team_id)
            for k in _berrar_keys:
                features_dict.setdefault(k, self.defaults.get(k, 0.0))
                phase8_gaps.append(k)
                freshness[k] = None
                sources[k] = "berrar_ratings"

        # ── EWMA form ─────────────────────────────────────────────────────────
        _ewma_keys = ("home_weighted_win_rate", "home_weighted_draw_rate", "home_weighted_ppg",
                      "away_weighted_win_rate", "away_weighted_draw_rate", "away_weighted_ppg")
        try:
            home_results = await self._get_team_results_sequence(home_team_id, db, match_date)
            away_results = await self._get_team_results_sequence(away_team_id, db, match_date)
            home_form = weighted_form_features(home_results)
            away_form = weighted_form_features(away_results)
            features_dict["home_weighted_win_rate"] = home_form["weighted_win_rate"]
            features_dict["home_weighted_draw_rate"] = home_form["weighted_draw_rate"]
            features_dict["home_weighted_ppg"] = home_form["weighted_ppg"]
            features_dict["away_weighted_win_rate"] = away_form["weighted_win_rate"]
            features_dict["away_weighted_draw_rate"] = away_form["weighted_draw_rate"]
            features_dict["away_weighted_ppg"] = away_form["weighted_ppg"]
            for k in _ewma_keys:
                freshness[k] = 0
                sources[k] = "match_history"
        except Exception:
            logger.warning("EWMA form unavailable for %s vs %s", home_team_id, away_team_id)
            for k in _ewma_keys:
                features_dict.setdefault(k, self.defaults.get(k, 0.0))
                phase8_gaps.append(k)
                freshness[k] = None
                sources[k] = "match_history"

        # ── Market drift (Phase 8 P1 live enrichment) ─────────────────────────
        try:
            current_odds = await self.odds_service.get_match_odds(home_team, away_team, league)
            drift_result = await compute_market_drift(
                current_odds=current_odds,
                match_id=match_id,
                db=db,
                max_staleness_hours=settings.odds_staleness_max_hours,
            )
        except Exception as exc:
            logger.warning("Market drift computation failed for %s: %s", match_id, exc)
            from ..features.market import MarketDriftResult
            drift_result = MarketDriftResult(
                features={k: 0.0 for k in MARKET_FEATURE_NAMES},
                data_gaps=list(MARKET_FEATURE_NAMES),
                per_feature_freshness_seconds={k: None for k in MARKET_FEATURE_NAMES},
            )

        if settings.phase8_enrichment_shadow:
            logger.info(
                "Phase8 SHADOW market_drift: match=%s features=%s gaps=%s",
                match_id,
                drift_result.features,
                drift_result.data_gaps,
            )
            for k in PHASE8_FEATURES_MARKET:
                features_dict[k] = self.defaults.get(k, 0.0)
                phase8_gaps.append(k)
                freshness[k] = None
                sources[k] = "odds_service"
        elif drift_result.data_gaps:
            for k in PHASE8_FEATURES_MARKET:
                features_dict[k] = self.defaults.get(k, 0.0)
            phase8_gaps.extend(drift_result.data_gaps)
            # drift_result freshness uses None for DATA_GAP; propagate as-is
            freshness.update(
                {k: v if k not in drift_result.data_gaps else None
                 for k, v in drift_result.per_feature_freshness_seconds.items()}
            )
            for k in PHASE8_FEATURES_MARKET:
                sources[k] = "odds_service"
        else:
            features_dict.update(drift_result.features)
            freshness.update(drift_result.per_feature_freshness_seconds)
            for k in PHASE8_FEATURES_MARKET:
                sources[k] = "odds_service"

        # ── Match importance (Phase 8 P1 live enrichment) ─────────────────────
        try:
            context_result = await compute_match_context(
                home_team_id=home_team_id,
                away_team_id=away_team_id,
                league=league,
                db=db,
                competition_stage=competition_stage,
            )
        except Exception as exc:
            logger.warning("Match context computation failed for %s: %s", match_id, exc)
            from ..features.match_context import MatchContextResult
            context_result = MatchContextResult(
                features={"match_importance_score": self.defaults.get("match_importance_score", 0.2)},
                data_gaps=list(CONTEXT_FEATURE_NAMES),
                per_feature_freshness_seconds={"match_importance_score": None},
            )

        if settings.phase8_enrichment_shadow:
            logger.info(
                "Phase8 SHADOW match_context: match=%s features=%s gaps=%s",
                match_id,
                context_result.features,
                context_result.data_gaps,
            )
            for k in PHASE8_FEATURES_CONTEXT:
                features_dict[k] = self.defaults.get(k, 0.2)
            phase8_gaps.extend(PHASE8_FEATURES_CONTEXT)
            for k in PHASE8_FEATURES_CONTEXT:
                freshness[k] = None
                sources[k] = "league_standings"
        elif context_result.data_gaps:
            for k in PHASE8_FEATURES_CONTEXT:
                features_dict[k] = self.defaults.get(k, 0.2)
            phase8_gaps.extend(context_result.data_gaps)
            freshness.update(
                {k: v if k not in context_result.data_gaps else None
                 for k, v in context_result.per_feature_freshness_seconds.items()}
            )
            for k in PHASE8_FEATURES_CONTEXT:
                sources[k] = "league_standings"
        else:
            features_dict.update(context_result.features)
            freshness.update(context_result.per_feature_freshness_seconds)
            for k in PHASE8_FEATURES_CONTEXT:
                sources[k] = "league_standings"

        return phase8_gaps, freshness, sources

    async def _get_team_results_sequence(
        self,
        team_id: str,
        db: AsyncSession,
        match_date: datetime,
        n: int = 10,
    ) -> list:
        """Return last N results as 1=win, 0=draw, -1=loss (oldest→newest)."""
        start_date = match_date - timedelta(days=120)
        query = (
            select(Match)
            .where(
                and_(
                    (Match.home_team_id == team_id) | (Match.away_team_id == team_id),
                    Match.match_date >= start_date,
                    Match.match_date < match_date,
                    Match.status == "finished",
                )
            )
            .order_by(desc(Match.match_date))
            .limit(n)
        )
        result = await db.execute(query)
        matches = result.scalars().all()
        results: list = []
        for match in reversed(matches):
            is_home = match.home_team_id == team_id
            gf = (match.home_score if is_home else match.away_score) or 0
            ga = (match.away_score if is_home else match.home_score) or 0
            results.append(1 if gf > ga else 0 if gf == ga else -1)
        return results

    async def _get_match(self, match_id: str, db: AsyncSession) -> Optional[Match]:
        query = select(Match).where(Match.id == match_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def _get_team_name(self, team_id: str, db: AsyncSession) -> Optional[str]:
        query = select(Team.name).where(Team.id == team_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    def _derive_season(self, match_date: datetime) -> str:
        year = match_date.year
        if match_date.month >= 7:
            return f"{year}/{year + 1}"
        return f"{year - 1}/{year}"

    async def _get_team_id_by_name(
        self, team_name: str, db: AsyncSession
    ) -> Optional[str]:
        """Get team ID by team name (case-insensitive)."""
        query = select(Team.id).where(
            func.lower(Team.name) == func.lower(team_name)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def _get_team_stats(
        self,
        team_id: str,
        db: AsyncSession,
        match_date: datetime,
        lookback_days: int = 60,
    ) -> Optional[Dict[str, float]]:
        """Fetch recent team statistics for feature engineering."""
        start_date = match_date - timedelta(days=lookback_days)

        query = (
            select(Match)
            .where(
                and_(
                    (Match.home_team_id == team_id) | (Match.away_team_id == team_id),
                    Match.match_date >= start_date,
                    Match.match_date < match_date,
                    Match.status == "finished",
                )
            )
            .order_by(desc(Match.match_date))
            .limit(20)
        )

        result = await db.execute(query)
        recent_matches = result.scalars().all()

        if not recent_matches:
            logger.debug("No historical matches found for team %s before %s", team_id, match_date)
            return None

        stats = {}
        points = []
        goals_for = []
        goals_against = []

        for match in recent_matches:
            is_home = match.home_team_id == team_id
            gf = (match.home_score if is_home else match.away_score) or 0
            ga = (match.away_score if is_home else match.home_score) or 0
            goals_for.append(gf)
            goals_against.append(ga)
            if gf > ga:
                points.append(3)
            elif gf == ga:
                points.append(1)
            else:
                points.append(0)

        recent_points = points[:5]
        recent_goals_for = goals_for[:5]
        recent_goals_against = goals_against[:5]
        sample_size = len(recent_points)
        if sample_size:
            stats["ppg_5"] = sum(recent_points) / sample_size
            stats["wins_5"] = float(sum(1 for p in recent_points if p == 3))
            stats["draws_5"] = float(sum(1 for p in recent_points if p == 1))
            stats["losses_5"] = float(sum(1 for p in recent_points if p == 0))
            stats["goals_for_avg_5"] = float(np.mean(recent_goals_for))
            stats["goals_against_avg_5"] = float(np.mean(recent_goals_against))
            stats["gd_avg_5"] = stats["goals_for_avg_5"] - stats["goals_against_avg_5"]

        if len(points) >= 5:
            stats["home_form_5"] = sum(points[:5]) / 15.0
            stats["home_win_rate_5"] = sum(1 for p in points[:5] if p == 3) / 5.0
        else:
            stats["home_form_5"] = sum(points) / (len(points) * 3.0) if points else 0.5
            stats["home_win_rate_5"] = (
                sum(1 for p in points if p == 3) / len(points) if points else 0.4
            )

        if len(points) >= 10:
            stats["home_form_10"] = sum(points[:10]) / 30.0
        else:
            stats["home_form_10"] = stats.get("home_form_5", 0.5)

        stats["home_goals_per_match_5"] = (
            np.mean(goals_for[:5]) if len(goals_for) >= 5 else np.mean(goals_for) if goals_for else 1.5
        )
        stats["home_goals_conceded_per_match_5"] = (
            np.mean(goals_against[:5]) if len(goals_against) >= 5 else np.mean(goals_against) if goals_against else 1.2
        )

        if recent_matches:
            last_match_date = recent_matches[0].match_date
            rest_days = (match_date - last_match_date).days
            stats["home_days_rest"] = min(rest_days, 10.0)
            stats["home_fatigue_index"] = max(0.0, 1.0 - (rest_days / 7.0))
        else:
            stats["home_days_rest"] = 7.0
            stats["home_fatigue_index"] = 0.3

        clean_sheets = sum(1 for ga in goals_against[:5] if ga == 0)
        stats["home_clean_sheets_5"] = (
            clean_sheets / min(5, len(goals_against)) if goals_against else 0.3
        )

        gd = [f - a for f, a in zip(goals_for[:5], goals_against[:5])]
        stats["home_gd_avg_5"] = np.mean(gd) if gd else 0.0
        if len(gd) >= 2:
            try:
                trend = np.polyfit(range(len(gd)), gd, 1)[0]
                stats["home_gd_trend"] = float(trend)
            except Exception:
                stats["home_gd_trend"] = 0.0

        xg_values = await self._get_team_xg(team_id, db, recent_matches)
        if xg_values:
            stats["home_xg_avg_5"] = np.mean(xg_values[:5])
            stats["home_xg_consistency"] = np.std(xg_values[:5]) if len(xg_values) >= 5 else 0.75

        return stats if stats else None

    async def _get_team_xg(
        self,
        team_id: str,
        db: AsyncSession,
        matches: list,
    ) -> Optional[list]:
        """Get xG values for team across matches."""
        match_ids = [m.id for m in matches]
        if not match_ids:
            return None

        query = select(MatchStats.expected_goals).where(
            and_(
                MatchStats.match_id.in_(match_ids),
                MatchStats.team_id == team_id,
                MatchStats.expected_goals.isnot(None),
            )
        )

        result = await db.execute(query)
        xg_values = result.scalars().all()
        return list(xg_values) if xg_values else None
