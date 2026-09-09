"""scripts/train_on_real_matches.py::_select_calibrator (Portfolio A / E0 / B2-B3).

PRODUCTION_EXECUTIVE_DIRECTIVE.md §20 B2/B3, a two-stage gate: stage 1 chooses
between temperature scaling and isotonic regression on the calibration holdout
("reliability improves AND resolution holds" — reliability improving alone is
not sufficient, since a flat prediction that always emits the base rate is
trivially "reliable" while being completely uninformative); stage 2 requires
the stage-1 conclusion to "persist on untouched data" using a genuinely
disjoint holdout season before isotonic ships, because isotonic regression is
flexible enough to fit a small calibration slice almost exactly -- an in-sample
reliability number near zero is expected of an overfitting calibrator, not
evidence it generalises. This is not a theoretical concern: retraining on the
real per-league corpus, isotonic won stage 1 in 4 of 6 leagues (EPL, LA_LIGA,
LIGUE_1, the pooled EREDIVISIE model) and failed stage 2 in all 4 -- a complete
reversal every time. Temperature scaling ships in every league as a result.

This file also pins the delegation to ``brier_score_decomposition`` -- the
SAME function production's ``/model-performance/calibration`` endpoint uses --
so the numbers this pipeline selects on are never computed a second,
independently-drifting way (this repository has a documented history of
exactly that shape drifting apart: the mean-over-samples vs. mean-over-classes
Brier convention mismatch recorded in ``reports/evaluation/metric-contract.json``).

Not a package (pytest.ini excludes scripts/ from collection and pythonpath
only covers src/), so the module is loaded by inserting its directory onto
sys.path directly — same pattern as test_train_on_real_matches_elo.py.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np
import pytest

_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

import train_on_real_matches  # noqa: E402

from src.models.evaluation.metrics import brier_score_decomposition  # noqa: E402


class _FakeCalibrator:
    """A pre-fitted calibrator stub: predict_proba returns a fixed matrix,
    ignoring its input — the tests below control the matrix directly rather
    than fighting real isotonic/temperature fitting to engineer edge cases."""

    def __init__(self, probs: np.ndarray) -> None:
        self._probs = probs

    def predict_proba(self, X: Any) -> np.ndarray:
        return self._probs


def test_calibration_reliability_matches_production_brier_decomposition() -> None:
    """No second, independently-binned reliability/resolution implementation.

    A prior version special-cased the first bin as [0.0, 0.1] inclusive while
    every other bin -- and both production functions
    (expected_calibration_error, brier_score_decomposition) -- use (lo, hi]
    uniformly. Isotonic regression's y_min=0.0 clip makes exact-zero outputs a
    real occurrence, so the two conventions could disagree by more than
    rounding. This test would fail under that prior implementation.
    """
    rng = np.random.default_rng(7)
    probs = rng.dirichlet([1.0, 1.0, 1.0], size=200)
    y = rng.integers(0, 3, size=200)

    result = train_on_real_matches._calibration_reliability(_FakeCalibrator(probs), None, y)
    expected = brier_score_decomposition(y, probs, n_bins=10)

    assert result["reliability"] == pytest.approx(expected["mean"]["reliability"])
    assert result["resolution"] == pytest.approx(expected["mean"]["resolution"])


def test_select_calibrator_picks_isotonic_when_reliability_and_resolution_both_improve(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    y = np.array([0, 0, 1, 1, 2, 2] * 10)
    # Temperature stand-in: a CONSTANT row regardless of the true class --
    # uninformative but happens to be mildly closer to the true class's own
    # marginal rate than the other two, so it is not flat-zero-resolution.
    temp_probs = np.tile([0.5, 0.3, 0.2], (len(y), 1))
    # Isotonic stand-in: correlated with the true class -- both better
    # calibrated (closer predicted-vs-observed within each bin) and more
    # discriminative (its bins pull further from the base rate).
    iso_probs = np.full((len(y), 3), 0.05)
    iso_probs[np.arange(len(y)), y] = 0.9

    monkeypatch.setattr(train_on_real_matches, "_fit_temperature", lambda *a, **k: _FakeCalibrator(temp_probs))
    monkeypatch.setattr(train_on_real_matches, "_fit_isotonic", lambda *a, **k: _FakeCalibrator(iso_probs))

    model, diagnostics = train_on_real_matches._select_calibrator(
        object(), None, y, meta_features_holdout=None, y_holdout=y,
    )

    assert diagnostics["chosen"] == "isotonic"
    assert diagnostics["isotonic"]["reliability"] < diagnostics["temperature"]["reliability"]
    assert diagnostics["isotonic"]["resolution"] >= diagnostics["temperature"]["resolution"]
    # Same fixed matrices scored against the same y -- the persistence check
    # is necessarily trivial here; test_..._does_not_persist below exercises
    # the genuinely informative case.
    assert diagnostics["held_out_persistence"]["conclusion_persists"] is True
    assert model.predict_proba(None) is iso_probs


def test_select_calibrator_rejects_isotonic_that_improves_reliability_but_flattens_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The B3 gate this fix adds: reliability improving alone must not win.

    Textbook reliability/resolution trade-off (the "always predict the town's
    average rainfall probability" forecaster): a perfectly flat prediction at
    each class's true marginal rate has ZERO calibration error by
    construction, but zero discrimination too. Temperature scaling here keeps
    real (if imperfect) per-class separation, so it must be preferred despite
    scoring worse on reliability alone.
    """
    y = np.array([0, 1, 2] * 20)
    temp_probs = np.full((len(y), 3), 0.225)
    temp_probs[np.arange(len(y)), y] = 0.55
    iso_probs = np.full((len(y), 3), 1.0 / 3.0)  # exactly the marginal rate, every row

    monkeypatch.setattr(train_on_real_matches, "_fit_temperature", lambda *a, **k: _FakeCalibrator(temp_probs))
    monkeypatch.setattr(train_on_real_matches, "_fit_isotonic", lambda *a, **k: _FakeCalibrator(iso_probs))

    model, diagnostics = train_on_real_matches._select_calibrator(
        object(), None, y, meta_features_holdout=None, y_holdout=y,
    )

    assert diagnostics["isotonic"]["reliability"] < diagnostics["temperature"]["reliability"]
    assert diagnostics["isotonic"]["resolution"] < diagnostics["temperature"]["resolution"]
    assert diagnostics["chosen"] == "temperature"
    assert diagnostics["reason"] == "isotonic_degraded_resolution"
    assert model.predict_proba(None) is temp_probs


