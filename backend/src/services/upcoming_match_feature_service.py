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
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.database import Match, MatchStats, Team
from ..core.exceptions import SchemaMismatchError
from ..core.league_policy import canonical_league_id
from ..data.elo_engine import EloEngine
from ..data.enrichment.statsbomb_aggregator import StatsBombAggregator
from ..features.berrar_ratings import BerrarRatingSystem
from ..features.form import weighted_form_features
from ..features.market import MARKET_FEATURE_NAMES, compute_market_drift
from ..features.match_context import CONTEXT_FEATURE_NAMES, compute_match_context
from ..features.pi_ratings import PiRatingSystem
from ..models.feature_registry import (
    CANONICAL_FEATURES_58,
    PHASE7_FEATURES_7,
    PHASE7_FEATURES_ALWAYS_DATA_GAP,
    PHASE8_FEATURES_BERRAR,
    PHASE8_FEATURES_CONTEXT,
    PHASE8_FEATURES_FORM,
    PHASE8_FEATURES_MARKET,
    PHASE8_FEATURES_PI,
    active_canonical_features,
    active_default_feature_values,
)
from ..utils.season import canonical_season
from .odds_service import OddsService
from .scraped_feature_store import ScrapedTeamFormStore
from .team_identity import resolve_team_id

logger = logging.getLogger(__name__)

