"""Canonical feature registry for inference-safe SabiScore models."""

from typing import Dict, List

# Canonical production feature schema (58) from sabiscore_production_v2 metadata.
CANONICAL_FEATURES_58: List[str] = [
    "home_form_last5_home",
    "home_wins_last5_home",
    "home_draws_last5_home",
    "home_losses_last5_home",
    "away_form_last5_away",
    "away_wins_last5_away",
    "away_draws_last5_away",
    "away_losses_last5_away",
    "home_goals_for_avg",
    "home_goals_against_avg",
    "away_goals_for_avg",
    "away_goals_against_avg",
    "total_goals_expected",
    "home_gd_recent",
    "away_gd_recent",
    "combined_attack",
    "combined_defense_weakness",
    "market_prob_home",
    "market_prob_draw",
    "market_prob_away",
    "market_edge_home",
    "market_favorite",
    "odds_ratio",
    "log_odds_home",
    "log_odds_draw",
    "log_odds_away",
    "draw_probability",
    "market_confidence",
    "ev_home",
    "ev_draw",
    "ev_away",
    "h2h_home_wins",
    "h2h_away_wins",
    "h2h_draws",
    "h2h_matches",
    "h2h_dominance",
    "home_venue_win_rate",
    "home_venue_draw_rate",
    "home_venue_loss_rate",
    "home_advantage_strength",
    "day_of_week",
    "is_weekend",
    "month",
    "season_phase",
    "league_home_rate",
    "league_avg_goals",
    "league_draw_rate",
    "form_market_agreement_home",
    "form_market_disagreement",
    "home_attack_vs_away_defense",
    "away_attack_vs_home_defense",
    "venue_market_combo",
    "h2h_market_agreement",
    "league_Bundesliga",
    "league_EPL",
    "league_La_Liga",
    "league_Ligue_1",
    "league_Serie_A",
]

# Phase 7-A expansion - 2026-05-31.
# The 58-feature schema remains intact for backward compatibility with pre-Phase-7 models.
#
# ATE resolution — Phase 8 Sprint 1 gate (2026-06-10):
#   CONFIRMED (causal report): elo_difference (ATE=0.335), home_pressing_intensity (ATE=0.146)
#   ASSUMPTION-PASS (proxy ATE ≥ 0.02): elo_home_trend_5, elo_away_trend_5,
#     elo_momentum_cross, progressive_carry_diff, shot_quality_diff
#
#   REMOVED from canonical Phase 7 set — pending_count now 0:
#     elo_league_adjusted     — proxy collinear with elo_difference; ATE not independently
#                               estimable from current data. Removed to prevent leakage-adjacent
#                               signal confusion. Eligible for re-introduction only after
#                               StatsBomb league-adjusted ratings are available (Phase 8.5+).
#     key_passes_under_pressure_diff — proxy ATE=0.005, well below 0.02 threshold. Negligible
#                               causal signal; retaining it inflates feature count without benefit.
#     set_piece_xg_diff       — mixed signal across leagues; validation returned inconclusive
#                               directionality. Remove until per-league ATE can be confirmed.
#
# CANONICAL_FEATURES_68 is now a CONFIRMED-ONLY 65-feature set (58 base + 7 phase7).
# PENDING FEATURE COUNT: 0 — gate cleared for Phase 8 training path.
PHASE7_FEATURES_7: List[str] = [
    "elo_difference",
    "elo_home_trend_5",
    "elo_away_trend_5",
    "elo_momentum_cross",
    "home_pressing_intensity",
    "progressive_carry_diff",
    "shot_quality_diff",
]

# Removed Phase 7 features — kept for audit trail and future re-evaluation.
# DO NOT include these in any training vector without re-running ATE validation.
PHASE7_FEATURES_REMOVED: List[str] = [
    "elo_league_adjusted",           # collinear proxy, no independent ATE signal
    "key_passes_under_pressure_diff",  # proxy ATE=0.005 < threshold
    "set_piece_xg_diff",             # mixed/inconclusive directional signal
]

# Features that remain in CANONICAL_FEATURES_65 for backward compatibility with v5_phase7
# model artifacts (removing them would cause dimension mismatch on loaded .pkl files) but
# MUST always be returned as DATA_GAP at inference time. The vector slot is present; the
# value is always the registry default. Do not compute live values for these features.
#
# Phase 8 Sprint 4 decision (2026-06-10):
#   shot_quality_diff — proxy ATE unreliable without real StatsBomb shot-map data.
#   Proxy derived from xg_avg_5 difference collapses to q75=0 on synthetic training data,
#   making ATE estimates non-discriminative. Permanent DATA_GAP until real StatsBomb
#   event-level shots corpus confirms ATE >= 0.02 (see guardrail 12 in Sprint 4 brief).
PHASE7_FEATURES_ALWAYS_DATA_GAP: List[str] = ["shot_quality_diff"]

