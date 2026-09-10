"""Temporal-integrity guard for the FBref pre-match rollups.

FBref statistics describe a *completed* match. The single thing that must never
happen is a fixture's own result entering its own pre-match feature row.

These tests are constructed so that removing the ``shift(1)`` in
``build_pre_match_rollups`` makes them fail loudly rather than drift quietly --
the repository's convention that a guard nobody has watched fail is not a guard.
Verified by deleting the shift and observing red, then restoring.
"""

from __future__ import annotations

import sys
from pathlib import Path

import polars as pl
import pytest

_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(_SCRIPTS))

pytest.importorskip("polars")

from ingest_fbref_sources import build_pre_match_rollups  # noqa: E402


def _fixtures() -> pl.LazyFrame:
    """One team, four matches, goals-for strictly increasing so leakage is visible."""
    return pl.LazyFrame(
        {
            "team_identity_key": ["arsenal"] * 4,
            "date": ["2023-01-01", "2023-01-08", "2023-01-15", "2023-01-22"],
            "gf": [1.0, 2.0, 3.0, 4.0],
            "ga": [0.0, 0.0, 0.0, 0.0],
        }
    )


def test_first_match_has_no_pre_match_history() -> None:
    """A team's first match cannot have a pre-match mean -- there is no prior."""
    out = build_pre_match_rollups(_fixtures()).collect()
    first = out.filter(pl.col("date") == "2023-01-01")
    assert first["gf_pre_match_mean_5"][0] is None, (
        "the first match has no earlier fixture, so its pre-match mean must be "
        "null; a value here means the row saw its own result"
    )


def test_pre_match_mean_excludes_the_current_match() -> None:
    """Each row's mean must equal the mean of STRICTLY earlier matches only."""
    out = build_pre_match_rollups(_fixtures()).collect().sort("date")
    means = out["gf_pre_match_mean_5"].to_list()

    # gf = [1, 2, 3, 4]; strictly-prior means are [None, 1, 1.5, 2].
    assert means[1] == pytest.approx(1.0)
    assert means[2] == pytest.approx(1.5)
    assert means[3] == pytest.approx(2.0)

    # The leaked values would be the inclusive means [1, 1.5, 2, 2.5]. Assert we
    # are not producing those, so removing shift(1) fails here specifically.
    leaked = [1.0, 1.5, 2.0, 2.5]
    assert means[1:] != pytest.approx(leaked[1:]), (
        "pre-match means match the INCLUSIVE rolling mean, which means the "
        "current match leaked into its own feature row"
    )


def test_each_row_never_exceeds_the_max_of_its_history() -> None:
    """A structural check that survives changes to the window size.

    With strictly-increasing goals, a correct pre-match mean is always < the
    current row's own value. If a row's mean reaches or exceeds its own gf, the
    current match was included.
    """
    out = build_pre_match_rollups(_fixtures()).collect().sort("date")
    for row in out.iter_rows(named=True):
        mean = row["gf_pre_match_mean_5"]
        if mean is None:
            continue
        assert mean < row["gf"], (
            f"pre-match mean {mean} >= own gf {row['gf']} on {row['date']}: "
            "the current match leaked into its own aggregate"
        )


def test_teams_do_not_bleed_into_each_other() -> None:
    """The rolling window is partitioned per team, not global."""
    frame = pl.LazyFrame(
        {
            "team_identity_key": ["arsenal", "chelsea", "arsenal", "chelsea"],
            "date": ["2023-01-01", "2023-01-01", "2023-01-08", "2023-01-08"],
            "gf": [1.0, 10.0, 2.0, 20.0],
            "ga": [0.0, 0.0, 0.0, 0.0],
        }
    )
    out = build_pre_match_rollups(frame).collect()
    arsenal_second = out.filter(
        (pl.col("team_identity_key") == "arsenal") & (pl.col("date") == "2023-01-08")
    )
    assert arsenal_second["gf_pre_match_mean_5"][0] == pytest.approx(1.0), (
        "Arsenal's pre-match mean picked up Chelsea's goals; the window is not "
        "partitioned per team"
    )
