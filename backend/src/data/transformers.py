import logging
from typing import Any, Dict

import numpy as np
import pandas as pd
from great_expectations.dataset import PandasDataset
from sklearn.preprocessing import StandardScaler


logger = logging.getLogger(__name__)


# The 86 features expected by the trained ensemble model
# These must match exactly what the model was trained on
MODEL_EXPECTED_FEATURES = [
    'home_form_5', 'home_form_10', 'home_form_20', 'home_win_rate_5', 'home_goals_per_match_5',
    'away_form_5', 'away_form_10', 'away_form_20', 'away_win_rate_5', 'away_goals_per_match_5',
    'home_xg_avg_5', 'home_xg_conceded_avg_5', 'home_xg_diff_5', 'home_xg_overperformance', 'home_xg_consistency',
    'away_xg_avg_5', 'away_xg_conceded_avg_5', 'away_xg_diff_5', 'away_xg_overperformance', 'away_xg_consistency',
    'xg_differential',
    'home_days_rest', 'home_fatigue_index', 'home_fixtures_14d', 'home_fixture_congestion',
    'away_days_rest', 'away_fatigue_index', 'away_fixtures_14d', 'away_fixture_congestion',
    'home_advantage_win_rate', 'home_goals_advantage', 'away_win_rate_away', 'home_crowd_boost',
    'home_advantage_coefficient', 'referee_home_bias',
    'home_momentum_lambda', 'home_momentum_weighted', 'home_win_streak', 'home_unbeaten_streak',
    'away_momentum_lambda', 'away_momentum_weighted', 'away_win_streak', 'away_unbeaten_streak',
    'odds_volatility_1h', 'market_panic_score', 'odds_drift_home', 'bookmaker_margin', 'home_implied_prob',
    'h2h_home_wins', 'h2h_draws', 'h2h_away_wins', 'h2h_total_matches', 'h2h_avg_goals', 'h2h_home_win_rate',
    'home_squad_value', 'home_missing_value', 'away_squad_value', 'away_missing_value', 'squad_value_diff',
    'temperature', 'precipitation', 'wind_speed', 'weather_impact_score',
    'home_elo', 'away_elo', 'elo_difference',
    'home_possession_style', 'away_possession_style', 'home_pressing_intensity', 'away_pressing_intensity',
    'home_first_half_goals_rate', 'away_first_half_goals_rate',
    'home_defensive_solidity', 'away_defensive_solidity',
    'home_setpiece_goals_rate', 'away_setpiece_goals_rate',
    'home_goals_conceded_per_match_5', 'home_gd_avg_5', 'home_gd_trend', 'home_clean_sheets_5', 'home_scoring_consistency',
    'away_goals_conceded_per_match_5', 'away_gd_avg_5', 'away_gd_trend', 'away_clean_sheets_5', 'away_scoring_consistency',
]

