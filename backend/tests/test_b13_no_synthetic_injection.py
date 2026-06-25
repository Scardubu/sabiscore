"""
B13 no-synthetic-injection invariant tests (Phase 8 Sprint 1 gate, PR-6).

B13 states: missing features must surface as DATA_GAP, not be silently filled
with synthetic values and presented as confident predictions.

These tests validate that:
  1. data_gaps list is non-empty when features are absent (not swallowed silently).
  2. partial_intelligence=True propagates through the synthesis pipeline.
  3. Verdict is PARTIAL (not HOLD/SPECULATIVE/ACTIONABLE) when data gaps exist.
  4. Feature registry PHASE7_FEATURES_REMOVED members are not present in the
     canonical Phase 7 or Phase 8 feature sets used for training.
  5. No removed/pending feature appears in DEFAULT_FEATURE_VALUES used for inference
     without an explicit DATA_GAP being recorded.
"""

from __future__ import annotations

import pytest

from src.services.intelligence_synthesizer import (
    EnsemblePrediction,
    FullMatchAnalysisResponse,
    IntelligenceSynthesizer,
)
from src.data.elo_engine import EloContext
from src.models.causal_selector import CausalFeatureResult
from src.services.rl_betting_agent import RLRecommendationPayload
from src.services.uncertainty_service import UncertaintyBreakdown
from src.models.feature_registry import (
    CANONICAL_FEATURES_58,
    CANONICAL_FEATURES_65,
    CANONICAL_FEATURES_68,
    CANONICAL_FEATURES_83,
    CANONICAL_FEATURES_86,
    DEFAULT_FEATURE_VALUES_58,
    DEFAULT_FEATURE_VALUES_68,
    DEFAULT_FEATURE_VALUES_86,
    PHASE7_FEATURES_7,
    PHASE7_FEATURES_REMOVED,
    PHASE8_FEATURES_MARKET,
    PHASE8_FEATURES_CONTEXT,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ok_uncertainty() -> UncertaintyBreakdown:
    return UncertaintyBreakdown(
        epistemic_unc=0.05,
        aleatoric_unc=0.10,
        concentration=0.70,
        credible_interval=(0.45, 0.65),
        confidence_tier="OK",
    )


def _rl_bets() -> RLRecommendationPayload:
    return RLRecommendationPayload(
        stake_fraction=0.05,
        abstain=False,
        reward_components={},
        reason="test",
    )


def _ens() -> EnsemblePrediction:
    return EnsemblePrediction(
        home_win_prob=0.55,
        draw_prob=0.25,
        away_win_prob=0.20,
        prediction="home_win",
        confidence=0.55,
        league="epl",
        model_version="v5_phase7",
    )


def _elo() -> EloContext:
    return EloContext(
        home_elo=1550.0,
        away_elo=1500.0,
        elo_difference=50.0,
        home_elo_trend_5=0.0,
        away_elo_trend_5=0.0,
        elo_momentum_cross=0.0,
    )


SYNTH = IntelligenceSynthesizer()


# ---------------------------------------------------------------------------
# B13: data_gap presence triggers PARTIAL
# ---------------------------------------------------------------------------


class TestB13DataGapSurfacing:
    def test_single_data_gap_causes_partial_verdict(self):
        result = SYNTH.synthesize(
            match_id="b13::001",
            ensemble=_ens(),
            uncertainty=_ok_uncertainty(),
            causal_results=[],
            rl_rec=_rl_bets(),
            elo_ctx=_elo(),
            data_gaps=["ensemble_prediction"],
        )
        assert result.verdict == "PARTIAL", (
            f"Expected PARTIAL for data_gaps=['ensemble_prediction'], got {result.verdict!r}"
        )
        assert result.partial_intelligence is True

    def test_multiple_data_gaps_cause_partial(self):
        gaps = ["elo_ratings", "causal_analysis", "ensemble_prediction"]
        result = SYNTH.synthesize(
            match_id="b13::002",
            ensemble=_ens(),
            uncertainty=_ok_uncertainty(),
            causal_results=[],
            rl_rec=_rl_bets(),
            elo_ctx=_elo(),
            data_gaps=gaps,
        )
        assert result.verdict == "PARTIAL"
        assert result.partial_intelligence is True
        assert sorted(result.data_gaps) == sorted(gaps)

    def test_no_data_gaps_does_not_trigger_partial(self):
        result = SYNTH.synthesize(
            match_id="b13::003",
            ensemble=_ens(),
            uncertainty=_ok_uncertainty(),
            causal_results=[
                CausalFeatureResult(
                    name="elo_difference",
                    ate_win=0.30,
                    ate_draw=0.10,
                    ate_ci=(0.20, 0.40),
                    p_value=0.01,
                    classification="CAUSAL_DRIVER",
                )
            ],
            rl_rec=_rl_bets(),
            elo_ctx=_elo(),
            data_gaps=[],
        )
        assert result.verdict != "PARTIAL"
        assert result.partial_intelligence is False

    def test_data_gaps_list_preserved_exactly(self):
        gaps = ["market_data", "statsbomb_cache"]
        result = SYNTH.synthesize(
            match_id="b13::004",
            ensemble=_ens(),
            uncertainty=_ok_uncertainty(),
            causal_results=[],
            rl_rec=_rl_bets(),
            elo_ctx=_elo(),
            data_gaps=gaps,
        )
        assert result.data_gaps == gaps


# ---------------------------------------------------------------------------
# Feature registry invariants — removed features must not appear in canonical sets
# ---------------------------------------------------------------------------


class TestFeatureRegistryNoRemovedFeatures:
    """Removed features must not contaminate any canonical feature list."""

    @pytest.mark.parametrize("removed", PHASE7_FEATURES_REMOVED)
    def test_removed_not_in_canonical_58(self, removed: str):
        assert removed not in CANONICAL_FEATURES_58, (
            f"Removed feature '{removed}' found in CANONICAL_FEATURES_58"
        )

    @pytest.mark.parametrize("removed", PHASE7_FEATURES_REMOVED)
    def test_removed_not_in_canonical_65(self, removed: str):
        assert removed not in CANONICAL_FEATURES_65, (
            f"Removed feature '{removed}' found in CANONICAL_FEATURES_65"
        )

    @pytest.mark.parametrize("removed", PHASE7_FEATURES_REMOVED)
    def test_removed_not_in_canonical_68_alias(self, removed: str):
        """CANONICAL_FEATURES_68 is now the 65-feature alias — must also be clean."""
        assert removed not in CANONICAL_FEATURES_68, (
            f"Removed feature '{removed}' found in CANONICAL_FEATURES_68 alias"
        )

    @pytest.mark.parametrize("removed", PHASE7_FEATURES_REMOVED)
    def test_removed_not_in_phase8_set(self, removed: str):
        assert removed not in CANONICAL_FEATURES_83, (
            f"Removed feature '{removed}' found in CANONICAL_FEATURES_83"
        )

    @pytest.mark.parametrize("removed", PHASE7_FEATURES_REMOVED)
    def test_removed_not_in_default_values_68(self, removed: str):
        assert removed not in DEFAULT_FEATURE_VALUES_68, (
            f"Removed feature '{removed}' found in DEFAULT_FEATURE_VALUES_68 — "
            "this would silently inject a synthetic value during inference"
        )

    @pytest.mark.parametrize("removed", PHASE7_FEATURES_REMOVED)
    def test_removed_not_in_default_values_86_alias(self, removed: str):
        assert removed not in DEFAULT_FEATURE_VALUES_86, (
            f"Removed feature '{removed}' found in DEFAULT_FEATURE_VALUES_86"
        )


# ---------------------------------------------------------------------------
# Feature count consistency
# ---------------------------------------------------------------------------


class TestFeatureCounts:
    def test_phase7_confirmed_features_count(self):
        """Phase 7 canonical set must be exactly 65 (58 base + 7 confirmed)."""
        assert len(CANONICAL_FEATURES_65) == 65, (
            f"Expected 65 Phase 7 features, got {len(CANONICAL_FEATURES_65)}"
        )

    def test_canonical_68_alias_equals_65(self):
        """CANONICAL_FEATURES_68 alias must resolve to the same 65-feature list."""
        assert len(CANONICAL_FEATURES_68) == 65

    def test_phase7_features_7_count(self):
        assert len(PHASE7_FEATURES_7) == 7

    def test_phase7_removed_count(self):
        """Exactly 3 features were removed in the pending-feature resolution."""
        assert len(PHASE7_FEATURES_REMOVED) == 3

    def test_phase8_total_count(self):
        """Phase 8 canonical set must be 86 (65 confirmed + 21 phase8)."""
        assert len(CANONICAL_FEATURES_83) == 86, (
            f"Expected 86 Phase 8 features, got {len(CANONICAL_FEATURES_83)}"
        )

    def test_canonical_86_alias_equals_83(self):
        assert len(CANONICAL_FEATURES_86) == 86

    def test_no_duplicate_features_in_phase8(self):
        dupes = [
            f for f in CANONICAL_FEATURES_83
            if CANONICAL_FEATURES_83.count(f) > 1
        ]
        assert not dupes, f"Duplicate features in CANONICAL_FEATURES_83: {sorted(set(dupes))}"


# ---------------------------------------------------------------------------
# Phase 8 market drift — no silent zero-fill; feature_freshness_seconds=None
# ---------------------------------------------------------------------------


class TestPhase8MarketDriftNoSyntheticInjection:
    """B13 extension: Phase 8 market drift features must not be zero-filled.

    When market drift inputs are unavailable, they must appear in data_gaps and
    the corresponding feature_freshness_seconds entry must be None (DATA_GAP
    sentinel), not 0 or any positive integer.
    """

    def _synth_with_freshness(self, data_gaps: list, freshness: dict) -> FullMatchAnalysisResponse:
        """Minimal synthesize() call carrying feature_freshness_seconds metadata."""
        return SYNTH.synthesize(
            match_id="b13_market::001",
            ensemble=EnsemblePrediction(
                home_win_prob=0.55,
                draw_prob=0.25,
                away_win_prob=0.20,
                prediction="home_win",
                confidence=0.55,
                league="epl",
                model_version="v5_phase7",
            ),
            uncertainty=UncertaintyBreakdown(
                epistemic_unc=0.05,
                aleatoric_unc=0.10,
                concentration=0.70,
                credible_interval=(0.45, 0.65),
                confidence_tier="OK",
            ),
            causal_results=[],
            rl_rec=RLRecommendationPayload(
                stake_fraction=0.0,
                abstain=False,
                reward_components={},
                reason="test",
            ),
            elo_ctx=EloContext(
                home_elo=1550.0,
                away_elo=1500.0,
                elo_difference=50.0,
                home_elo_trend_5=0.0,
                away_elo_trend_5=0.0,
                elo_momentum_cross=0.0,
            ),
            data_gaps=data_gaps,
            feature_freshness_seconds=freshness,
        )

    @pytest.mark.parametrize("market_feature", PHASE8_FEATURES_MARKET)
    def test_market_drift_gap_in_data_gaps(self, market_feature: str):
        """Missing market drift feature must appear in data_gaps (not swallowed)."""
        result = self._synth_with_freshness(
            data_gaps=[market_feature],
            freshness={market_feature: None},
        )
        assert market_feature in result.data_gaps, (
            f"Market drift feature '{market_feature}' missing from data_gaps — "
            "silent injection suspected"
        )

    @pytest.mark.parametrize("market_feature", PHASE8_FEATURES_MARKET)
    def test_market_drift_gap_sets_verdict_partial(self, market_feature: str):
        """Missing market drift feature must produce PARTIAL verdict (B13)."""
        result = self._synth_with_freshness(
            data_gaps=[market_feature],
            freshness={market_feature: None},
        )
        assert result.verdict == "PARTIAL", (
            f"Expected PARTIAL when '{market_feature}' is DATA_GAP, got {result.verdict!r}"
        )

    @pytest.mark.parametrize("market_feature", PHASE8_FEATURES_MARKET)
    def test_market_drift_gap_freshness_is_none_not_zero(self, market_feature: str):
        """feature_freshness_seconds must be None for DATA_GAP features, not 0."""
        freshness = {market_feature: None}
        result = self._synth_with_freshness(
            data_gaps=[market_feature],
            freshness=freshness,
        )
        assert market_feature in result.feature_freshness_seconds, (
            f"feature_freshness_seconds missing key '{market_feature}'"
        )
        value = result.feature_freshness_seconds[market_feature]
        assert value is None, (
            f"feature_freshness_seconds['{market_feature}'] = {value!r}, expected None. "
            "Zero-filling DATA_GAP freshness hides missing live data."
        )

    def test_all_market_drift_gaps_in_single_response(self):
        """All 5 market drift features absent → all appear in data_gaps."""
        result = self._synth_with_freshness(
            data_gaps=list(PHASE8_FEATURES_MARKET),
            freshness={f: None for f in PHASE8_FEATURES_MARKET},
        )
        for feature in PHASE8_FEATURES_MARKET:
            assert feature in result.data_gaps, f"'{feature}' not in data_gaps"
        assert result.verdict == "PARTIAL"

    def test_partial_intelligence_true_when_market_drift_gap(self):
        result = self._synth_with_freshness(
            data_gaps=["odds_drift_home"],
            freshness={"odds_drift_home": None},
        )
        assert result.partial_intelligence is True

    def test_fresh_market_feature_does_not_set_none_freshness(self):
        """A live market drift feature must have a non-None freshness value."""
        freshness = {"odds_drift_home": 120}  # 120 seconds — live
        result = self._synth_with_freshness(
            data_gaps=[],
            freshness=freshness,
        )
        assert result.feature_freshness_seconds.get("odds_drift_home") is not None
        assert result.feature_freshness_seconds["odds_drift_home"] == 120
        assert result.verdict != "PARTIAL"


# ---------------------------------------------------------------------------
# Phase 8 match context — no silent injection for match_importance_score
# ---------------------------------------------------------------------------


class TestPhase8MatchContextNoSyntheticInjection:
    """B13 extension: match_importance_score default (0.2) must not be served
    without an explicit DATA_GAP when the live competition context is unavailable.
    """

    @pytest.mark.parametrize("context_feature", PHASE8_FEATURES_CONTEXT)
    def test_missing_context_feature_in_data_gaps(self, context_feature: str):
        result = SYNTH.synthesize(
            match_id="b13_context::001",
            ensemble=EnsemblePrediction(
                home_win_prob=0.50,
                draw_prob=0.25,
                away_win_prob=0.25,
                prediction="home_win",
                confidence=0.50,
                league="epl",
                model_version="v5_phase7",
            ),
            uncertainty=UncertaintyBreakdown(
                epistemic_unc=0.05,
                aleatoric_unc=0.10,
                concentration=0.70,
                credible_interval=(0.45, 0.65),
                confidence_tier="OK",
            ),
            causal_results=[],
            rl_rec=RLRecommendationPayload(
                stake_fraction=0.0,
                abstain=False,
                reward_components={},
                reason="test",
            ),
            elo_ctx=EloContext(
                home_elo=1550.0,
                away_elo=1500.0,
                elo_difference=50.0,
                home_elo_trend_5=0.0,
                away_elo_trend_5=0.0,
                elo_momentum_cross=0.0,
            ),
            data_gaps=[context_feature],
            feature_freshness_seconds={context_feature: None},
        )
        assert context_feature in result.data_gaps
        assert result.verdict == "PARTIAL"
        assert result.feature_freshness_seconds.get(context_feature) is None

    def test_default_importance_score_not_present_without_data_gap(self):
        """DEFAULT_FEATURE_VALUES_86 sets match_importance_score=0.2.

        This default MUST NOT be served as a live feature at inference time
        unless the live source is confirmed available. When live data is absent,
        the feature must be in data_gaps and feature_freshness_seconds[feature] = None.
        """
        # Verify the default exists in the registry (expected)
        assert "match_importance_score" in DEFAULT_FEATURE_VALUES_86, (
            "match_importance_score must be registered in DEFAULT_FEATURE_VALUES_86 "
            "so inference can fill the gap — but serving it without DATA_GAP is forbidden."
        )
        # The contract: if we do NOT put it in data_gaps, it is treated as live.
        # When it IS in data_gaps, freshness must be None.
        result = SYNTH.synthesize(
            match_id="b13_context::002",
            ensemble=EnsemblePrediction(
                home_win_prob=0.55,
                draw_prob=0.25,
                away_win_prob=0.20,
                prediction="home_win",
                confidence=0.55,
                league="epl",
                model_version="v5_phase7",
            ),
            uncertainty=UncertaintyBreakdown(
                epistemic_unc=0.05,
                aleatoric_unc=0.10,
                concentration=0.70,
                credible_interval=(0.45, 0.65),
                confidence_tier="OK",
            ),
            causal_results=[],
            rl_rec=RLRecommendationPayload(
                stake_fraction=0.0,
                abstain=False,
                reward_components={},
                reason="test",
            ),
            elo_ctx=EloContext(
                home_elo=1550.0,
                away_elo=1500.0,
                elo_difference=50.0,
                home_elo_trend_5=0.0,
                away_elo_trend_5=0.0,
                elo_momentum_cross=0.0,
            ),
            data_gaps=["match_importance_score"],
            feature_freshness_seconds={"match_importance_score": None},
        )
        assert result.feature_freshness_seconds.get("match_importance_score") is None
        assert result.verdict == "PARTIAL"


# ---------------------------------------------------------------------------
# compute_market_drift unit tests — DATA_GAP returns None freshness at source
# ---------------------------------------------------------------------------


class TestComputeMarketDriftDataGap:
    """Unit tests for compute_market_drift() confirming that the function itself
    returns None freshness (not 0) when it falls back to the DATA_GAP path.

    These tests mock the AsyncSession so no real DB is required.
    """

    @pytest.mark.asyncio
    async def test_no_odds_history_returns_all_data_gap(self):
        """When OddsHistory returns no rows, all 5 features must be DATA_GAP."""
        from unittest.mock import AsyncMock, MagicMock, patch

        from src.features.market import MARKET_FEATURE_NAMES, compute_market_drift

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        current_odds = {"home_win": 2.1, "draw": 3.4, "away_win": 3.8}
        result = await compute_market_drift(
            current_odds=current_odds,
            match_id="test_match_id_001",
            db=mock_db,
            max_staleness_hours=24,
        )

        assert set(result.data_gaps) == set(MARKET_FEATURE_NAMES), (
            "All 5 market features must be DATA_GAP when no OddsHistory rows exist"
        )
        for feat in MARKET_FEATURE_NAMES:
            assert result.per_feature_freshness_seconds[feat] is None, (
                f"per_feature_freshness_seconds['{feat}'] must be None for DATA_GAP, "
                f"got {result.per_feature_freshness_seconds[feat]!r}"
            )

    @pytest.mark.asyncio
    async def test_invalid_current_odds_returns_data_gap(self):
        """Odds ≤ 1.01 are invalid — must return DATA_GAP with None freshness."""
        from unittest.mock import AsyncMock

        from src.features.market import MARKET_FEATURE_NAMES, compute_market_drift

        mock_db = AsyncMock()
        result = await compute_market_drift(
            current_odds={"home_win": 0.0, "draw": 0.0, "away_win": 0.0},
            match_id="test_match_id_002",
            db=mock_db,
            max_staleness_hours=24,
        )

        assert set(result.data_gaps) == set(MARKET_FEATURE_NAMES)
        for feat in MARKET_FEATURE_NAMES:
            assert result.per_feature_freshness_seconds[feat] is None

    @pytest.mark.asyncio
    async def test_stale_opening_snapshot_returns_data_gap(self):
        """Opening snapshot older than max_staleness_hours → DATA_GAP with None freshness."""
        from datetime import datetime, timedelta, timezone
        from unittest.mock import AsyncMock, MagicMock

        from src.features.market import MARKET_FEATURE_NAMES, compute_market_drift

        stale_record = MagicMock()
        stale_record.timestamp = datetime.now(timezone.utc) - timedelta(hours=48)
        stale_record.home_win = 2.1
        stale_record.draw = 3.4
        stale_record.away_win = 3.8
        stale_record.market_type = "match_odds"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = stale_record
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await compute_market_drift(
            current_odds={"home_win": 2.2, "draw": 3.3, "away_win": 3.7},
            match_id="test_match_id_003",
            db=mock_db,
            max_staleness_hours=24,
        )

        assert set(result.data_gaps) == set(MARKET_FEATURE_NAMES), (
            "Stale opening snapshot must return all features as DATA_GAP"
        )
        for feat in MARKET_FEATURE_NAMES:
            assert result.per_feature_freshness_seconds[feat] is None

    @pytest.mark.asyncio
    async def test_fresh_opening_snapshot_returns_live_features(self):
        """Valid, fresh opening snapshot → all 5 features live with non-None freshness."""
        from datetime import datetime, timedelta, timezone
        from unittest.mock import AsyncMock, MagicMock

        from src.features.market import MARKET_FEATURE_NAMES, compute_market_drift

        fresh_record = MagicMock()
        fresh_record.timestamp = datetime.now(timezone.utc) - timedelta(hours=6)
        fresh_record.home_win = 2.0
        fresh_record.draw = 3.5
        fresh_record.away_win = 4.0
        fresh_record.market_type = "match_odds"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = fresh_record
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await compute_market_drift(
            current_odds={"home_win": 1.9, "draw": 3.6, "away_win": 4.2},
            match_id="test_match_id_004",
            db=mock_db,
            max_staleness_hours=24,
        )

        assert result.data_gaps == [], (
            f"Expected no data gaps for fresh opening snapshot, got {result.data_gaps}"
        )
        for feat in MARKET_FEATURE_NAMES:
            assert result.per_feature_freshness_seconds[feat] is not None, (
                f"Live feature '{feat}' must have non-None freshness"
            )
            assert result.per_feature_freshness_seconds[feat] >= 0


# ---------------------------------------------------------------------------
# compute_match_context unit tests — DATA_GAP returns None freshness at source
# ---------------------------------------------------------------------------


class TestComputeMatchContextDataGap:
    """Unit tests for compute_match_context() confirming correct DATA_GAP behaviour."""

    @pytest.mark.asyncio
    async def test_no_standings_returns_data_gap(self):
        """Missing LeagueStanding rows → DATA_GAP with None freshness."""
        from unittest.mock import AsyncMock, MagicMock

        from src.features.match_context import CONTEXT_FEATURE_NAMES, compute_match_context

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await compute_match_context(
            home_team_id="team_001",
            away_team_id="team_002",
            league="epl",
            db=mock_db,
        )

        assert set(result.data_gaps) == set(CONTEXT_FEATURE_NAMES), (
            "match_importance_score must be DATA_GAP when no standings exist"
        )
        assert result.per_feature_freshness_seconds["match_importance_score"] is None, (
            "DATA_GAP freshness must be None, not 0"
        )

    @pytest.mark.asyncio
    async def test_partial_standings_returns_data_gap(self):
        """Only one team's standing row → DATA_GAP (both teams required)."""
        from unittest.mock import AsyncMock, MagicMock

        from src.features.match_context import compute_match_context

        home_row = MagicMock()
        home_row.team_id = "team_001"
        home_row.position = 3
        home_row.played = 20
        home_row.updated_at = None

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [home_row]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await compute_match_context(
            home_team_id="team_001",
            away_team_id="team_002",
            league="epl",
            db=mock_db,
        )

        assert "match_importance_score" in result.data_gaps
        assert result.per_feature_freshness_seconds["match_importance_score"] is None

    @pytest.mark.asyncio
    async def test_ucl_group_stage_no_db_query(self):
        """UCL group stage uses UCL_STAGE_IMPORTANCE constant — no DB call needed."""
        from unittest.mock import AsyncMock

        from src.features.match_context import UCL_STAGE_IMPORTANCE, compute_match_context

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=AssertionError("DB should not be called for UCL"))

        result = await compute_match_context(
            home_team_id="team_ucl_001",
            away_team_id="team_ucl_002",
            league="ucl",
            db=mock_db,
            competition_stage="group",
        )

        assert result.data_gaps == [], "UCL with known stage must not be DATA_GAP"
        assert result.features["match_importance_score"] == UCL_STAGE_IMPORTANCE["group"]

    @pytest.mark.asyncio
    async def test_ucl_knockout_importance_scales_correctly(self):
        """UCL r16→final stages must return UCL_STAGE_IMPORTANCE values."""
        from unittest.mock import AsyncMock

        from src.features.match_context import UCL_STAGE_IMPORTANCE, compute_match_context

        mock_db = AsyncMock()

        for stage, expected in UCL_STAGE_IMPORTANCE.items():
            result = await compute_match_context(
                home_team_id="team_001",
                away_team_id="team_002",
                league="ucl",
                db=mock_db,
                competition_stage=stage,
            )
            assert result.features["match_importance_score"] == expected, (
                f"UCL {stage}: expected importance {expected}, got "
                f"{result.features['match_importance_score']}"
            )
            assert result.data_gaps == []

    @pytest.mark.asyncio
    async def test_live_domestic_standings_freshness_not_none(self):
        """Valid standings rows → live feature with non-None freshness."""
        from datetime import datetime, timedelta, timezone
        from unittest.mock import AsyncMock, MagicMock

        from src.features.match_context import compute_match_context

        def _row(team_id, position):
            r = MagicMock()
            r.team_id = team_id
            r.position = position
            r.played = 25
            r.updated_at = datetime.now(timezone.utc) - timedelta(hours=4)
            return r

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [_row("team_001", 3), _row("team_002", 12)]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await compute_match_context(
            home_team_id="team_001",
            away_team_id="team_002",
            league="epl",
            db=mock_db,
        )

        assert result.data_gaps == [], f"Expected no data gaps, got {result.data_gaps}"
        freshness = result.per_feature_freshness_seconds["match_importance_score"]
        assert freshness is not None, "Live standings must produce non-None freshness"
        assert freshness >= 0
