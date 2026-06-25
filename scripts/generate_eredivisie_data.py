#!/usr/bin/env python3
"""
scripts/generate_eredivisie_data.py

Generate synthetic Eredivisie training data for the Optuna tuner (P5-A).

Eredivisie statistical profile (source: historical averages, 2018-2024):
  home_rate = 0.45   draw_rate = 0.240   away_rate = 0.31
  avg_goals = 3.00   home_gpg = 1.85     away_gpg = 1.15
  home_win_rate_5 ≈ 0.45   away_win_rate_5 ≈ 0.31

The synthetic rows mirror the exact column schema of epl_training.csv so
that _project_row_to_canonical() in optuna_tune_ensemble.py can consume them.
"""

import uuid
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
N_ROWS = 306          # Matches Bundesliga / Ligue 1 sample size
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "eredivisie_training.csv"

# Eredivisie outcome rates
HOME_RATE = 0.45
DRAW_RATE = 0.24
AWAY_RATE = 0.31

# Goals per game
HOME_GPG = 1.85
AWAY_GPG = 1.15

# Season span for synthetic match dates (3 seasons)
DATE_START = datetime(2021, 8, 6)
DATE_END   = datetime(2024, 5, 25)


def _clip(arr: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return np.clip(arr, lo, hi)


def generate(seed: int = SEED, n: int = N_ROWS) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # ── match dates spread across 3 seasons ──────────────────────────────────
    days_span = (DATE_END - DATE_START).days
    offsets = np.sort(rng.integers(0, days_span, size=n))
    match_dates = [DATE_START + timedelta(days=int(d)) for d in offsets]

    # ── outcome labels  0=home 1=draw 2=away ─────────────────────────────────
    result = rng.choice([0, 1, 2], size=n, p=[HOME_RATE, DRAW_RATE, AWAY_RATE])

    # ── form / win-rate features (correlated with outcome) ───────────────────
    # home_win_rate_5 is higher when result==0, lower when result==2
    home_wr_base = np.where(result == 0, 0.55, np.where(result == 2, 0.30, 0.42))
    away_wr_base = np.where(result == 2, 0.48, np.where(result == 0, 0.25, 0.35))

    home_win_rate_5  = _clip(home_wr_base + rng.normal(0, 0.12, n), 0.0, 1.0)
    away_win_rate_5  = _clip(away_wr_base + rng.normal(0, 0.12, n), 0.0, 1.0)
    home_form_5      = _clip(home_win_rate_5 + rng.normal(0, 0.05, n), 0.0, 1.0)
    away_form_5      = _clip(away_win_rate_5 + rng.normal(0, 0.05, n), 0.0, 1.0)
    home_form_10     = _clip(home_form_5 * 0.9 + rng.normal(0, 0.04, n), 0.0, 1.0)
    away_form_10     = _clip(away_form_5 * 0.9 + rng.normal(0, 0.04, n), 0.0, 1.0)
    home_form_20     = _clip(home_form_10 * 0.95 + rng.normal(0, 0.03, n), 0.0, 1.0)
    away_form_20     = _clip(away_form_10 * 0.95 + rng.normal(0, 0.03, n), 0.0, 1.0)

    # ── goals per match (Eredivisie high-scoring profile) ────────────────────
    home_gpg_base = np.where(result == 0, HOME_GPG + 0.25, np.where(result == 2, HOME_GPG - 0.30, HOME_GPG))
    away_gpg_base = np.where(result == 2, AWAY_GPG + 0.25, np.where(result == 0, AWAY_GPG - 0.25, AWAY_GPG))

    home_goals_per_match_5 = _clip(home_gpg_base + rng.normal(0, 0.35, n), 0.2, 4.0)
    away_goals_per_match_5 = _clip(away_gpg_base + rng.normal(0, 0.30, n), 0.2, 3.5)
    home_goals_conceded    = _clip(AWAY_GPG + rng.normal(0, 0.30, n), 0.2, 3.5)
    away_goals_conceded    = _clip(HOME_GPG + rng.normal(0, 0.35, n), 0.2, 4.0)

    # ── xG features ──────────────────────────────────────────────────────────
    home_xg_avg_5          = _clip(home_goals_per_match_5 * 0.95 + rng.normal(0, 0.1, n), 0.1, 3.5)
    away_xg_avg_5          = _clip(away_goals_per_match_5 * 0.95 + rng.normal(0, 0.1, n), 0.1, 3.0)
    home_xg_conceded_avg_5 = _clip(home_goals_conceded * 0.95 + rng.normal(0, 0.1, n), 0.1, 3.5)
    away_xg_conceded_avg_5 = _clip(away_goals_conceded * 0.95 + rng.normal(0, 0.1, n), 0.1, 3.5)
    home_xg_diff_5         = home_xg_avg_5 - home_xg_conceded_avg_5
    away_xg_diff_5         = away_xg_avg_5 - away_xg_conceded_avg_5
    xg_differential        = home_xg_diff_5 - away_xg_diff_5
    home_xg_overperf       = _clip(rng.normal(0.02, 0.08, n), -0.5, 0.5)
    away_xg_overperf       = _clip(rng.normal(0.02, 0.08, n), -0.5, 0.5)
    home_xg_consistency    = _clip(rng.uniform(0.5, 1.0, n), 0.3, 1.0)
    away_xg_consistency    = _clip(rng.uniform(0.5, 1.0, n), 0.3, 1.0)

    # ── schedule / fatigue ────────────────────────────────────────────────────
    home_days_rest        = rng.integers(3, 10, size=n).astype(float)
    away_days_rest        = rng.integers(3, 10, size=n).astype(float)
    home_fixtures_14d     = rng.integers(1, 4, size=n).astype(float)
    away_fixtures_14d     = rng.integers(1, 4, size=n).astype(float)
    home_fatigue_index    = _clip((4.0 - home_days_rest) / 4.0 + rng.normal(0, 0.05, n), 0.0, 1.0)
    away_fatigue_index    = _clip((4.0 - away_days_rest) / 4.0 + rng.normal(0, 0.05, n), 0.0, 1.0)
    home_fixture_congest  = home_fixtures_14d / 4.0
    away_fixture_congest  = away_fixtures_14d / 4.0

    # ── venue / home advantage (Eredivisie: strong home, ~45%) ────────────────
    home_advantage_wr     = _clip(0.45 + rng.normal(0, 0.10, n), 0.20, 0.75)
    away_win_rate_away    = _clip(0.31 + rng.normal(0, 0.10, n), 0.10, 0.60)
    home_goals_advantage  = _clip(home_goals_per_match_5 - away_goals_per_match_5, -2.0, 3.0)
    home_crowd_boost      = _clip(rng.normal(0.10, 0.04, n), 0.0, 0.25)
    home_advantage_coef   = _clip(0.45 + rng.normal(0, 0.08, n), 0.15, 0.80)
    referee_home_bias     = _clip(rng.normal(0.05, 0.02, n), 0.0, 0.15)

    # ── momentum ─────────────────────────────────────────────────────────────
    home_momentum_lambda  = _clip(home_form_5 + rng.normal(0, 0.05, n), 0.0, 1.0)
    away_momentum_lambda  = _clip(away_form_5 + rng.normal(0, 0.05, n), 0.0, 1.0)
    home_momentum_wt      = home_momentum_lambda
    away_momentum_wt      = away_momentum_lambda
    home_win_streak       = rng.integers(0, 6, size=n).astype(float)
    away_win_streak       = rng.integers(0, 5, size=n).astype(float)
    home_unbeaten_streak  = home_win_streak + rng.integers(0, 3, size=n).astype(float)
    away_unbeaten_streak  = away_win_streak + rng.integers(0, 3, size=n).astype(float)

    # ── market / odds (correlated with form → home_implied_prob) ─────────────
    home_implied_base = np.where(result == 0, 0.52, np.where(result == 2, 0.32, 0.40))
    home_implied_prob = _clip(home_implied_base + rng.normal(0, 0.10, n), 0.08, 0.88)
    bookmaker_margin  = _clip(rng.normal(0.05, 0.01, n), 0.02, 0.12)
    odds_volatility   = _clip(rng.exponential(0.02, n), 0.0, 0.15)
    market_panic      = _clip(rng.exponential(0.01, n), 0.0, 0.10)
    odds_drift_home   = _clip(rng.normal(0.0, 0.03, n), -0.15, 0.15)

    # ── H2H ──────────────────────────────────────────────────────────────────
    h2h_total = rng.integers(3, 12, size=n).astype(float)
    h2h_home_wins = _clip(h2h_total * home_win_rate_5 * 0.9 + rng.normal(0, 0.5, n), 0.0, h2h_total)
    h2h_away_wins = _clip(h2h_total * away_win_rate_5 * 0.9 + rng.normal(0, 0.5, n), 0.0, h2h_total - h2h_home_wins)
    h2h_draws     = _clip(h2h_total - h2h_home_wins - h2h_away_wins, 0.0, h2h_total)
    h2h_home_wr   = h2h_home_wins / np.maximum(h2h_total, 1.0)
    h2h_avg_goals = _clip(rng.normal(3.0, 0.6, n), 1.5, 5.5)  # Eredivisie high-scoring H2H

    # ── squad values ─────────────────────────────────────────────────────────
    home_squad_val = _clip(rng.lognormal(4.8, 0.5, n), 50.0, 500.0)   # €M, lower than Big 5
    away_squad_val = _clip(rng.lognormal(4.8, 0.5, n), 50.0, 500.0)
    home_miss_val  = _clip(rng.exponential(8.0, n), 0.0, 60.0)
    away_miss_val  = _clip(rng.exponential(8.0, n), 0.0, 60.0)
    squad_val_diff = home_squad_val - away_squad_val

    # ── weather (Dutch: moderate/wet) ─────────────────────────────────────────
    temperature    = _clip(rng.normal(11.0, 7.0, n), -5.0, 30.0)
    precipitation  = _clip(rng.exponential(2.5, n), 0.0, 15.0)
    wind_speed     = _clip(rng.exponential(12.0, n), 0.0, 50.0)
    weather_impact = _clip((precipitation * 0.05 + wind_speed * 0.01), 0.0, 1.0)

    # ── ELO ──────────────────────────────────────────────────────────────────
    home_elo_base = np.where(result == 0, 1540, np.where(result == 2, 1460, 1500))
    away_elo_base = np.where(result == 2, 1540, np.where(result == 0, 1460, 1500))
    home_elo      = _clip(home_elo_base + rng.normal(0, 50, n), 1200, 1900).astype(int)
    away_elo      = _clip(away_elo_base + rng.normal(0, 50, n), 1200, 1900).astype(int)
    elo_diff      = home_elo - away_elo

    # ── tactical features ─────────────────────────────────────────────────────
    home_poss_style      = _clip(rng.normal(0.53, 0.07, n), 0.35, 0.72)  # Eredivisie: possession
    away_poss_style      = _clip(rng.normal(0.47, 0.07, n), 0.28, 0.65)
    home_pressing        = _clip(rng.normal(0.58, 0.08, n), 0.30, 0.85)
    away_pressing        = _clip(rng.normal(0.55, 0.08, n), 0.30, 0.85)
    home_fh_goals_rate   = _clip(rng.normal(0.48, 0.06, n), 0.30, 0.70)
    away_fh_goals_rate   = _clip(rng.normal(0.46, 0.06, n), 0.28, 0.68)
    home_def_solidity    = _clip(rng.normal(0.46, 0.09, n), 0.20, 0.75)  # Leaky defences
    away_def_solidity    = _clip(rng.normal(0.46, 0.09, n), 0.20, 0.75)
    home_setpiece_rate   = _clip(rng.normal(0.22, 0.06, n), 0.08, 0.45)
    away_setpiece_rate   = _clip(rng.normal(0.22, 0.06, n), 0.08, 0.45)

    # ── goal-difference / clean sheets ────────────────────────────────────────
    home_gd_avg_5     = home_goals_per_match_5 - home_goals_conceded
    away_gd_avg_5     = away_goals_per_match_5 - away_goals_conceded
    home_gd_trend     = _clip(rng.normal(0.0, 0.3, n), -1.5, 1.5)
    away_gd_trend     = _clip(rng.normal(0.0, 0.3, n), -1.5, 1.5)
    home_clean_5      = _clip(rng.binomial(5, 0.28, n).astype(float), 0.0, 5.0)  # Fewer clean sheets
    away_clean_5      = _clip(rng.binomial(5, 0.24, n).astype(float), 0.0, 5.0)
    home_scoring_cons = _clip(rng.uniform(0.4, 1.0, n), 0.3, 1.0)
    away_scoring_cons = _clip(rng.uniform(0.4, 1.0, n), 0.3, 1.0)

    # ── match IDs and dates ───────────────────────────────────────────────────
    match_ids = [str(uuid.uuid4()) for _ in range(n)]
    dates_str = [d.strftime("%Y-%m-%d %H:%M:%S") for d in match_dates]

    df = pd.DataFrame({
        "home_form_5":                    home_form_5,
        "home_form_10":                   home_form_10,
        "home_form_20":                   home_form_20,
        "home_win_rate_5":                home_win_rate_5,
        "home_goals_per_match_5":         home_goals_per_match_5,
        "away_form_5":                    away_form_5,
        "away_form_10":                   away_form_10,
        "away_form_20":                   away_form_20,
        "away_win_rate_5":                away_win_rate_5,
        "away_goals_per_match_5":         away_goals_per_match_5,
        "home_xg_avg_5":                  home_xg_avg_5,
        "home_xg_conceded_avg_5":         home_xg_conceded_avg_5,
        "home_xg_diff_5":                 home_xg_diff_5,
        "home_xg_overperformance":        home_xg_overperf,
        "home_xg_consistency":            home_xg_consistency,
        "away_xg_avg_5":                  away_xg_avg_5,
        "away_xg_conceded_avg_5":         away_xg_conceded_avg_5,
        "away_xg_diff_5":                 away_xg_diff_5,
        "away_xg_overperformance":        away_xg_overperf,
        "away_xg_consistency":            away_xg_consistency,
        "xg_differential":                xg_differential,
        "home_days_rest":                 home_days_rest,
        "home_fatigue_index":             home_fatigue_index,
        "home_fixtures_14d":              home_fixtures_14d,
        "home_fixture_congestion":        home_fixture_congest,
        "away_days_rest":                 away_days_rest,
        "away_fatigue_index":             away_fatigue_index,
        "away_fixtures_14d":              away_fixtures_14d,
        "away_fixture_congestion":        away_fixture_congest,
        "home_advantage_win_rate":        home_advantage_wr,
        "home_goals_advantage":           home_goals_advantage,
        "away_win_rate_away":             away_win_rate_away,
        "home_crowd_boost":               home_crowd_boost,
        "home_advantage_coefficient":     home_advantage_coef,
        "referee_home_bias":              referee_home_bias,
        "home_momentum_lambda":           home_momentum_lambda,
        "home_momentum_weighted":         home_momentum_wt,
        "home_win_streak":                home_win_streak,
        "home_unbeaten_streak":           home_unbeaten_streak,
        "away_momentum_lambda":           away_momentum_lambda,
        "away_momentum_weighted":         away_momentum_wt,
        "away_win_streak":                away_win_streak,
        "away_unbeaten_streak":           away_unbeaten_streak,
        "odds_volatility_1h":             odds_volatility,
        "market_panic_score":             market_panic,
        "odds_drift_home":                odds_drift_home,
        "bookmaker_margin":               bookmaker_margin,
        "home_implied_prob":              home_implied_prob,
        "h2h_home_wins":                  h2h_home_wins,
        "h2h_draws":                      h2h_draws,
        "h2h_away_wins":                  h2h_away_wins,
        "h2h_total_matches":              h2h_total,
        "h2h_avg_goals":                  h2h_avg_goals,
        "h2h_home_win_rate":              h2h_home_wr,
        "home_squad_value":               home_squad_val,
        "home_missing_value":             home_miss_val,
        "away_squad_value":               away_squad_val,
        "away_missing_value":             away_miss_val,
        "squad_value_diff":               squad_val_diff,
        "temperature":                    temperature,
        "precipitation":                  precipitation,
        "wind_speed":                     wind_speed,
        "weather_impact_score":           weather_impact,
        "home_elo":                       home_elo,
        "away_elo":                       away_elo,
        "elo_difference":                 elo_diff,
        "home_possession_style":          home_poss_style,
        "away_possession_style":          away_poss_style,
        "home_pressing_intensity":        home_pressing,
        "away_pressing_intensity":        away_pressing,
        "home_first_half_goals_rate":     home_fh_goals_rate,
        "away_first_half_goals_rate":     away_fh_goals_rate,
        "home_defensive_solidity":        home_def_solidity,
        "away_defensive_solidity":        away_def_solidity,
        "home_setpiece_goals_rate":       home_setpiece_rate,
        "away_setpiece_goals_rate":       away_setpiece_rate,
        "result":                         result,
        "match_id":                       match_ids,
        "match_date":                     dates_str,
        "home_goals_conceded_per_match_5": home_goals_conceded,
        "home_gd_avg_5":                  home_gd_avg_5,
        "home_gd_trend":                  home_gd_trend,
        "home_clean_sheets_5":            home_clean_5,
        "home_scoring_consistency":       home_scoring_cons,
        "away_goals_conceded_per_match_5": away_goals_conceded,
        "away_gd_avg_5":                  away_gd_avg_5,
        "away_gd_trend":                  away_gd_trend,
        "away_clean_sheets_5":            away_clean_5,
        "away_scoring_consistency":       away_scoring_cons,
    })

    return df


if __name__ == "__main__":
    df = generate()

    # Sanity checks
    dist = df["result"].value_counts(normalize=True).sort_index()
    print(f"Generated {len(df)} rows")
    print(f"Result dist: home={dist.get(0, 0):.3f}  draw={dist.get(1, 0):.3f}  away={dist.get(2, 0):.3f}")
    print(f"Avg home gpg: {df['home_goals_per_match_5'].mean():.3f}  "
          f"away gpg: {df['away_goals_per_match_5'].mean():.3f}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved → {OUTPUT_PATH}")
