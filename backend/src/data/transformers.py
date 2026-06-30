"""Strict, inference-safe feature transformation.

Production inference must never manufacture a plausible feature value.  This
module therefore accepts either:

* a complete ``canonical_features`` mapping produced by a versioned feature
  store, or
* complete, real source payloads from which the canonical model vector can be
  derived deterministically.

Missing, null, stale-at-source, or malformed inputs raise
:class:`DataUnavailableError`.  Test fixtures belong under ``backend/tests``;
there are no production defaults in this module.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any, Callable, Dict, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from ..core.exceptions import DataUnavailableError
from ..models.feature_registry import CANONICAL_FEATURES_68

logger = logging.getLogger(__name__)

MODEL_EXPECTED_FEATURES = list(CANONICAL_FEATURES_68)


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or isinstance(value, bool):
            return None
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if np.isfinite(parsed) else None


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def _required_mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping) or not value:
        raise DataUnavailableError(path)
    return value


def _required_number(
    mapping: Mapping[str, Any],
    key: str,
    path: str,
    *,
    greater_than: float | None = None,
) -> float:
    value = _safe_float(mapping.get(key))
    if value is None or (greater_than is not None and value <= greater_than):
        raise DataUnavailableError(f"{path}.{key}")
    return value


def _required_results(form: Mapping[str, Any], path: str) -> list[str]:
    raw = form.get("last_5_games")
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)) or not raw:
        raise DataUnavailableError(f"{path}.last_5_games")
    values = [str(item).upper() for item in raw]
    invalid = [item for item in values if item not in {"W", "D", "L"}]
    if invalid:
        raise DataUnavailableError(f"{path}.last_5_games", reason="INVALID_SOURCE_DATA")
    return values[:5]


def _result_counts(results: Sequence[str]) -> tuple[float, float, float, float]:
    wins = float(sum(1 for item in results if item == "W"))
    draws = float(sum(1 for item in results if item == "D"))
    losses = float(sum(1 for item in results if item == "L"))
    points_per_game = (wins * 3.0 + draws) / float(len(results))
    return points_per_game, wins, draws, losses


class FeatureTransformer:
    """Build the canonical model vector without synthetic fallbacks."""

    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.expected_columns = list(CANONICAL_FEATURES_68)

    def engineer_features(self, match_data: Dict[str, Any]) -> pd.DataFrame:
        if not isinstance(match_data, dict):
            raise DataUnavailableError("match_data")

        canonical_payload = match_data.get("canonical_features")
        if canonical_payload is not None:
            return self._from_canonical_payload(canonical_payload)

        return self._derive_canonical_features(match_data)

    def _from_canonical_payload(self, payload: Any) -> pd.DataFrame:
        mapping = _required_mapping(payload, "canonical_features")
        missing = [name for name in self.expected_columns if _safe_float(mapping.get(name)) is None]
        if missing:
            raise DataUnavailableError([f"canonical_features.{name}" for name in missing])
        row = {name: float(mapping[name]) for name in self.expected_columns}
        return self._validate_features(pd.DataFrame([row]))

    def _derive_canonical_features(self, match_data: Dict[str, Any]) -> pd.DataFrame:
        odds = _required_mapping(match_data.get("odds"), "odds")
        schedule = _required_mapping(match_data.get("schedule"), "schedule")
        current_form = _required_mapping(match_data.get("current_form"), "current_form")
        team_stats = _required_mapping(match_data.get("team_stats"), "team_stats")
        league_policy = _required_mapping(match_data.get("league_policy"), "league_policy")
        enhanced = _required_mapping(match_data.get("enhanced_features"), "enhanced_features")

        history = match_data.get("historical_stats")
        if not isinstance(history, pd.DataFrame) or history.empty:
            raise DataUnavailableError("historical_stats")
        required_history_columns = {"home_score", "away_score"}
        if not required_history_columns.issubset(history.columns):
            raise DataUnavailableError(
                [f"historical_stats.{name}" for name in sorted(required_history_columns - set(history.columns))]
            )

        h2h = match_data.get("head_to_head")
        if not isinstance(h2h, pd.DataFrame) or h2h.empty:
            raise DataUnavailableError("head_to_head")
        if not required_history_columns.issubset(h2h.columns):
            raise DataUnavailableError(
                [f"head_to_head.{name}" for name in sorted(required_history_columns - set(h2h.columns))]
            )

        home_form = _required_mapping(current_form.get("home"), "current_form.home")
        away_form = _required_mapping(current_form.get("away"), "current_form.away")
        home_results = _required_results(home_form, "current_form.home")
        away_results = _required_results(away_form, "current_form.away")
        home_ppg, home_wins, home_draws, home_losses = _result_counts(home_results)
        away_ppg, away_wins, away_draws, away_losses = _result_counts(away_results)

        home_stats = _required_mapping(team_stats.get("home"), "team_stats.home")
        away_stats = _required_mapping(team_stats.get("away"), "team_stats.away")

        home_odds = _required_number(odds, "home_win", "odds", greater_than=1.0)
        draw_odds = _required_number(odds, "draw", "odds", greater_than=1.0)
        away_odds = _required_number(odds, "away_win", "odds", greater_than=1.0)

        implied_home = 1.0 / home_odds
        implied_draw = 1.0 / draw_odds
        implied_away = 1.0 / away_odds
        overround = implied_home + implied_draw + implied_away
        if overround <= 0:
            raise DataUnavailableError("odds.overround", reason="INVALID_SOURCE_DATA")
        market_home = implied_home / overround
        market_draw = implied_draw / overround
        market_away = implied_away / overround

        home_goals_for = self._real_rate(home_form, home_stats, "goals_scored", "goals_per_game", len(home_results), "home")
        away_goals_for = self._real_rate(away_form, away_stats, "goals_scored", "goals_per_game", len(away_results), "away")
        home_goals_against = self._real_rate(
            home_form, home_stats, "goals_conceded", "goals_conceded_per_game", len(home_results), "home"
        )
        away_goals_against = self._real_rate(
            away_form, away_stats, "goals_conceded", "goals_conceded_per_game", len(away_results), "away"
        )

        home_xg = self._first_required_number(
            ((enhanced, "us_home_xg_pg"), (home_stats, "xg_avg_5"), (home_stats, "xg_avg")),
            "home_xg",
        )
        away_xg = self._first_required_number(
            ((enhanced, "us_away_xg_pg"), (away_stats, "xg_avg_5"), (away_stats, "xg_avg")),
            "away_xg",
        )

        h2h_home_wins = float((h2h["home_score"] > h2h["away_score"]).sum())
        h2h_away_wins = float((h2h["away_score"] > h2h["home_score"]).sum())
        h2h_draws = float((h2h["home_score"] == h2h["away_score"]).sum())
        h2h_matches = float(len(h2h))
        if h2h_matches <= 0:
            raise DataUnavailableError("head_to_head")
        h2h_dominance = (h2h_home_wins - h2h_away_wins) / h2h_matches

        home_venue_win_rate = self._first_required_number(
            ((home_form, "venue_win_rate"), (schedule, "home_venue_win_rate")),
            "home_venue_win_rate",
        )
        home_venue_draw_rate = self._first_required_number(
            ((home_form, "venue_draw_rate"), (schedule, "home_venue_draw_rate")),
            "home_venue_draw_rate",
        )
        home_venue_loss_rate = self._first_required_number(
            ((home_form, "venue_loss_rate"), (schedule, "home_venue_loss_rate")),
            "home_venue_loss_rate",
        )
        venue_total = home_venue_win_rate + home_venue_draw_rate + home_venue_loss_rate
        if not 0.99 <= venue_total <= 1.01:
            raise DataUnavailableError("home_venue_rates", reason="INVALID_SOURCE_DATA")

        kickoff_raw = schedule.get("date")
        if kickoff_raw in (None, ""):
            raise DataUnavailableError("schedule.date")
        try:
            kickoff = pd.to_datetime(kickoff_raw, utc=True)
        except Exception as exc:
            raise DataUnavailableError("schedule.date", reason="INVALID_SOURCE_DATA") from exc

        league_slug = str(schedule.get("league") or "").strip().lower().replace(" ", "_")
        if not league_slug:
            raise DataUnavailableError("schedule.league")

        league_home_rate = _required_number(league_policy, "home_win_rate", "league_policy")
        league_avg_goals = _required_number(league_policy, "average_goals", "league_policy")
        league_draw_rate = _required_number(league_policy, "draw_prior", "league_policy")

        home_elo = self._first_required_number(((home_stats, "elo"), (enhanced, "home_elo")), "home_elo")
        away_elo = self._first_required_number(((away_stats, "elo"), (enhanced, "away_elo")), "away_elo")
        elo_home_trend = self._first_required_number(
            ((home_stats, "elo_trend_5"), (enhanced, "elo_home_trend_5")), "elo_home_trend_5"
        )
        elo_away_trend = self._first_required_number(
            ((away_stats, "elo_trend_5"), (enhanced, "elo_away_trend_5")), "elo_away_trend_5"
        )
        pressing = self._first_required_number(
            ((enhanced, "home_pressing_intensity"), (enhanced, "sb_home_pressing_intensity"), (home_stats, "pressing_intensity")),
            "home_pressing_intensity",
        )
        progressive_carry_diff = self._first_required_number(
            ((enhanced, "progressive_carry_diff"), (enhanced, "sb_progressive_carry_diff")),
            "progressive_carry_diff",
        )
        shot_quality_diff = self._first_required_number(
            ((enhanced, "shot_quality_diff"), (enhanced, "sb_shot_quality_diff")),
            "shot_quality_diff",
        )

        home_gd_recent = home_goals_for - home_goals_against
        away_gd_recent = away_goals_for - away_goals_against
        combined_attack = home_goals_for + away_goals_for
        combined_defense = home_goals_against + away_goals_against
        total_goals_expected = home_xg + away_xg
        home_advantage_strength = home_venue_win_rate - home_venue_loss_rate

        canonical: dict[str, float] = {
            "home_form_last5_home": home_ppg,
            "home_wins_last5_home": home_wins,
            "home_draws_last5_home": home_draws,
            "home_losses_last5_home": home_losses,
            "away_form_last5_away": away_ppg,
            "away_wins_last5_away": away_wins,
            "away_draws_last5_away": away_draws,
            "away_losses_last5_away": away_losses,
            "home_goals_for_avg": home_goals_for,
            "home_goals_against_avg": home_goals_against,
            "away_goals_for_avg": away_goals_for,
            "away_goals_against_avg": away_goals_against,
            "total_goals_expected": total_goals_expected,
            "home_gd_recent": home_gd_recent,
            "away_gd_recent": away_gd_recent,
            "combined_attack": combined_attack,
            "combined_defense_weakness": combined_defense,
            "market_prob_home": market_home,
            "market_prob_draw": market_draw,
            "market_prob_away": market_away,
            "market_edge_home": market_home - market_away,
            "market_favorite": float(np.argmax([market_home, market_draw, market_away])),
            "odds_ratio": home_odds / away_odds,
            "log_odds_home": float(np.log(home_odds)),
            "log_odds_draw": float(np.log(draw_odds)),
            "log_odds_away": float(np.log(away_odds)),
            "draw_probability": market_draw,
            "market_confidence": max(market_home, market_draw, market_away),
            "ev_home": market_home * home_odds - 1.0,
            "ev_draw": market_draw * draw_odds - 1.0,
            "ev_away": market_away * away_odds - 1.0,
            "h2h_home_wins": h2h_home_wins,
            "h2h_away_wins": h2h_away_wins,
            "h2h_draws": h2h_draws,
            "h2h_matches": h2h_matches,
            "h2h_dominance": h2h_dominance,
            "home_venue_win_rate": home_venue_win_rate,
            "home_venue_draw_rate": home_venue_draw_rate,
            "home_venue_loss_rate": home_venue_loss_rate,
            "home_advantage_strength": home_advantage_strength,
            "day_of_week": float(kickoff.dayofweek),
            "is_weekend": 1.0 if kickoff.dayofweek >= 5 else 0.0,
            "month": float(kickoff.month),
            "season_phase": float((kickoff.month - 1) / 11.0),
            "league_home_rate": league_home_rate,
            "league_avg_goals": league_avg_goals,
            "league_draw_rate": league_draw_rate,
            "form_market_agreement_home": (home_ppg / 3.0) * market_home,
            "form_market_disagreement": abs((home_ppg / 3.0) - market_home),
            "home_attack_vs_away_defense": home_goals_for - away_goals_against,
            "away_attack_vs_home_defense": away_goals_for - home_goals_against,
            "venue_market_combo": home_venue_win_rate * market_home,
            "h2h_market_agreement": h2h_dominance * market_home,
            "league_Bundesliga": 1.0 if league_slug == "bundesliga" else 0.0,
            "league_EPL": 1.0 if league_slug in {"epl", "premier_league"} else 0.0,
            "league_La_Liga": 1.0 if league_slug in {"la_liga", "laliga"} else 0.0,
            "league_Ligue_1": 1.0 if league_slug in {"ligue_1", "ligue1"} else 0.0,
            "league_Serie_A": 1.0 if league_slug in {"serie_a", "seriea"} else 0.0,
            "elo_difference": home_elo - away_elo,
            "elo_home_trend_5": elo_home_trend,
            "elo_away_trend_5": elo_away_trend,
            "elo_momentum_cross": elo_home_trend - elo_away_trend,
            "home_pressing_intensity": pressing,
            "progressive_carry_diff": progressive_carry_diff,
            "shot_quality_diff": shot_quality_diff,
        }
        return self._validate_features(pd.DataFrame([canonical]))

    @staticmethod
    def _real_rate(
        form: Mapping[str, Any],
        stats: Mapping[str, Any],
        form_total_key: str,
        stats_rate_key: str,
        matches: int,
        side: str,
    ) -> float:
        direct = _safe_float(stats.get(stats_rate_key))
        if direct is not None:
            return direct
        total = _safe_float(form.get(form_total_key))
        if total is None or matches <= 0:
            raise DataUnavailableError(f"{side}.{stats_rate_key}")
        return total / float(matches)

    @staticmethod
    def _first_required_number(
        candidates: Sequence[tuple[Mapping[str, Any], str]],
        path: str,
    ) -> float:
        for mapping, key in candidates:
            value = _safe_float(mapping.get(key))
            if value is not None:
                return value
        raise DataUnavailableError(path)

    def _apply_enhanced_features(self, features: pd.DataFrame, match_data: Dict[str, Any]) -> pd.DataFrame:
        """Apply only values explicitly present in an enhanced source payload."""
        if features.empty:
            raise DataUnavailableError("features")
        enhanced = match_data.get("enhanced_features") if isinstance(match_data, dict) else None
        if not isinstance(enhanced, Mapping) or not enhanced:
            raise DataUnavailableError("enhanced_features")

        overrides: tuple[tuple[str, str, Optional[Callable[[float], float]]], ...] = (
            ("ws_home_win_rate_5", "home_win_rate_5", lambda value: _clamp(value, 0.0, 1.0)),
            ("ws_away_win_rate_5", "away_win_rate_5", lambda value: _clamp(value, 0.0, 1.0)),
            ("ws_home_avg_possession", "home_possession_style", lambda value: _clamp(value / 100.0 if value > 1 else value, 0.0, 1.0)),
            ("ws_away_avg_possession", "away_possession_style", lambda value: _clamp(value / 100.0 if value > 1 else value, 0.0, 1.0)),
            ("us_home_xg_pg", "home_xg_avg_5", None),
            ("us_away_xg_pg", "away_xg_avg_5", None),
            ("us_home_xga_pg", "home_xg_conceded_avg_5", None),
            ("us_away_xga_pg", "away_xg_conceded_avg_5", None),
            ("us_home_xg_diff", "home_xg_diff_5", None),
            ("us_away_xg_diff", "away_xg_diff_5", None),
            ("tm_value_diff_m", "squad_value_diff", None),
            ("bf_market_margin_pct", "bookmaker_margin", lambda value: value / 100.0 if value > 1 else value),
        )
        index = features.index[0]
        for source, target, transform in overrides:
            value = _safe_float(enhanced.get(source))
            if value is None:
                continue
            features.loc[index, target] = transform(value) if transform is not None else value

        self._apply_enhanced_xg_consistency(features, enhanced, index)
        self._apply_enhanced_odds(features, enhanced, index)
        return features

    def _apply_enhanced_xg_consistency(
        self,
        features: pd.DataFrame,
        enhanced: Mapping[str, Any],
        index: Any,
    ) -> None:
        for side in ("home", "away"):
            recent = _safe_float(enhanced.get(f"us_{side}_recent_xg"))
            average = _safe_float(enhanced.get(f"us_{side}_xg_pg"))
            if recent is not None and average not in (None, 0.0):
                variance = abs(recent - average) / max(abs(average), 1e-3)
                features.loc[index, f"{side}_xg_consistency"] = round(
                    _clamp(1.0 - min(variance, 1.0) * 0.5, 0.0, 1.0), 3
                )

        home_diff = _safe_float(features.loc[index, "home_xg_diff_5"]) if "home_xg_diff_5" in features else None
        away_diff = _safe_float(features.loc[index, "away_xg_diff_5"]) if "away_xg_diff_5" in features else None
        if home_diff is not None and away_diff is not None:
            features.loc[index, "xg_differential"] = home_diff - away_diff

    @staticmethod
    def _apply_enhanced_odds(features: pd.DataFrame, enhanced: Mapping[str, Any], index: Any) -> None:
        home = _safe_float(enhanced.get("bf_home_back"))
        draw = _safe_float(enhanced.get("bf_draw_back"))
        away = _safe_float(enhanced.get("bf_away_back"))
        if any(value is None or value <= 1.0 for value in (home, draw, away)):
            return
        assert home is not None and draw is not None and away is not None
        raw = (1.0 / home, 1.0 / draw, 1.0 / away)
        total = sum(raw)
        if total <= 0:
            return
        features.loc[index, "home_implied_prob"] = raw[0] / total
        features.loc[index, "bookmaker_margin"] = _clamp(total - 1.0, 0.0, 0.3)

    def _validate_features(self, features: pd.DataFrame) -> pd.DataFrame:
        if features.empty or len(features) != 1:
            raise DataUnavailableError("feature_row")
        missing_columns = [name for name in self.expected_columns if name not in features.columns]
        if missing_columns:
            raise DataUnavailableError([f"features.{name}" for name in missing_columns])
        ordered = features.loc[:, self.expected_columns].copy()
        invalid = [
            name
            for name in self.expected_columns
            if _safe_float(ordered.iloc[0][name]) is None
        ]
        if invalid:
            raise DataUnavailableError([f"features.{name}" for name in invalid])
        return ordered.astype(float)

    def _scale_features(self, features: pd.DataFrame) -> pd.DataFrame:
        """Scale only batch training frames; single-row inference stays in model units."""
        validated = self._validate_features(features)
        if len(validated) <= 1:
            return validated
        result = validated.copy()
        result.loc[:, self.expected_columns] = self.scaler.fit_transform(result[self.expected_columns])
        return result