# Default values for features when real data is unavailable
# Based on EPL league averages from training data
FEATURE_DEFAULTS = {
    # Form features
    'home_form_5': 0.55, 'home_form_10': 0.54, 'home_form_20': 0.53,
    'home_win_rate_5': 0.50, 'home_goals_per_match_5': 1.55,
    'away_form_5': 0.45, 'away_form_10': 0.44, 'away_form_20': 0.43,
    'away_win_rate_5': 0.40, 'away_goals_per_match_5': 1.25,
    # xG features
    'home_xg_avg_5': 1.55, 'home_xg_conceded_avg_5': 1.30, 'home_xg_diff_5': 0.25,
    'home_xg_overperformance': 0.05, 'home_xg_consistency': 0.75,
    'away_xg_avg_5': 1.35, 'away_xg_conceded_avg_5': 1.50, 'away_xg_diff_5': -0.15,
    'away_xg_overperformance': -0.05, 'away_xg_consistency': 0.70,
    'xg_differential': 0.20,
    # Rest & fatigue
    'home_days_rest': 7.0, 'home_fatigue_index': 0.30, 'home_fixtures_14d': 2.0, 'home_fixture_congestion': 0.35,
    'away_days_rest': 7.0, 'away_fatigue_index': 0.35, 'away_fixtures_14d': 2.0, 'away_fixture_congestion': 0.35,
    # Home advantage
    'home_advantage_win_rate': 0.55, 'home_goals_advantage': 0.30, 'away_win_rate_away': 0.35,
    'home_crowd_boost': 0.10, 'home_advantage_coefficient': 1.15, 'referee_home_bias': 0.52,
    # Momentum
    'home_momentum_lambda': 0.55, 'home_momentum_weighted': 0.55, 'home_win_streak': 1.5, 'home_unbeaten_streak': 3.0,
    'away_momentum_lambda': 0.45, 'away_momentum_weighted': 0.45, 'away_win_streak': 1.0, 'away_unbeaten_streak': 2.5,
    # Odds/market
    'odds_volatility_1h': 0.02, 'market_panic_score': 0.15, 'odds_drift_home': 0.0,
    'bookmaker_margin': 0.05, 'home_implied_prob': 0.45,
    # H2H
    'h2h_home_wins': 4.0, 'h2h_draws': 3.0, 'h2h_away_wins': 3.0,
    'h2h_total_matches': 10.0, 'h2h_avg_goals': 2.5, 'h2h_home_win_rate': 0.40,
    # Squad
    'home_squad_value': 400.0, 'home_missing_value': 20.0,
    'away_squad_value': 350.0, 'away_missing_value': 15.0,
    'squad_value_diff': 50.0,
    # Weather
    'temperature': 15.0, 'precipitation': 2.0, 'wind_speed': 12.0, 'weather_impact_score': 0.1,
    # Elo
    'home_elo': 1550.0, 'away_elo': 1500.0, 'elo_difference': 50.0,
    # Tactical
    'home_possession_style': 0.52, 'away_possession_style': 0.48,
    'home_pressing_intensity': 0.55, 'away_pressing_intensity': 0.50,
    'home_first_half_goals_rate': 0.45, 'away_first_half_goals_rate': 0.42,
    'home_defensive_solidity': 0.65, 'away_defensive_solidity': 0.60,
    'home_setpiece_goals_rate': 0.25, 'away_setpiece_goals_rate': 0.22,
    # Goals/GD
    'home_goals_conceded_per_match_5': 1.20, 'home_gd_avg_5': 0.35, 'home_gd_trend': 0.05,
    'home_clean_sheets_5': 0.30, 'home_scoring_consistency': 0.70,
    'away_goals_conceded_per_match_5': 1.40, 'away_gd_avg_5': -0.15, 'away_gd_trend': -0.02,
    'away_clean_sheets_5': 0.25, 'away_scoring_consistency': 0.65,
}