def test_select_calibrator_rejects_isotonic_when_the_calibration_set_conclusion_does_not_persist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The core new behaviour: isotonic can win on the calibration set purely
    by overfitting it, so a stage-1 win alone must not be enough to ship it.

    Reuses the "isotonic wins" calibration-set setup, but the held-out labels
    are the calibration labels cyclically relabelled (0->1->2->0) — a
    class-balance-preserving permutation that makes isotonic's per-row "hot"
    class wrong for every row on the held-out data, while temperature's
    label-blind constant prediction is mathematically unaffected (a constant
    row's reliability/resolution depend only on each class's marginal rate,
    which the permutation preserves). Directive §20 B3 ("succeeds only if...
    persists on untouched data") means isotonic must lose here — temperature
    ships despite isotonic having "won" the circular calibration-set compare.

    This is not a contrived scenario: on the real per-league corpus, this
    exact reversal happened in all 4 leagues where isotonic ever won the
    calibration-set comparison (see the module docstring).
    """
    y_calibration = np.array([0, 0, 1, 1, 2, 2] * 10)
    temp_probs = np.tile([0.5, 0.3, 0.2], (len(y_calibration), 1))
    iso_probs = np.full((len(y_calibration), 3), 0.05)
    iso_probs[np.arange(len(y_calibration)), y_calibration] = 0.9
    y_holdout = (y_calibration + 1) % 3

    monkeypatch.setattr(train_on_real_matches, "_fit_temperature", lambda *a, **k: _FakeCalibrator(temp_probs))
    monkeypatch.setattr(train_on_real_matches, "_fit_isotonic", lambda *a, **k: _FakeCalibrator(iso_probs))

    model, diagnostics = train_on_real_matches._select_calibrator(
        object(), None, y_calibration, meta_features_holdout=None, y_holdout=y_holdout,
    )

    expected_temp_holdout = brier_score_decomposition(y_holdout, temp_probs, n_bins=10)["mean"]
    expected_iso_holdout = brier_score_decomposition(y_holdout, iso_probs, n_bins=10)["mean"]

    # Isotonic "won" stage 1 (the calibration set) but must be rejected
    # because it fails stage 2 (the held-out season) -- temperature ships.
    assert diagnostics["chosen"] == "temperature"
    assert diagnostics["reason"] == "isotonic_won_calibration_set_but_did_not_persist_on_holdout"
    assert model.predict_proba(None) is temp_probs
    persistence = diagnostics["held_out_persistence"]
    assert persistence["temperature"]["reliability"] == pytest.approx(expected_temp_holdout["reliability"])
    assert persistence["isotonic"]["reliability"] == pytest.approx(expected_iso_holdout["reliability"])
    assert persistence["isotonic"]["reliability"] > persistence["temperature"]["reliability"]
    assert persistence["conclusion_persists"] is False


def test_select_calibrator_falls_back_to_temperature_when_isotonic_fit_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    y = np.array([0, 1, 2] * 5)
    temp_probs = np.tile([0.4, 0.35, 0.25], (len(y), 1))
    monkeypatch.setattr(train_on_real_matches, "_fit_temperature", lambda *a, **k: _FakeCalibrator(temp_probs))

    def _raise(*_args: Any, **_kwargs: Any) -> Any:
        raise ValueError("boom")

    monkeypatch.setattr(train_on_real_matches, "_fit_isotonic", _raise)

    model, diagnostics = train_on_real_matches._select_calibrator(
        object(), None, y, meta_features_holdout=None, y_holdout=y,
    )

    assert diagnostics["chosen"] == "temperature"
    assert diagnostics["isotonic"] is None
    assert "boom" in diagnostics["reason"]
    assert diagnostics["held_out_persistence"]["isotonic"] is None
    assert diagnostics["held_out_persistence"]["conclusion_persists"] is True
    assert model.predict_proba(None) is temp_probs
