"""WP-2 regression tests:

1. _get_team_stats / _get_team_results_sequence must not have a wall-clock
   lookback floor — a team's last completed match older than the old 60/120-day
   window must still resolve (the close-season bug).
2. project_match_features()'s data_gaps must be provenance-based (caller-owned
   feature families excluded, never inferred from the numeric value) rather
   than the old `value in (None, 0.0)` heuristic, which was both a false
   positive (a genuine 0.0) and a false negative (a non-zero default silently
   never flagged).
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.core.database import Base, Match, Team
from src.models.feature_registry import PHASE7_FEATURES_7, PHASE7_FEATURES_ALWAYS_DATA_GAP
from src.services.upcoming_match_feature_service import (
    _CALLER_RESOLVED_FEATURES,
    UpcomingMatchFeatureProjector,
)


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


@pytest.fixture
def projector() -> UpcomingMatchFeatureProjector:
    p = UpcomingMatchFeatureProjector()
    p._use_phase8 = False
    return p


MATCH_DATE = datetime(2026, 8, 10, 15, 0)


async def _seed_old_match(session: AsyncSession, days_before: int) -> None:
    session.add_all(
        [
            Team(id="team-home", name="Home FC", active=True),
            Team(id="team-away", name="Away FC", active=True),
            Team(id="team-opp", name="Opponent FC", active=True),
        ]
    )
    await session.commit()
    old_date = MATCH_DATE - timedelta(days=days_before)
    session.add(
        Match(
            id="old-match",
            home_team_id="team-home",
            away_team_id="team-opp",
            match_date=old_date,
            status="finished",
            home_score=2,
            away_score=1,
        )
    )
    await session.commit()


async def test_get_team_stats_finds_match_older_than_60_days(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    await _seed_old_match(session, days_before=90)
    stats = await projector._get_team_stats("team-home", session, MATCH_DATE)
    assert stats is not None


async def test_get_team_stats_none_with_no_history(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    await _seed_old_match(session, days_before=90)
    stats = await projector._get_team_stats("team-away", session, MATCH_DATE)
    assert stats is None


async def test_get_team_results_sequence_finds_match_older_than_120_days(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    await _seed_old_match(session, days_before=150)
    results = await projector._get_team_results_sequence("team-home", session, MATCH_DATE)
    assert results == [1]  # 2-1 win


async def test_get_team_results_sequence_empty_with_no_history(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    await _seed_old_match(session, days_before=150)
    results = await projector._get_team_results_sequence("team-away", session, MATCH_DATE)
    assert results == []


# ---------------------------------------------------------------------------
# data_gaps: provenance-based, not value-based
# ---------------------------------------------------------------------------


def test_caller_resolved_features_excludes_always_gap_feature() -> None:
    assert "shot_quality_diff" not in _CALLER_RESOLVED_FEATURES
    for feature in PHASE7_FEATURES_7:
        if feature not in PHASE7_FEATURES_ALWAYS_DATA_GAP:
            assert feature in _CALLER_RESOLVED_FEATURES


async def test_orphan_base_feature_always_flagged_as_gap(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    """home_form_last5_home is never populated by any code path in
    project_match_features() — it must always be a gap, not value-inferred."""
    await _seed_old_match(session, days_before=1)
    result = await projector.project_match_features(
        {"id": "m1", "home_team": "Home FC", "away_team": "Away FC", "league": "EPL"},
        session,
        MATCH_DATE,
    )
    assert "home_form_last5_home" in result["data_gaps"]


async def test_caller_resolved_features_never_locally_flagged(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    """elo/statsbomb features are resolved by the CALLER one layer up
    (build_live_feature_vector) — project_match_features() must defer to it,
    never flag them itself (the old heuristic always flagged elo_difference
    since its default is exactly 0.0, regardless of the real elo overlay that
    happens right after this function returns)."""
    await _seed_old_match(session, days_before=1)
    result = await projector.project_match_features(
        {"id": "m1", "home_team": "Home FC", "away_team": "Away FC", "league": "EPL"},
        session,
        MATCH_DATE,
    )
    for feature in PHASE7_FEATURES_7:
        if feature in result["data_gaps"] and feature not in PHASE7_FEATURES_ALWAYS_DATA_GAP:
            pytest.fail(f"{feature} is caller-resolved and must not be locally flagged")


async def test_shot_quality_diff_always_flagged(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    await _seed_old_match(session, days_before=1)
    result = await projector.project_match_features(
        {"id": "m1", "home_team": "Home FC", "away_team": "Away FC", "league": "EPL"},
        session,
        MATCH_DATE,
    )
    assert "shot_quality_diff" in result["data_gaps"]


# ---------------------------------------------------------------------------
# EWMA form: an empty results sequence must not silently pass as fresh data
# ---------------------------------------------------------------------------


async def test_ewma_form_flags_gap_when_team_has_no_history(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    """weighted_form_features([]) returns neutral priors without raising — a team
    with zero completed matches must still be flagged as a gap, not silently
    marked freshness=0/source=match_history as if genuinely computed."""
    projector._use_phase8 = True  # only this block matters; pi/berrar/market/context
    # engines are independently gap-tracked and may legitimately fail in this
    # dependency-light test — that's expected and not what's under test here.
    features_dict: dict = {}
    phase8_gaps, freshness, sources = await projector._inject_phase8_features(
        features_dict=features_dict,
        home_team_id="team-does-not-exist-home",
        away_team_id="team-does-not-exist-away",
        home_team="Nowhere FC",
        away_team="Nobody FC",
        league="EPL",
        match_id="m1",
        db=session,
        match_date=MATCH_DATE,
    )
    for key in (
        "home_weighted_win_rate",
        "home_weighted_draw_rate",
        "home_weighted_ppg",
        "away_weighted_win_rate",
        "away_weighted_draw_rate",
        "away_weighted_ppg",
    ):
        assert key in phase8_gaps, f"{key} should be flagged — no match history exists"
        assert freshness[key] is None


async def test_ewma_form_not_flagged_when_history_exists(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    await _seed_old_match(session, days_before=1)
    projector._use_phase8 = True
    features_dict: dict = {}
    phase8_gaps, freshness, _sources = await projector._inject_phase8_features(
        features_dict=features_dict,
        home_team_id="team-home",
        away_team_id="team-opp",
        home_team="Home FC",
        away_team="Opponent FC",
        league="EPL",
        match_id="m1",
        db=session,
        match_date=MATCH_DATE,
    )
    for key in ("home_weighted_win_rate", "away_weighted_win_rate"):
        assert key not in phase8_gaps
        assert freshness[key] == 0


# ---------------------------------------------------------------------------
# WP-3.1: fail-closed schema mismatch (never zero-pad a short feature vector)
# ---------------------------------------------------------------------------


async def test_feature_array_length_mismatch_raises_schema_mismatch(
    session: AsyncSession, projector: UpcomingMatchFeatureProjector
) -> None:
    """The length-mismatch guard in project_match_features() is unreachable via
    normal inputs — features_array is always rebuilt fresh, one scalar per
    entry of self.canonical_features, immediately before the check, so the
    lengths can never diverge through any input mutation. Patch the function's
    single np.array() call site to simulate the guard's precondition directly
    and prove it fails closed (never zero-pads) if that invariant is ever
    broken by a future edit."""
    from unittest.mock import patch

    import numpy as np

    from src.core.exceptions import SchemaMismatchError

    await _seed_old_match(session, days_before=1)

    real_array = np.array

    def _truncated_array(seq, *args, **kwargs):
        result = real_array(seq, *args, **kwargs)
        return result[:-1] if result.ndim == 1 and len(result) > 1 else result

    with patch(
        "src.services.upcoming_match_feature_service.np.array",
        side_effect=_truncated_array,
    ):
        with pytest.raises(SchemaMismatchError):
            await projector.project_match_features(
                {"id": "m1", "home_team": "Home FC", "away_team": "Opponent FC"},
                db=session,
                match_date=MATCH_DATE,
            )
