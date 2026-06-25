from __future__ import annotations

from dataclasses import dataclass
from typing import Generator

import pandas as pd


@dataclass(frozen=True)
class TemporalSplit:
    train_idx: pd.Index
    val_idx: pd.Index
    season_label: str


def walk_forward_splits(
    df: pd.DataFrame,
    date_col: str = "match_date",
    min_train_seasons: int = 3,
) -> Generator[TemporalSplit, None, None]:
    """Yield expanding-window season splits using A-JUL season boundaries."""
    if date_col not in df.columns:
        raise ValueError(f"Missing required date column: {date_col}")

    ordered = df.sort_values(date_col).copy()
    ordered[date_col] = pd.to_datetime(ordered[date_col], errors="coerce")
    ordered = ordered.dropna(subset=[date_col])

    seasons = ordered[date_col].dt.to_period("A-JUL")
    unique_seasons = sorted(seasons.unique())

    if len(unique_seasons) < min_train_seasons + 1:
        raise ValueError(
            f"Need at least {min_train_seasons + 1} seasons; found {len(unique_seasons)}"
        )

    for i in range(min_train_seasons, len(unique_seasons) - 1):
        train_seasons = unique_seasons[: i + 1]
        val_season = unique_seasons[i + 1]

        train_mask = seasons.isin(train_seasons)
        val_mask = seasons == val_season

        train_idx = ordered.loc[train_mask].index
        val_idx = ordered.loc[val_mask].index

        if len(train_idx) == 0 or len(val_idx) == 0:
            continue

        yield TemporalSplit(
            train_idx=train_idx,
            val_idx=val_idx,
            season_label=str(val_season),
        )