# Canonical features resolved entirely by the CALLER (build_live_feature_vector /
# build_live_feature_vector_from_matchup), not by project_match_features() itself:
# elo/statsbomb (PHASE7_FEATURES_7 minus the always-gap shot_quality_diff — elo_engine
# has no failure path and statsbomb gaps are tracked separately via
# sb_home/sb_away.data_gaps) and every Phase 8 family (_inject_phase8_features tracks
# its own gaps additively in phase8_gaps). Flagging these here, before the caller has
# run, would either be a stale false-positive (elo — always successfully computed one
# step later) or duplicate phase8's own tracking with the wrong default assumption.
_CALLER_RESOLVED_FEATURES = (
    frozenset(f for f in PHASE7_FEATURES_7 if f not in PHASE7_FEATURES_ALWAYS_DATA_GAP)
    | frozenset(PHASE8_FEATURES_PI)
    | frozenset(PHASE8_FEATURES_BERRAR)
    | frozenset(PHASE8_FEATURES_FORM)
    | frozenset(PHASE8_FEATURES_MARKET)
    | frozenset(PHASE8_FEATURES_CONTEXT)
)


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

        # ponytail: Match.match_date is naive TIMESTAMP WITHOUT TIME ZONE — strip tz so asyncpg accepts range bounds
        match_date = match_date.replace(tzinfo=None)

        home_team_id_resolved = await self._get_team_id_by_name(match_dict["home_team"], db)
        away_team_id_resolved = await self._get_team_id_by_name(match_dict["away_team"], db)
        home_resolved = home_team_id_resolved is not None
        away_resolved = away_team_id_resolved is not None

        if not home_resolved or not away_resolved:
            logger.warning(
                "Could not find teams: %s vs %s",
                match_dict["home_team"],
                match_dict["away_team"],
            )
        home_team_id = home_team_id_resolved or match_dict["home_team"]
        away_team_id = away_team_id_resolved or match_dict["away_team"]

        home_stats = await self._get_team_stats(home_team_id, db, match_date)
        away_stats = await self._get_team_stats(away_team_id, db, match_date)

        # is_synthetic (below) gates public prediction publishing (WP-0/vΩ.32:
        # upcoming_match_service.py `publishable = not is_fallback and not
        # is_synthetic`) — it must reflect whether DB-native history existed, not
        # whether a scraped fallback was found. Captured before the fallback
        # reassigns home_stats/away_stats.
        home_db_missing = home_stats is None
        away_db_missing = away_stats is None
        league_hint = match_dict.get("league")
        home_stats, home_scraped_provenance = self._apply_scraped_fallback(
            home_stats, competition=league_hint, team=match_dict["home_team"], match_date=match_date
        )
        away_stats, away_scraped_provenance = self._apply_scraped_fallback(
            away_stats, competition=league_hint, team=match_dict["away_team"], match_date=match_date
        )

        features_dict = dict(self.defaults)
        defaults_count = len(self.defaults)

        if home_stats:
            features_dict.update(home_stats)
            defaults_count -= sum(1 for k in home_stats if k in self.defaults)

        if away_stats:
            features_dict.update(away_stats)
            defaults_count -= sum(1 for k in away_stats if k in self.defaults)

        features_array = np.array(
            [features_dict.get(f, self.defaults.get(f, 0.0)) for f in self.canonical_features],
            dtype=np.float32,
        )

        # A canonical feature is a gap here unless it's resolved by the caller
        # (_CALLER_RESOLVED_FEATURES — elo/statsbomb/phase8, tracked authoritatively
        # one layer up) — never inferred from the numeric value. `home_stats`/
        # `away_stats` never actually intersect a canonical feature name (confirmed:
        # e.g. "home_form_5" vs the canonical "home_form_last5_home"), so every
        # remaining base feature is unconditionally left at its registry default
        # today; a value-equality check (old: `in (None, 0.0)`) was both a false
        # positive (a genuinely-computed 0.0 flagged as missing) and a false
        # negative (a non-zero default like home_berrar_rating=1500.0 silently
        # never flagged) for exactly the features that heuristic was meant to catch.
        data_gaps = [
            feature for feature in self.canonical_features
            if feature not in _CALLER_RESOLVED_FEATURES
        ]

        for always_gap in PHASE7_FEATURES_ALWAYS_DATA_GAP:
            features_dict[always_gap] = self.defaults.get(always_gap, 0.0)
            if always_gap not in data_gaps:
                data_gaps.append(always_gap)

        # Unreachable in practice: features_array is built one scalar per entry of
        # self.canonical_features (line ~153), so the lengths can never diverge
        # today. Kept as a fail-closed guard rather than silent zero-padding
        # (INV-10) in case a future edit breaks that invariant.
        if len(features_array) != len(self.canonical_features):
            raise SchemaMismatchError(
                actual_dim=len(features_array),
                expected_dim=len(self.canonical_features),
                provider="upcoming_match_feature_service",
            )

        data_quality = {
            "historical_data_ratio": max(0.0, 1.0 - (defaults_count / len(self.defaults)))
            if self.defaults
            else 0.0,
            "defaults_used_count": max(0, defaults_count),
            "is_synthetic": home_db_missing or away_db_missing,
            # Provenance-tagged only (INV-10) — closes D12 (ScrapedTeamFormStore had
            # zero callers) without claiming these values as DB-native. Behaviourally
            # inert on the canonical feature vector today: the scraped keys share
            # _get_team_stats()'s non-canonical shape (D8), so neither reaches
            # features_array until the WP-10.3 remap (gated, not done here).
            "scraped_fallback": {
                k: v
                for k, v in {"home": home_scraped_provenance, "away": away_scraped_provenance}.items()
                if v is not None
            },
        }

        return {
            "match_id": match_dict["id"],
            "home_team": match_dict["home_team"],
            "away_team": match_dict["away_team"],
            "home_team_id": home_team_id,
            "away_team_id": away_team_id,
            "identity_resolution": {
                "home_team_resolved": home_resolved,
                "away_team_resolved": away_resolved,
            },
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

        identity_resolution = projected.get("identity_resolution") or {}
        fixture_identity_verified = bool(identity_resolution.get("home_team_resolved")) and bool(
            identity_resolution.get("away_team_resolved")
        )

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
            "data_quality": dict(projected.get("data_quality") or {}),
            "identity_resolution": identity_resolution,
            "fixture_identity_verified": fixture_identity_verified,
            "is_reduced_evidence_baseline": bool(
                (projected.get("data_quality") or {}).get("is_synthetic", False)
            ),
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
            # ponytail: naive, not datetime.now(timezone.utc) — EloEngine/StatsBombAggregator
            # compare against persisted naive timestamps; a tz-aware value here raises inside
            # elo_engine.get_context(), which the caller's broad except then silently reports
            # as "identity unverified" instead of the real cause.
            match_date = datetime.now(timezone.utc).replace(tzinfo=None)

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

        identity_resolution = projected.get("identity_resolution") or {}
        fixture_identity_verified = bool(identity_resolution.get("home_team_resolved")) and bool(
            identity_resolution.get("away_team_resolved")
        )

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
            "data_quality": dict(projected.get("data_quality") or {}),
            "identity_resolution": identity_resolution,
            "fixture_identity_verified": fixture_identity_verified,
            "is_reduced_evidence_baseline": bool(
                (projected.get("data_quality") or {}).get("is_synthetic", False)
            ),
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
        _home_ewma_keys = _ewma_keys[:3]
        _away_ewma_keys = _ewma_keys[3:]
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
            # weighted_form_features([]) returns neutral priors without raising — an
            # empty results sequence (no completed match history found for that side)
            # is a genuine gap, not freshly-computed data, even though no exception
            # is thrown. Checked per side since one team can have history while the
            # other (e.g. a newly-promoted club) does not.
            for k in _home_ewma_keys:
                if home_results:
                    freshness[k] = 0
                    sources[k] = "match_history"
                else:
                    phase8_gaps.append(k)
                    freshness[k] = None
                    sources[k] = "match_history"
            for k in _away_ewma_keys:
                if away_results:
                    freshness[k] = 0
                    sources[k] = "match_history"
                else:
                    phase8_gaps.append(k)
                    freshness[k] = None
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
        """Return last N results as 1=win, 0=draw, -1=loss (oldest→newest).

        No wall-clock lower bound — see _get_team_stats docstring; the same
        fixed-day-window bug silently starved EWMA form of history in the
        close season.
        """
        query = (
            select(Match)
            .where(
                and_(
                    (Match.home_team_id == team_id) | (Match.away_team_id == team_id),
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
        return canonical_season(match_date)

    async def _get_team_id_by_name(
        self, team_name: str, db: AsyncSession
    ) -> Optional[str]:
        """Get team ID by team name (exact, affix-stripped, then fuzzy — see team_identity)."""
        return await resolve_team_id(team_name, db)

    async def _get_team_stats(
        self,
        team_id: str,
        db: AsyncSession,
        match_date: datetime,
    ) -> Optional[Dict[str, float]]:
        """Fetch recent team statistics for feature engineering.

        No wall-clock lower bound — a fixed N-day window silently starves every
        team of history whenever the gap since the last completed match exceeds
        it (e.g. the close season). ``.limit(20)`` alone bounds the query; a team
        with a real but old last match still resolves instead of going synthetic.
        """
        query = (
            select(Match)
            .where(
                and_(
                    (Match.home_team_id == team_id) | (Match.away_team_id == team_id),
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

    def _apply_scraped_fallback(
        self,
        stats: Optional[Dict[str, float]],
        *,
        competition: Optional[str],
        team: str,
        match_date: datetime,
    ) -> Tuple[Optional[Dict[str, float]], Optional[Dict[str, Any]]]:
        """WP-10.1 — consult the scraped football-data.co.uk CSV artifact only when
        the DB has zero completed-match history for this team (``stats is None``).
        Supplementary, never a silent DB substitute (INV-10): callers get the
        provenance dict back separately and must not fold it into ``is_synthetic``.
        Never raises — a missing/corrupt artifact degrades to "no fallback", the
        same as if ``ScrapedTeamFormStore`` had never been called.
        """
        if stats is not None or not competition:
            return stats, None
        try:
            league_code = canonical_league_id(competition)
            record = self.scraped_form_store.get_team_form(
                competition=league_code, team=team, information_cutoff=match_date
            )
        except Exception:
            logger.debug("Scraped fallback lookup failed for %s (%s)", team, competition, exc_info=True)
            return stats, None
        if record is None:
            return stats, None
        return record.to_projection_stats(), {
            "source": f"scraped:football-data-csv:{record.source_file.name}",
            "matches_sampled": record.matches_sampled,
            "acquired_at": record.latest_match_date.isoformat() if record.latest_match_date else None,
        }

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
