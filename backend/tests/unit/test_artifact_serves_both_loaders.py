"""Every committed artifact must satisfy BOTH loaders, not just one.

Two independent code paths read the same `*_ensemble_v5_phase7.pkl` files and
they need different things from them:

1. `PredictionEngine._load_from_disk` / `_ensemble_predict_dict` — averages the
   base learners in `models` and never touches `meta_model`. This is the request
   path (`/upcoming/matches`, `/full-analysis`).
2. `SabiScoreEnsemble.load_model` → `.predict()` — stacks through
   `meta_model.predict_proba()` and raises "Meta model is not initialized" if it
   is None. This runs at **startup** via `_startup_load_models_strict`, and a
   failure there aborts the lifespan: uvicorn never binds, the container exits,
   Render restarts it, and the service is hard-down.

A retrain that satisfied only (1) shipped `meta_model: None` and took production
offline on deploy — every artifact loaded and predicted correctly in the request
path while the strict startup check rejected all six. These tests exercise the
real committed artifacts through both paths, using the same smoke test the
startup code runs.
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import numpy as np
import pytest

from src.core.model_fetcher import _smoke_test_ensemble_model
from src.models.ensemble import SabiScoreEnsemble
from src.models.feature_registry import CANONICAL_FEATURES_68, DEFAULT_FEATURE_VALUES_68
from src.models.prediction import PredictionEngine

_MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
_LEAGUES = ["epl", "la_liga", "bundesliga", "serie_a", "ligue_1", "eredivisie"]


def _artifact(league: str) -> Path:
    return _MODELS_DIR / f"{league}_ensemble_v5_phase7.pkl"


@pytest.mark.parametrize("league", _LEAGUES)
def test_strict_startup_path_accepts_artifact(league: str):
    """The exact check `_startup_load_models_strict` performs on boot."""
    path = _artifact(league)
    if not path.exists():
        pytest.skip(f"{path.name} not present in this checkout")

    model = SabiScoreEnsemble.load_model(str(path))
    assert model.meta_model is not None, (
        f"{path.name} has meta_model=None — SabiScoreEnsemble.predict() raises "
        "'Meta model is not initialized', which aborts application startup"
    )
    # Raises on any contract violation; that raise is what takes prod down.
    _smoke_test_ensemble_model(model, league=league, artifact_name=path.name)


@pytest.mark.parametrize("league", _LEAGUES)
def test_stacked_head_returns_a_valid_simplex(league: str):
    path = _artifact(league)
    if not path.exists():
        pytest.skip("artifact not present in this checkout")

    import pandas as pd

    model = SabiScoreEnsemble.load_model(str(path))
    row = {name: DEFAULT_FEATURE_VALUES_68[name] for name in CANONICAL_FEATURES_68}
    result = model.predict(pd.DataFrame([row]))

    probs = [
        float(result["home_win_prob"].iloc[0]),
        float(result["draw_prob"].iloc[0]),
        float(result["away_win_prob"].iloc[0]),
    ]
    assert all(0.0 <= p <= 1.0 for p in probs)
    assert abs(sum(probs) - 1.0) < 1e-6


@pytest.mark.parametrize("league", ["EPL", "LA_LIGA"])
def test_request_path_still_serves_the_same_artifact(league: str):
    """Both loaders must work off one file — fixing one must not break the other."""
    if not _artifact(league.lower()).exists():
        pytest.skip("artifact not present in this checkout")

    vector = np.array(
        [DEFAULT_FEATURE_VALUES_68[f] for f in CANONICAL_FEATURES_68], dtype=np.float32
    )
    result = asyncio.get_event_loop_policy().new_event_loop().run_until_complete(
        PredictionEngine().predict(features=vector, league=league)
    )
    assert result.model_version != "fallback"
    assert abs((result.home_win + result.draw + result.away_win) - 1.0) < 1e-3
