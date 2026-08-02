from __future__ import annotations

import pytest

from src.repositories.fixtures import build_settled_fixtures_query


def test_settled_fixture_query_requires_score_verified_final_rows() -> None:
    statement = build_settled_fixtures_query(limit=25, league="EPL")
    sql = str(statement.compile(compile_kwargs={"literal_binds": True})).lower()

    assert "home_score is not null" in sql
    assert "away_score is not null" in sql
    assert "lower(matches.status) in" in sql
    assert "lower(matches.league_id) = 'epl'" in sql
    assert "limit 25" in sql


@pytest.mark.parametrize("limit", [0, -1, 20_001])
def test_settled_fixture_query_rejects_unsafe_limits(limit: int) -> None:
    with pytest.raises(ValueError):
        build_settled_fixtures_query(limit=limit)