class FeatureTransformer:
    """Feature engineering pipeline with validation and leakage controls.
    
    Produces 86 features aligned with the trained ensemble model.
    """

    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.expected_columns = MODEL_EXPECTED_FEATURES

    def engineer_features(self, match_data: Dict[str, Any]) -> pd.DataFrame:
        # Handle None values by converting to empty DataFrame/dict
        historical_stats = match_data.get("historical_stats")
        if historical_stats is None or (isinstance(historical_stats, pd.DataFrame) and historical_stats.empty):
            historical_stats = pd.DataFrame()
        
        current_form = match_data.get("current_form") or {}
        odds = match_data.get("odds") or {}
        
        injuries = match_data.get("injuries")
        if injuries is None or (isinstance(injuries, pd.DataFrame) and injuries.empty):
            injuries = pd.DataFrame()
            
        head_to_head = match_data.get("head_to_head")
        if head_to_head is None or (isinstance(head_to_head, pd.DataFrame) and head_to_head.empty):
            head_to_head = pd.DataFrame()
            
        team_stats = match_data.get("team_stats") or {}

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
        # Start with defaults
        features = pd.DataFrame([FEATURE_DEFAULTS]).copy()
        
        if historical_stats is None or (isinstance(historical_stats, pd.DataFrame) and historical_stats.empty):
            return features

        # Update with calculated values where possible
        try:
            # Assuming historical_stats contains recent matches relevant to the teams
            # We'll use the last 5 matches for the "_5" features
            last_5 = historical_stats.tail(5)
            
            if not last_5.empty:
                features["home_goals_per_match_5"] = last_5["home_score"].mean()
                features["away_goals_per_match_5"] = last_5["away_score"].mean()
                features["home_goals_conceded_per_match_5"] = last_5["away_score"].mean()
                features["away_goals_conceded_per_match_5"] = last_5["home_score"].mean()
                
                # Simple win rate calculation based on score comparison
                home_wins = (last_5["home_score"] > last_5["away_score"]).mean()
                away_wins = (last_5["away_score"] > last_5["home_score"]).mean()
                features["home_win_rate_5"] = home_wins
                features["away_win_rate_5"] = away_wins
                
                # GD stats
                features["home_gd_avg_5"] = (last_5["home_score"] - last_5["away_score"]).mean()
                features["away_gd_avg_5"] = (last_5["away_score"] - last_5["home_score"]).mean()
                
                # Clean sheets
                features["home_clean_sheets_5"] = (last_5["away_score"] == 0).mean()
                features["away_clean_sheets_5"] = (last_5["home_score"] == 0).mean()

        except Exception as e:
            logger.warning(f"Error calculating base features: {e}")
            
        return features

    def _add_form_features(self, features: pd.DataFrame, current_form: Dict[str, Any]) -> pd.DataFrame:
        for side in ("home", "away"):
            form = current_form.get(side, {})
            # Form points from last 5 games (W=3, D=1, L=0)
            results = form.get("last_5_games", [])
            points = sum(3 if r == "W" else 1 if r == "D" else 0 for r in results)
            
            # Normalize form to 0-1 range (max 15 points)
            features[f"{side}_form_5"] = points / 15.0 if results else FEATURE_DEFAULTS[f"{side}_form_5"]
            
            # For 10 and 20 game form, we might not have data, so use defaults or estimate
            # If we have 'form_10' in input, use it, otherwise estimate from form_5
            features[f"{side}_form_10"] = form.get("form_10", features[f"{side}_form_5"])
            features[f"{side}_form_20"] = form.get("form_20", features[f"{side}_form_10"])
            
            # Streaks
            features[f"{side}_win_streak"] = form.get("win_streak", FEATURE_DEFAULTS[f"{side}_win_streak"])
            features[f"{side}_unbeaten_streak"] = form.get("unbeaten_streak", FEATURE_DEFAULTS[f"{side}_unbeaten_streak"])
            
        return features

    def _add_odds_features(self, features: pd.DataFrame, odds: Dict[str, float]) -> pd.DataFrame:
        home = float(odds.get("home_win", 2.5))
        draw = float(odds.get("draw", 3.2))
        away = float(odds.get("away_win", 2.8))

        # Ensure odds are valid (> 1.0 to avoid division by zero)
        home = max(home, 1.01)
        draw = max(draw, 1.01)
        away = max(away, 1.01)

        # Calculate implied probabilities
        ip_home = 1 / home
        ip_draw = 1 / draw
        ip_away = 1 / away
        
        margin = ip_home + ip_draw + ip_away - 1
        
        # Normalize probabilities to sum to 1
        prob_sum = ip_home + ip_draw + ip_away
        features["home_implied_prob"] = ip_home / prob_sum
        features["bookmaker_margin"] = margin
        
        # Market features (use defaults if not provided)
        features["odds_volatility_1h"] = odds.get("volatility_1h", FEATURE_DEFAULTS["odds_volatility_1h"])
        features["market_panic_score"] = odds.get("panic_score", FEATURE_DEFAULTS["market_panic_score"])
        features["odds_drift_home"] = odds.get("drift_home", FEATURE_DEFAULTS["odds_drift_home"])

        return features

    def _add_injury_features(self, features: pd.DataFrame, injuries: pd.DataFrame) -> pd.DataFrame:
        # Not in expected features list explicitly, but might be used for 'missing_value' calculation
        # We'll keep it simple and just return features as is for now, 
        # assuming missing_value is handled in team_stats
        return features

    def _add_h2h_features(self, features: pd.DataFrame, head_to_head: pd.DataFrame) -> pd.DataFrame:
        if head_to_head.empty:
            # Use defaults
            features["h2h_home_wins"] = FEATURE_DEFAULTS["h2h_home_wins"]
            features["h2h_away_wins"] = FEATURE_DEFAULTS["h2h_away_wins"]
            features["h2h_draws"] = FEATURE_DEFAULTS["h2h_draws"]
            features["h2h_total_matches"] = FEATURE_DEFAULTS["h2h_total_matches"]
            features["h2h_avg_goals"] = FEATURE_DEFAULTS["h2h_avg_goals"]
            features["h2h_home_win_rate"] = FEATURE_DEFAULTS["h2h_home_win_rate"]
            return features

        total = len(head_to_head)
        home_wins = (head_to_head["home_score"] > head_to_head["away_score"]).sum()
        away_wins = (head_to_head["away_score"] > head_to_head["home_score"]).sum()
        draws = (head_to_head["home_score"] == head_to_head["away_score"]).sum()
        
        features["h2h_home_wins"] = home_wins
        features["h2h_away_wins"] = away_wins
        features["h2h_draws"] = draws
        features["h2h_total_matches"] = total
        features["h2h_avg_goals"] = (head_to_head["home_score"] + head_to_head["away_score"]).mean()
        features["h2h_home_win_rate"] = home_wins / total if total > 0 else 0.0
        
        return features

    def _add_team_stats_features(self, features: pd.DataFrame, team_stats: Dict[str, Any]) -> pd.DataFrame:
        home_stats = team_stats.get("home", {})
        away_stats = team_stats.get("away", {})
        
        # Squad value features
        features["home_squad_value"] = home_stats.get("squad_value", FEATURE_DEFAULTS["home_squad_value"])
        features["away_squad_value"] = away_stats.get("squad_value", FEATURE_DEFAULTS["away_squad_value"])
        features["home_missing_value"] = home_stats.get("missing_value", FEATURE_DEFAULTS["home_missing_value"])
        features["away_missing_value"] = away_stats.get("missing_value", FEATURE_DEFAULTS["away_missing_value"])
        features["squad_value_diff"] = features["home_squad_value"] - features["away_squad_value"]
        
        # Elo features
        features["home_elo"] = home_stats.get("elo", FEATURE_DEFAULTS["home_elo"])
        features["away_elo"] = away_stats.get("elo", FEATURE_DEFAULTS["away_elo"])
        features["elo_difference"] = features["home_elo"] - features["away_elo"]
        
        return features

    def _add_advanced_team_features(self, features: pd.DataFrame, team_stats: Dict[str, Any]) -> pd.DataFrame:
        home_stats = team_stats.get("home", {})
        away_stats = team_stats.get("away", {})

        # xG features
        for side, stats in [("home", home_stats), ("away", away_stats)]:
            features[f"{side}_xg_avg_5"] = stats.get("xg_avg_5", FEATURE_DEFAULTS[f"{side}_xg_avg_5"])
            features[f"{side}_xg_conceded_avg_5"] = stats.get("xg_conceded_avg_5", FEATURE_DEFAULTS[f"{side}_xg_conceded_avg_5"])
            features[f"{side}_xg_diff_5"] = stats.get("xg_diff_5", FEATURE_DEFAULTS[f"{side}_xg_diff_5"])
            features[f"{side}_xg_overperformance"] = stats.get("xg_overperformance", FEATURE_DEFAULTS[f"{side}_xg_overperformance"])
            features[f"{side}_xg_consistency"] = stats.get("xg_consistency", FEATURE_DEFAULTS[f"{side}_xg_consistency"])
            
        features["xg_differential"] = features["home_xg_diff_5"] - features["away_xg_diff_5"]

        # Tactical features
        for side, stats in [("home", home_stats), ("away", away_stats)]:
            features[f"{side}_possession_style"] = stats.get("possession_style", FEATURE_DEFAULTS[f"{side}_possession_style"])
            features[f"{side}_pressing_intensity"] = stats.get("pressing_intensity", FEATURE_DEFAULTS[f"{side}_pressing_intensity"])
            features[f"{side}_first_half_goals_rate"] = stats.get("first_half_goals_rate", FEATURE_DEFAULTS[f"{side}_first_half_goals_rate"])
            features[f"{side}_defensive_solidity"] = stats.get("defensive_solidity", FEATURE_DEFAULTS[f"{side}_defensive_solidity"])
            features[f"{side}_setpiece_goals_rate"] = stats.get("setpiece_goals_rate", FEATURE_DEFAULTS[f"{side}_setpiece_goals_rate"])
            
            # GD trends
            features[f"{side}_gd_trend"] = stats.get("gd_trend", FEATURE_DEFAULTS[f"{side}_gd_trend"])
            features[f"{side}_scoring_consistency"] = stats.get("scoring_consistency", FEATURE_DEFAULTS[f"{side}_scoring_consistency"])

        return features

    def _add_form_trends(self, features: pd.DataFrame, current_form: Dict[str, Any]) -> pd.DataFrame:
        home_form = current_form.get("home", {})
        away_form = current_form.get("away", {})

        # Momentum features
        features["home_momentum_lambda"] = home_form.get("momentum_lambda", FEATURE_DEFAULTS["home_momentum_lambda"])
        features["home_momentum_weighted"] = home_form.get("momentum_weighted", FEATURE_DEFAULTS["home_momentum_weighted"])
        features["away_momentum_lambda"] = away_form.get("momentum_lambda", FEATURE_DEFAULTS["away_momentum_lambda"])
        features["away_momentum_weighted"] = away_form.get("momentum_weighted", FEATURE_DEFAULTS["away_momentum_weighted"])

        # Fatigue features
        features["home_days_rest"] = home_form.get("days_rest", FEATURE_DEFAULTS["home_days_rest"])
        features["home_fatigue_index"] = home_form.get("fatigue_index", FEATURE_DEFAULTS["home_fatigue_index"])
        features["home_fixtures_14d"] = home_form.get("fixtures_14d", FEATURE_DEFAULTS["home_fixtures_14d"])
        features["home_fixture_congestion"] = home_form.get("fixture_congestion", FEATURE_DEFAULTS["home_fixture_congestion"])
        
        features["away_days_rest"] = away_form.get("days_rest", FEATURE_DEFAULTS["away_days_rest"])
        features["away_fatigue_index"] = away_form.get("fatigue_index", FEATURE_DEFAULTS["away_fatigue_index"])
        features["away_fixtures_14d"] = away_form.get("fixtures_14d", FEATURE_DEFAULTS["away_fixtures_14d"])
        features["away_fixture_congestion"] = away_form.get("fixture_congestion", FEATURE_DEFAULTS["away_fixture_congestion"])

        return features

    def _add_schedule_features(self, features: pd.DataFrame, match_data: Dict[str, Any]) -> pd.DataFrame:
        schedule = match_data.get("schedule", {})
        
        # Weather features
        weather = schedule.get("weather", {})
        features["temperature"] = weather.get("temperature", FEATURE_DEFAULTS["temperature"])
        features["precipitation"] = weather.get("precipitation", FEATURE_DEFAULTS["precipitation"])
        features["wind_speed"] = weather.get("wind_speed", FEATURE_DEFAULTS["wind_speed"])
        features["weather_impact_score"] = weather.get("impact_score", FEATURE_DEFAULTS["weather_impact_score"])
        
        # Home advantage features
        features["home_advantage_win_rate"] = schedule.get("home_advantage_win_rate", FEATURE_DEFAULTS["home_advantage_win_rate"])
        features["home_goals_advantage"] = schedule.get("home_goals_advantage", FEATURE_DEFAULTS["home_goals_advantage"])
        features["away_win_rate_away"] = schedule.get("away_win_rate_away", FEATURE_DEFAULTS["away_win_rate_away"])
        features["home_crowd_boost"] = schedule.get("home_crowd_boost", FEATURE_DEFAULTS["home_crowd_boost"])
        features["home_advantage_coefficient"] = schedule.get("home_advantage_coefficient", FEATURE_DEFAULTS["home_advantage_coefficient"])
        features["referee_home_bias"] = schedule.get("referee_home_bias", FEATURE_DEFAULTS["referee_home_bias"])
        
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