CANONICAL_FEATURES_65: List[str] = [
    *CANONICAL_FEATURES_58,
    *PHASE7_FEATURES_7,
]

# Alias: CANONICAL_FEATURES_68 is intentionally renamed to _65 to reflect the
# corrected count after pending-feature removal. The alias below ensures backward
# compatibility with code that imports CANONICAL_FEATURES_68 by name — it now
# resolves to the 65-feature confirmed-only set. v5_phase7 models trained on the
# original 68-column vector will continue to load correctly; the registry change
# affects only future training runs.
CANONICAL_FEATURES_68 = CANONICAL_FEATURES_65

DEFAULT_FEATURE_VALUES_58: Dict[str, float] = {
    "home_form_last5_home": 1.5,
    "home_wins_last5_home": 2.0,
    "home_draws_last5_home": 1.0,
    "home_losses_last5_home": 2.0,
    "away_form_last5_away": 1.3,
    "away_wins_last5_away": 1.0,
    "away_draws_last5_away": 1.0,
    "away_losses_last5_away": 3.0,
    "home_goals_for_avg": 1.55,
    "home_goals_against_avg": 1.20,
    "away_goals_for_avg": 1.25,
    "away_goals_against_avg": 1.40,
    "total_goals_expected": 2.80,
    "home_gd_recent": 0.35,
    "away_gd_recent": -0.15,
    "combined_attack": 2.80,
    "combined_defense_weakness": 2.60,
    "market_prob_home": 0.42,
    "market_prob_draw": 0.26,
    "market_prob_away": 0.32,
    "market_edge_home": 0.10,
    "market_favorite": 0.0,
    "odds_ratio": 1.0,
    "log_odds_home": 0.0,
    "log_odds_draw": 0.0,
    "log_odds_away": 0.0,
    "draw_probability": 0.26,
    "market_confidence": 0.42,
    "ev_home": 0.0,
    "ev_draw": 0.0,
    "ev_away": 0.0,
    "h2h_home_wins": 2.0,
    "h2h_away_wins": 2.0,
    "h2h_draws": 1.0,
    "h2h_matches": 5.0,
    "h2h_dominance": 0.0,
    "home_venue_win_rate": 0.50,
    "home_venue_draw_rate": 0.26,
    "home_venue_loss_rate": 0.24,
    "home_advantage_strength": 0.26,
    "day_of_week": 5.0,
    "is_weekend": 1.0,
    "month": 8.0,
    "season_phase": 0.5,
    "league_home_rate": 0.42,
    "league_avg_goals": 2.75,
    "league_draw_rate": 0.246,
    "form_market_agreement_home": 0.21,
    "form_market_disagreement": 0.08,
    "home_attack_vs_away_defense": 0.15,
    "away_attack_vs_home_defense": 0.05,
    "venue_market_combo": 0.21,
    "h2h_market_agreement": 0.0,
    "league_Bundesliga": 0.0,
    "league_EPL": 1.0,
    "league_La_Liga": 0.0,
    "league_Ligue_1": 0.0,
    "league_Serie_A": 0.0,
}

DEFAULT_FEATURE_VALUES_68: Dict[str, float] = {
    **DEFAULT_FEATURE_VALUES_58,
    "elo_difference": 0.0,
    "elo_home_trend_5": 0.0,
    "elo_away_trend_5": 0.0,
    "elo_momentum_cross": 0.0,
    "home_pressing_intensity": 0.55,
    "progressive_carry_diff": 0.0,
    "shot_quality_diff": 0.0,
    # NOTE: elo_league_adjusted, key_passes_under_pressure_diff, and set_piece_xg_diff
    # were removed from the canonical set on 2026-06-10 (pending-feature resolution,
    # Phase 8 Sprint 1). They are intentionally absent from this dict.
}


# ── Phase 8 feature expansion ─────────────────────────────────────────────────
# Phase 8 feature expansion — built on top of the confirmed-only 65-feature set.
# CANONICAL_FEATURES_65 (formerly 68) is the base; new features are accumulated here.
# Do not append to the Phase 7 list — v5_phase7 models were trained on a 68-column
# vector (pre-removal) and will continue to load correctly at inference time via
# backward-compatible defaults. New v6_phase8 models will train on CANONICAL_FEATURES_83.
#
# Phase 8 feature groups (18 new features, ATE validation required):
#   Pi-ratings (6):  home/away attack+defense, diffs      [5a]
#   Berrar ratings (3): home/away rating, diff             [5a.5]
#   EWMA form (6):   weighted win/draw rate + PPG × 2     [5b]
#   Market (5):      odds drifts + direction               [5d]
#   Match context (1): importance score                    [5e]

