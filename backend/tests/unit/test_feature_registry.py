"""WP-18/WP-10.3: pure tests on derive_last5_form_features(), the shared
remap formula wired into both data/transformers.py and
services/upcoming_match_feature_service.py. No existing test locked in this
formula's numeric output before this work package — these are the guard."""

import pytest

from src.models.feature_registry import derive_last5_form_features


def test_estimate_path_home():
    result = derive_last5_form_features(1.0, 0.6, is_home=True)
    assert result == {
        "home_form_last5_home": pytest.approx(3.0),
        "home_wins_last5_home": pytest.approx(3.0),
        "home_draws_last5_home": pytest.approx(0.0),
        "home_losses_last5_home": pytest.approx(2.0),
    }


def test_estimate_path_away_keys_and_values():
    result = derive_last5_form_features(0.6, 0.4, is_home=False)
    assert set(result.keys()) == {
        "away_form_last5_away", "away_wins_last5_away",
        "away_draws_last5_away", "away_losses_last5_away",
    }
    assert result["away_form_last5_away"] == pytest.approx(1.8)
    assert result["away_wins_last5_away"] == pytest.approx(2.0)
    assert result["away_draws_last5_away"] == pytest.approx(1.0)
    assert result["away_losses_last5_away"] == pytest.approx(2.0)


def test_real_counts_preferred_over_estimate():
    """Real wins_5/draws_5/losses_5 must win over the round()/estimate split
    — the whole reason this work package prefers them wherever available."""
    result = derive_last5_form_features(
        0.6, 0.4, is_home=False, wins_5=1.0, draws_5=3.0, losses_5=1.0,
    )
    # Estimate from win_rate_5=0.4 alone would give wins=2.0/draws=1.0/losses=2.0.
    assert result["away_wins_last5_away"] == pytest.approx(1.0)
    assert result["away_draws_last5_away"] == pytest.approx(3.0)
    assert result["away_losses_last5_away"] == pytest.approx(1.0)


def test_partial_real_counts_fall_back_to_full_estimate():
    """All-or-nothing: a partial trio (only wins_5 supplied) must not mix
    real and derived values — falls back to the complete estimate."""
    result = derive_last5_form_features(0.6, 0.4, is_home=False, wins_5=1.0)
    assert result["away_wins_last5_away"] == pytest.approx(2.0)  # estimate, not the real 1.0
    assert result["away_draws_last5_away"] == pytest.approx(1.0)
    assert result["away_losses_last5_away"] == pytest.approx(2.0)
