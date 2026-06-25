"""Phase 7-A Elo rating engine with pre-match snapshots and idempotent updates."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple

import pandas as pd

from ..core.config import settings

logger = logging.getLogger(__name__)


_DEFAULT_BASE_ELO = 1500.0


@dataclass(frozen=True)
class EloContext:
    home_elo: float
    away_elo: float
    elo_difference: float
    home_elo_trend_5: float
    away_elo_trend_5: float
    elo_momentum_cross: float


class EloEngine:
    """Compute and persist Elo pre-match snapshots and post-match updates."""

    LEAGUE_IMPORTANCE: Dict[str, float] = {
        "epl": 1.2,
        "premier_league": 1.2,
        "la_liga": 1.2,
        "serie_a": 1.2,
        "bundesliga": 1.0,
        "ligue_1": 1.0,
        "eredivisie": 0.9,
    }

    def __init__(self, parquet_path: Optional[Path] = None) -> None:
        self.parquet_path = Path(parquet_path or settings.elo_parquet_path)
        self._columns = [
            "match_id",
            "team_id",
            "pre_match_elo",
            "post_match_elo",
            "league",
            "season",
            "match_date",
        ]
        self._cache: Optional[pd.DataFrame] = None

    def get_context(
        self,
        home_team_id: str,
        away_team_id: str,
        league: str,
        season: str,
        match_date: datetime,
    ) -> EloContext:
        """Return pre-match Elo context without mutating state."""
        home_pre, home_trend = self._get_pre_and_trend(home_team_id, league, season, match_date)
        away_pre, away_trend = self._get_pre_and_trend(away_team_id, league, season, match_date)
        elo_diff = home_pre - away_pre
        return EloContext(
            home_elo=home_pre,
            away_elo=away_pre,
            elo_difference=elo_diff,
            home_elo_trend_5=home_trend,
            away_elo_trend_5=away_trend,
            elo_momentum_cross=home_trend - away_trend,
        )

    def update_after_match(
        self,
        match_id: str,
        home_team_id: str,
        away_team_id: str,
        home_goals: int,
        away_goals: int,
        league: str,
        season: str,
        match_date: datetime,
    ) -> Dict[str, float]:
        """Apply a post-match update while preserving pre-match snapshots.

        Idempotent by match_id: if the match already exists for both teams, no-op.
        """
        table = self._load_table()
        existing = table[table["match_id"] == match_id]
        if not existing.empty:
            logger.info("Elo update skipped for existing match_id=%s", match_id)
            return {
                "home_pre": float(existing[existing["team_id"] == home_team_id]["pre_match_elo"].iloc[0]) if (existing["team_id"] == home_team_id).any() else _DEFAULT_BASE_ELO,
                "away_pre": float(existing[existing["team_id"] == away_team_id]["pre_match_elo"].iloc[0]) if (existing["team_id"] == away_team_id).any() else _DEFAULT_BASE_ELO,
                "home_post": float(existing[existing["team_id"] == home_team_id]["post_match_elo"].iloc[0]) if (existing["team_id"] == home_team_id).any() else _DEFAULT_BASE_ELO,
                "away_post": float(existing[existing["team_id"] == away_team_id]["post_match_elo"].iloc[0]) if (existing["team_id"] == away_team_id).any() else _DEFAULT_BASE_ELO,
            }

        home_pre, _ = self._get_pre_and_trend(home_team_id, league, season, match_date)
        away_pre, _ = self._get_pre_and_trend(away_team_id, league, season, match_date)

        home_exp, away_exp = self._expected_scores(home_pre, away_pre)
        if home_goals > away_goals:
            home_actual, away_actual = 1.0, 0.0
        elif home_goals < away_goals:
            home_actual, away_actual = 0.0, 1.0
        else:
            home_actual, away_actual = 0.5, 0.5

        k_factor = float(settings.elo_k_base) * self.LEAGUE_IMPORTANCE.get(league.lower(), 1.0)
        home_post = home_pre + k_factor * (home_actual - home_exp)
        away_post = away_pre + k_factor * (away_actual - away_exp)

        home_row = {
            "match_id": match_id,
            "team_id": str(home_team_id),
            "pre_match_elo": float(home_pre),
            "post_match_elo": float(home_post),
            "league": league,
            "season": season,
            "match_date": pd.Timestamp(match_date),
        }
        away_row = {
            "match_id": match_id,
            "team_id": str(away_team_id),
            "pre_match_elo": float(away_pre),
            "post_match_elo": float(away_post),
            "league": league,
            "season": season,
            "match_date": pd.Timestamp(match_date),
        }

        updated = pd.concat([table, pd.DataFrame([home_row, away_row])], ignore_index=True)
        updated = updated[self._columns]
        self._persist(updated)

        return {
            "home_pre": float(home_pre),
            "away_pre": float(away_pre),
            "home_post": float(home_post),
            "away_post": float(away_post),
        }

    def _expected_scores(self, home_elo: float, away_elo: float) -> Tuple[float, float]:
        home_adv = float(settings.elo_home_advantage)
        adjusted_home = home_elo + home_adv
        home_expected = 1.0 / (1.0 + 10 ** ((away_elo - adjusted_home) / 400.0))
        return home_expected, 1.0 - home_expected

    def _get_pre_and_trend(
        self,
        team_id: str,
        league: str,
        season: str,
        match_date: datetime,
    ) -> Tuple[float, float]:
        table = self._load_table()
        team_rows = table[
            (table["team_id"].astype(str) == str(team_id))
            & (table["league"].astype(str).str.lower() == league.lower())
            & (pd.to_datetime(table["match_date"]) < pd.Timestamp(match_date))
        ].sort_values("match_date")

        if team_rows.empty:
            return _DEFAULT_BASE_ELO, 0.0

        last_post = float(team_rows["post_match_elo"].iloc[-1])
        trend = self._rolling_trend(team_rows)

        current_season_rows = team_rows[team_rows["season"].astype(str) == str(season)]
        if current_season_rows.empty:
            league_rows = table[
                (table["league"].astype(str).str.lower() == league.lower())
                & (table["season"].astype(str) == str(season))
                & (pd.to_datetime(table["match_date"]) < pd.Timestamp(match_date))
            ]
            league_mean = float(league_rows["post_match_elo"].mean()) if not league_rows.empty else _DEFAULT_BASE_ELO
            # Season carry-over decay toward league mean.
            last_post = league_mean + 0.5 * (last_post - league_mean)

        return last_post, trend

    def _rolling_trend(self, team_rows: pd.DataFrame) -> float:
        post = team_rows["post_match_elo"].astype(float)
        pre = team_rows["pre_match_elo"].astype(float)
        delta = (post - pre).tail(5)
        if delta.empty:
            return 0.0
        return float(delta.mean())

    def _load_table(self) -> pd.DataFrame:
        if self._cache is not None:
            return self._cache.copy()

        if not self.parquet_path.exists():
            empty = pd.DataFrame(columns=self._columns)
            self._cache = empty
            return empty.copy()

        try:
            table = pd.read_parquet(self.parquet_path)
        except Exception as exc:
            logger.warning("Failed to load Elo parquet %s: %s", self.parquet_path, exc)
            table = pd.DataFrame(columns=self._columns)

        for col in self._columns:
            if col not in table.columns:
                table[col] = pd.Series(dtype="float64")

        table = table[self._columns]
        self._cache = table
        return table.copy()

    def _persist(self, table: pd.DataFrame) -> None:
        self.parquet_path.parent.mkdir(parents=True, exist_ok=True)
        table_to_write = table.copy()
        table_to_write["match_date"] = pd.to_datetime(table_to_write["match_date"])
        table_to_write = table_to_write.sort_values(["league", "season", "match_date", "team_id"])

        table_to_write.to_parquet(self.parquet_path, index=False)
        self._cache = table_to_write
