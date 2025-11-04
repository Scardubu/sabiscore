import logging
from typing import Any, Dict

import numpy as np
import pandas as pd
from great_expectations.dataset import PandasDataset
from sklearn.preprocessing import StandardScaler


logger = logging.getLogger(__name__)


class FeatureTransformer:
    """Feature engineering pipeline with validation and leakage controls."""

    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.expected_columns = [
            "home_goals_avg",
            "away_goals_avg",
            "home_conceded_avg",
            "away_conceded_avg",
            "home_win_rate",
            "away_win_rate",
            "home_possession_avg",
            "away_possession_avg",
            "home_form_points",
            "away_form_points",
            "home_recent_goals",
            "away_recent_goals",
            "home_recent_conceded",
            "away_recent_conceded",
            "home_clean_sheets",
            "away_clean_sheets",
            "home_win_implied_prob",
            "draw_implied_prob",
            "away_win_implied_prob",
            "home_away_odds_ratio",
            "draw_no_draw_ratio",
            "home_implied_edge",
            "away_implied_edge",
            "home_injuries_count",
            "away_injuries_count",
            "h2h_home_wins",
            "h2h_away_wins",
            "h2h_draws",
            "home_average_age",
            "away_average_age",
            "home_squad_value_mean",
            "away_squad_value_mean",
            "home_squad_size",
            "away_squad_size",
            "home_defensive_strength",
            "away_defensive_strength",
            "home_attacking_strength",
            "away_attacking_strength",
            "home_home_advantage",
            "away_away_disadvantage",
            "league_position_diff",
            "head_to_head_last_5",
            "form_trend_home",
            "form_trend_away",
            "rest_days_home",
            "rest_days_away",
            "travel_distance",
            "weather_impact",
            "motivation_home",
            "motivation_away",
            "tactical_style_matchup",
        ]

    def engineer_features(self, match_data: Dict[str, Any]) -> pd.DataFrame:
        historical_stats = match_data.get("historical_stats", pd.DataFrame())
        current_form = match_data.get("current_form", {})
        odds = match_data.get("odds", {})
        injuries = match_data.get("injuries", pd.DataFrame())
        head_to_head = match_data.get("head_to_head", pd.DataFrame())
        team_stats = match_data.get("team_stats", {})

        base = self._create_base_features(historical_stats)
        base = self._add_form_features(base, current_form)
        base = self._add_odds_features(base, odds)
        base = self._add_injury_features(base, injuries)
        base = self._add_h2h_features(base, head_to_head)
        base = self._add_team_stats_features(base, team_stats)
        base = self._add_advanced_team_features(base, team_stats)
        base = self._add_form_trends(base, current_form)
        base = self._add_schedule_features(base, match_data)

        base = self._ensure_minimum_row(base)

        base = self._handle_missing_values(base)
        base = self._validate_features(base)

        return self._scale_features(base)

    # ------------------------------------------------------------------
    def _create_base_features(self, historical_stats: pd.DataFrame) -> pd.DataFrame:
        if historical_stats.empty:
            defaults = pd.DataFrame([{col: np.nan for col in self.expected_columns}])
            defaults["home_goals_avg"] = defaults["away_goals_avg"] = 1.5
            defaults["home_conceded_avg"] = defaults["away_conceded_avg"] = 1.3
            defaults["home_win_rate"] = defaults["away_win_rate"] = 0.45
            defaults["home_form_points"] = defaults["away_form_points"] = 7
            defaults["home_possession_avg"] = defaults["away_possession_avg"] = 50.0
            defaults["home_recent_goals"] = defaults["away_recent_goals"] = 7
            defaults["home_recent_conceded"] = defaults["away_recent_conceded"] = 6
            defaults["home_clean_sheets"] = defaults["away_clean_sheets"] = 1
            defaults["home_average_age"] = defaults["away_average_age"] = 26.5
            defaults["home_squad_value_mean"] = defaults["away_squad_value_mean"] = 25.0
            defaults["home_squad_size"] = defaults["away_squad_size"] = 24
            defaults["home_defensive_strength"] = defaults["away_defensive_strength"] = 1.5
            defaults["home_attacking_strength"] = defaults["away_attacking_strength"] = 1.8
            defaults["league_position_diff"] = 0
            defaults["form_trend_home"] = defaults["form_trend_away"] = 0.0
            defaults["rest_days_home"] = defaults["rest_days_away"] = 5
            defaults["travel_distance"] = 120.0
            defaults["weather_impact"] = 0.2
            defaults["motivation_home"] = defaults["motivation_away"] = 0.6
            defaults["tactical_style_matchup"] = 0.0
            return defaults

        agg = pd.DataFrame(
            {
                "home_goals_avg": [historical_stats["home_score"].mean()],
                "away_goals_avg": [historical_stats["away_score"].mean()],
                "home_conceded_avg": [historical_stats["away_score"].mean()],
                "away_conceded_avg": [historical_stats["home_score"].mean()],
                "home_win_rate": [
                    (historical_stats["home_score"] > historical_stats["away_score"]).mean()
                ],
                "away_win_rate": [
                    (historical_stats["away_score"] > historical_stats["home_score"]).mean()
                ],
                "home_possession_avg": [historical_stats.get("home_possession", pd.Series(dtype=float)).mean()],
                "away_possession_avg": [historical_stats.get("away_possession", pd.Series(dtype=float)).mean()],
            }
        )
        return agg

    def _add_form_features(self, features: pd.DataFrame, current_form: Dict[str, Any]) -> pd.DataFrame:
        for side in ("home", "away"):
            form = current_form.get(side, {})
            results = form.get("last_5_games", [])
            features[f"{side}_form_points"] = sum(3 if r == "W" else 1 if r == "D" else 0 for r in results)
            features[f"{side}_recent_goals"] = form.get("goals_scored", 0)
            features[f"{side}_recent_conceded"] = form.get("goals_conceded", 0)
            features[f"{side}_clean_sheets"] = form.get("clean_sheets", 0)
        return features

    def _add_odds_features(self, features: pd.DataFrame, odds: Dict[str, float]) -> pd.DataFrame:
        home = float(odds.get("home_win", 2.5))
        draw = float(odds.get("draw", 3.2))
        away = float(odds.get("away_win", 2.8))

        # Ensure odds are valid (> 1.0 to avoid division by zero)
        home = max(home, 1.01)
        draw = max(draw, 1.01)
        away = max(away, 1.01)

        prob_sum = sum(1 / odd for odd in (home, draw, away))
        if prob_sum > 0:  # Prevent division by zero
            features["home_win_implied_prob"] = (1 / home) / prob_sum
            features["draw_implied_prob"] = (1 / draw) / prob_sum
            features["away_win_implied_prob"] = (1 / away) / prob_sum
        else:
            # Fallback values
            features["home_win_implied_prob"] = 0.4
            features["draw_implied_prob"] = 0.25
            features["away_win_implied_prob"] = 0.35

        features["home_away_odds_ratio"] = home / away if away > 0 else 1.0
        features["draw_no_draw_ratio"] = draw / ((home + away) / 2) if (home + away) > 0 else 1.0
        return features

    def _add_injury_features(self, features: pd.DataFrame, injuries: pd.DataFrame) -> pd.DataFrame:
        if injuries.empty:
            features["home_injuries_count"] = 0
            features["away_injuries_count"] = 0
            return features

        counts = injuries.groupby("team").size()
        home_count = int(counts.get(features.get("home_team", np.nan), 0)) if "home_team" in injuries.columns else 0
        away_count = int(counts.get(features.get("away_team", np.nan), 0)) if "away_team" in injuries.columns else 0
        features["home_injuries_count"] = home_count
        features["away_injuries_count"] = away_count
        return features

    def _add_h2h_features(self, features: pd.DataFrame, head_to_head: pd.DataFrame) -> pd.DataFrame:
        if head_to_head.empty:
            features["h2h_home_wins"] = 0.33
            features["h2h_away_wins"] = 0.33
            features["h2h_draws"] = 0.34
            return features

        total = len(head_to_head)
        features["h2h_home_wins"] = (
            (head_to_head["home_score"] > head_to_head["away_score"]).sum() / total
        )
        features["h2h_away_wins"] = (
            (head_to_head["away_score"] > head_to_head["home_score"]).sum() / total
        )
        features["h2h_draws"] = (
            (head_to_head["home_score"] == head_to_head["away_score"]).sum() / total
        )
        return features

    def _add_team_stats_features(self, features: pd.DataFrame, team_stats: Dict[str, Any]) -> pd.DataFrame:
        for side in ("home", "away"):
            stats = team_stats.get(side, {})
            features[f"{side}_average_age"] = stats.get("average_age") or 26.5
            features[f"{side}_squad_value_mean"] = stats.get("squad_value_mean") or 20.0
            features[f"{side}_squad_size"] = stats.get("squad_size") or 18
        return features

    def _add_advanced_team_features(self, features: pd.DataFrame, team_stats: Dict[str, Any]) -> pd.DataFrame:
        home_stats = team_stats.get("home", {})
        away_stats = team_stats.get("away", {})

        features["home_defensive_strength"] = home_stats.get("defensive_strength", 1.5)
        features["away_defensive_strength"] = away_stats.get("defensive_strength", 1.5)
        features["home_attacking_strength"] = home_stats.get("attacking_strength", 1.8)
        features["away_attacking_strength"] = away_stats.get("attacking_strength", 1.6)
        features["home_home_advantage"] = home_stats.get("home_advantage", 0.2)
        features["away_away_disadvantage"] = away_stats.get("away_disadvantage", 0.2)
        features["league_position_diff"] = home_stats.get("league_position", 8) - away_stats.get("league_position", 10)
        features["head_to_head_last_5"] = home_stats.get("head_to_head_last_5", 0.5)
        return features

    def _add_form_trends(self, features: pd.DataFrame, current_form: Dict[str, Any]) -> pd.DataFrame:
        home_form = current_form.get("home", {})
        away_form = current_form.get("away", {})

        features["form_trend_home"] = home_form.get("trend", 0.0)
        features["form_trend_away"] = away_form.get("trend", 0.0)
        features["rest_days_home"] = home_form.get("rest_days", 5)
        features["rest_days_away"] = away_form.get("rest_days", 5)
        features["travel_distance"] = home_form.get("travel_distance", 50.0)
        features["weather_impact"] = home_form.get("weather_impact", 0.5)
        features["motivation_home"] = home_form.get("motivation", 0.6)
        features["motivation_away"] = away_form.get("motivation", 0.6)
        features["tactical_style_matchup"] = home_form.get("tactical_style_matchup", 0.0)
        return features

    def _add_schedule_features(self, features: pd.DataFrame, match_data: Dict[str, Any]) -> pd.DataFrame:
        schedule = match_data.get("schedule", {})
        features["head_to_head_last_5"] = features.get("head_to_head_last_5", schedule.get("head_to_head_last_5", 0.5))
        return features

    def _handle_missing_values(self, features: pd.DataFrame) -> pd.DataFrame:
        if features.empty:
            return features
        # Fill NaN values with column means, but if mean is NaN, use 0
        for col in features.columns:
            if features[col].isnull().any():
                mean_val = features[col].mean()
                if pd.isna(mean_val):
                    features[col] = features[col].fillna(0.0)
                else:
                    features[col] = features[col].fillna(mean_val)
        return features

    def _scale_features(self, features: pd.DataFrame) -> pd.DataFrame:
        if features.empty:
            return features
        num_cols = features.select_dtypes(include=[np.number]).columns
        if num_cols.any():
            features[num_cols] = self.scaler.fit_transform(features[num_cols])
        return features

    def _validate_features(self, features: pd.DataFrame) -> pd.DataFrame:
        for column in self.expected_columns:
            if column not in features.columns:
                features[column] = 0.0

        ordered = features[self.expected_columns].copy()
        dataset = PandasDataset(ordered.copy())
        dataset.expect_table_row_count_to_equal(1)
        for column in self.expected_columns:
            dataset.expect_column_values_to_not_be_null(column)

        result = dataset.validate()
        if not result.success:
            logger.warning("Feature validation issues: %s", result)

        return ordered

    def _ensure_minimum_row(self, features: pd.DataFrame) -> pd.DataFrame:
        if not features.empty:
            return features
        defaults = {column: 0.0 for column in self.expected_columns}
        return pd.DataFrame([defaults])