PHASE8_FEATURES_PI: List[str] = [
    "home_pi_attack",
    "home_pi_defense",
    "away_pi_attack",
    "away_pi_defense",
    "pi_attack_diff",
    "pi_defense_diff",
]

PHASE8_FEATURES_BERRAR: List[str] = [
    "home_berrar_rating",
    "away_berrar_rating",
    "berrar_rating_diff",
]

PHASE8_FEATURES_FORM: List[str] = [
    "home_weighted_win_rate",
    "home_weighted_draw_rate",
    "home_weighted_ppg",
    "away_weighted_win_rate",
    "away_weighted_draw_rate",
    "away_weighted_ppg",
]

PHASE8_FEATURES_MARKET: List[str] = [
    "odds_drift_home",
    "odds_drift_draw",
    "odds_drift_away",
    "max_abs_odds_drift",
    "sharp_money_direction",
]

PHASE8_FEATURES_CONTEXT: List[str] = [
    "match_importance_score",
]

# All Phase 8 input features (18 total before ATE gating of individual groups)
PHASE8_FEATURES_18: List[str] = [
    *PHASE8_FEATURES_PI,
    *PHASE8_FEATURES_BERRAR,
    *PHASE8_FEATURES_FORM,
    *PHASE8_FEATURES_MARKET,
    *PHASE8_FEATURES_CONTEXT,
]

CANONICAL_FEATURES_83: List[str] = [
    *CANONICAL_FEATURES_65,
    *PHASE8_FEATURES_18,
]

# Alias for backward compatibility with code using the old name.
# The underlying list is 86 features (65 confirmed Phase 7 + 21 Phase 8).
# PHASE8_FEATURES_18 is a legacy name; the actual count is 21 (FORM has 6 entries).
CANONICAL_FEATURES_86 = CANONICAL_FEATURES_83

# Default values for Phase 8 features — used when live data is unavailable.
# Pi/Berrar defaults are 0.0 (neutral) because only diffs matter to the model.
# Market defaults assume no observable drift. Context defaults to 0.3 (moderate).
DEFAULT_FEATURE_VALUES_86: Dict[str, float] = {
    **DEFAULT_FEATURE_VALUES_68,
    # Pi-ratings
    "home_pi_attack": 0.0,
    "home_pi_defense": 0.0,
    "away_pi_attack": 0.0,
    "away_pi_defense": 0.0,
    "pi_attack_diff": 0.0,
    "pi_defense_diff": 0.0,
    # Berrar ratings — initialised at 1500 in-system; diff=0 for defaults
    "home_berrar_rating": 1500.0,
    "away_berrar_rating": 1500.0,
    "berrar_rating_diff": 0.0,
    # EWMA form — priors for an average team
    "home_weighted_win_rate": 0.40,
    "home_weighted_draw_rate": 0.28,
    "home_weighted_ppg": 1.48,
    "away_weighted_win_rate": 0.32,
    "away_weighted_draw_rate": 0.26,
    "away_weighted_ppg": 1.22,
    # Market movement — no drift observed
    "odds_drift_home": 0.0,
    "odds_drift_draw": 0.0,
    "odds_drift_away": 0.0,
    "max_abs_odds_drift": 0.0,
    "sharp_money_direction": 0.0,
    # Match context — low importance by default
    "match_importance_score": 0.2,
}


def active_canonical_features(use_phase7: bool, use_phase8: bool = False) -> List[str]:
    if use_phase8:
        return list(CANONICAL_FEATURES_86)
    return list(CANONICAL_FEATURES_68 if use_phase7 else CANONICAL_FEATURES_58)


def active_default_feature_values(
    use_phase7: bool, use_phase8: bool = False
) -> Dict[str, float]:
    if use_phase8:
        return dict(DEFAULT_FEATURE_VALUES_86)
    return dict(DEFAULT_FEATURE_VALUES_68 if use_phase7 else DEFAULT_FEATURE_VALUES_58)


def canonical_feature_count() -> int:
    return len(CANONICAL_FEATURES_58)


def canonical_feature_count_phase7() -> int:
    """Returns the confirmed-only Phase 7 feature count (65 after pending removal)."""
    return len(CANONICAL_FEATURES_65)


def canonical_feature_count_phase8() -> int:
    """Returns the Phase 8 confirmed feature count (86 = 65 phase7 + 21 phase8)."""
    return len(CANONICAL_FEATURES_83)
