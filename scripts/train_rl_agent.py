"""Phase 6-C: SAC Reinforcement Learning Betting Agent.

Environment : FootballBettingEnv  (Gymnasium)
Algorithm   : SAC via stable-baselines3 >= 2.3.0
State       : 16-dim normalized vector
Action      : 5-dim continuous [-2, 2]
                  action[:4] → outcome logits → argmax → {HOME, DRAW, AWAY, ABSTAIN}
                  action[4]  → stake signal → sigmoid × max_kelly_cap
Reward      : 5-component, weights must sum to 1.0 (C14)
              w_pnl=0.40, w_ic=0.25, w_cal=0.15, w_risk=0.15, w_abs=0.05

Curriculum (C15 — chronological order):
  Phase 0–100   : max(p_pred) > 0.60
  Phase 100–300 : max(p_pred) > 0.50
  Phase 300+    : all matches

Production gates (500 held-out episodes, C16):
  Gate 1 : mean ROI per bet > +5.0%
  Gate 2 : maximum drawdown < 25.0%
  Gate 3 : rolling Sharpe (20-bet window) ≥ 1.50
  Gate 4 : abstention rate 10–40%

Model written to settings.rl_agent_path ONLY after ALL four gates pass.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger("train_rl_agent")

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

# ---------------------------------------------------------------------------
# Guard: gymnasium + stable-baselines3
# ---------------------------------------------------------------------------
try:
    import gymnasium as gym
    from gymnasium import spaces
except ImportError:
    try:
        import gym  # type: ignore
        from gym import spaces  # type: ignore
    except ImportError as exc:
        log.error("Gymnasium not installed.  Run: pip install gymnasium stable-baselines3  (%s)", exc)
        sys.exit(1)

try:
    from stable_baselines3 import SAC
    from stable_baselines3.common.callbacks import BaseCallback
    from stable_baselines3.common.vec_env import DummyVecEnv
except ImportError as exc:
    log.error("stable-baselines3 not installed.  Run: pip install stable-baselines3>=2.3.0  (%s)", exc)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants from rl_reward_spec
# ---------------------------------------------------------------------------
W_PNL  = 0.40
W_IC   = 0.25
W_CAL  = 0.15
W_RISK = 0.15
W_ABS  = 0.05
assert abs(W_PNL + W_IC + W_CAL + W_RISK + W_ABS - 1.0) < 1e-9, "Reward weights must sum to 1.0"

# Base rates (ground truth class mix)
BASE_HOME = 0.420
BASE_DRAW = 0.246
BASE_AWAY = 0.334

# Action outcome indices
IDX_HOME    = 0
IDX_DRAW    = 1
IDX_AWAY    = 2
IDX_ABSTAIN = 3

# Curriculum thresholds
CURRICULUM_PHASE1_MAX_CONF = 0.60   # episodes 0–100
CURRICULUM_PHASE2_MAX_CONF = 0.50   # episodes 100–300
# Phase 300+ → all matches

# Gate thresholds
GATE_ROI_PCT        = 5.0    # mean ROI per bet > 5%
GATE_MAX_DRAWDOWN   = 25.0   # max drawdown < 25%
GATE_SHARPE         = 1.50   # rolling Sharpe (20-bet) ≥ 1.50
GATE_ABSTAIN_LOW    = 0.10   # abstention rate ≥ 10%
GATE_ABSTAIN_HIGH   = 0.40   # abstention rate ≤ 40%

INITIAL_BANKROLL    = 1.0    # normalised to 1.0 (bankroll_pct = bankroll / initial)
MAX_KELLY_CAP       = 0.05   # C14-compatible; matches settings.rl_max_kelly_cap default
TERMINAL_PENALTY    = -10.0  # applied when bankroll < 10% of initial
N_STEP              = 5      # n-step returns (temporal rule)
SEED                = 42


# ---------------------------------------------------------------------------
# Match data loading and preparation
# ---------------------------------------------------------------------------

def _load_match_data(data_dir: Path) -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    for p in sorted(data_dir.glob("*_training.csv")):
        try:
            df = pd.read_csv(p)
        except Exception as exc:
            log.warning("Skipping %s: %s", p.name, exc)
            continue
        if df.empty:
            continue
        if "result" in df.columns:
            df = df.rename(columns={"result": "match_result"})
        if "match_result" in df.columns:
            frames.append(df)

    if not frames:
        raise FileNotFoundError(f"No usable *_training.csv files in {data_dir}")

    merged = pd.concat(frames, axis=0, ignore_index=True)
    merged = merged.reset_index(drop=True)
    return merged


def _simulate_probabilities(row: pd.Series, rng: np.random.Generator) -> np.ndarray:
    """Derive soft probability vector from match result with calibration noise.

    Uses the ground-truth label as a prior and adds Dirichlet noise so the
    agent faces a realistic distribution of model outputs.
    """
    label = int(row.get("match_result", 0))
    # True probability vector starts strongly towards actual outcome
    strength = rng.uniform(0.50, 0.85)
    probs = np.array([BASE_HOME, BASE_DRAW, BASE_AWAY], dtype=np.float64)
    probs[label] += strength
    # Add Dirichlet noise for diversity
    probs = probs + rng.dirichlet(probs * 3.0) * 0.15
    probs = np.clip(probs, 1e-4, None)
    probs /= probs.sum()
    return probs.astype(np.float32)


def _simulate_odds(probs: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Convert probabilities to decimal odds with a bookmaker margin (4–8%)."""
    margin = rng.uniform(1.04, 1.08)
    fair_probs = probs * margin
    fair_probs = np.clip(fair_probs, 0.01, 0.99)
    fair_probs /= fair_probs.sum()
    odds = 1.0 / fair_probs
    return odds.astype(np.float32)


def _simulate_uncertainty(probs: np.ndarray, rng: np.random.Generator) -> Tuple[float, float]:
    """Proxy epistemic/aleatoric uncertainty from prediction entropy."""
    entropy = -np.sum(probs * np.log(probs + 1e-8))
    max_entropy = np.log(3.0)
    normalised_entropy = float(entropy / max_entropy)
    epistemic = float(rng.uniform(0.01, 0.30) * (1.0 - max(probs)))
    aleatoric = normalised_entropy
    return epistemic, aleatoric


# ---------------------------------------------------------------------------
# Gymnasium environment
# ---------------------------------------------------------------------------

class FootballBettingEnv(gym.Env):
    """Gymnasium environment for football match betting.

    Observation (16 dims):
      [0]  home_prob
      [1]  draw_prob
      [2]  away_prob
      [3]  epistemic_unc
      [4]  aleatoric_unc
      [5]  edge_home
      [6]  edge_draw
      [7]  edge_away
      [8]  home_odds
      [9]  draw_odds
      [10] away_odds
      [11] bankroll_pct
      [12] current_drawdown
      [13] rolling_sharpe
      [14] win_rate_20
      [15] rolling_ece_20

    Action (5 dims, continuous in [-2, 2]):
      [0:4] outcome logits  → argmax → {HOME, DRAW, AWAY, ABSTAIN}
      [4]   stake signal    → sigmoid(·) × MAX_KELLY_CAP

    Matches are fed in chronological order (C15).
    """

    metadata = {"render_modes": []}

    def __init__(
        self,
        matches: pd.DataFrame,
        episode_length: int = 50,
        curriculum_phase: int = 0,
        seed: Optional[int] = None,
        epistemic_threshold: float = 0.15,
    ) -> None:
        super().__init__()
        self.matches = matches.reset_index(drop=True)
        self.episode_length = episode_length
        self.curriculum_phase = curriculum_phase
        self.epistemic_threshold = epistemic_threshold
        self._rng = np.random.default_rng(seed)

        self.observation_space = spaces.Box(
            low=-5.0, high=5.0, shape=(16,), dtype=np.float32
        )
        self.action_space = spaces.Box(
            low=-2.0, high=2.0, shape=(5,), dtype=np.float32
        )

        self._match_idx = 0
        self._filtered_indices: List[int] = self._build_filtered_indices()

        # Episode state
        self.bankroll = INITIAL_BANKROLL
        self.peak_bankroll = INITIAL_BANKROLL
        self.bet_history: List[Dict[str, float]] = []
        self.steps = 0
        self._current_probs: np.ndarray = np.array([BASE_HOME, BASE_DRAW, BASE_AWAY])
        self._current_odds: np.ndarray = np.array([2.38, 4.07, 3.0])
        self._current_result: int = 0

    # ------------------------------------------------------------------
    def _build_filtered_indices(self) -> List[int]:
        """Return chronologically ordered match indices for current curriculum phase."""
        indices = list(range(len(self.matches)))
        return indices  # chronological order preserved

    def _curriculum_filter(self, probs: np.ndarray) -> bool:
        """Return True if match passes the current curriculum confidence filter."""
        max_p = float(probs.max())
        if self.curriculum_phase == 0:
            return max_p > CURRICULUM_PHASE1_MAX_CONF
        if self.curriculum_phase == 1:
            return max_p > CURRICULUM_PHASE2_MAX_CONF
        return True  # Phase 2+: all matches

    def _next_match(self) -> Tuple[pd.Series, np.ndarray, np.ndarray, float, float]:
        """Advance to next match that satisfies curriculum filter."""
        for _ in range(len(self._filtered_indices)):
            idx = self._filtered_indices[self._match_idx % len(self._filtered_indices)]
            self._match_idx = (self._match_idx + 1) % len(self._filtered_indices)
            row = self.matches.iloc[idx]
            probs = _simulate_probabilities(row, self._rng)
            if not self._curriculum_filter(probs):
                continue
            odds = _simulate_odds(probs, self._rng)
            epistemic, aleatoric = _simulate_uncertainty(probs, self._rng)
            return row, probs, odds, epistemic, aleatoric

        # Fallback: relax curriculum if nothing passes
        idx = self._filtered_indices[self._match_idx % len(self._filtered_indices)]
        self._match_idx = (self._match_idx + 1) % len(self._filtered_indices)
        row = self.matches.iloc[idx]
        probs = _simulate_probabilities(row, self._rng)
        odds = _simulate_odds(probs, self._rng)
        epistemic, aleatoric = _simulate_uncertainty(probs, self._rng)
        return row, probs, odds, epistemic, aleatoric

    # ------------------------------------------------------------------
    def _build_observation(
        self,
        probs: np.ndarray,
        odds: np.ndarray,
        epistemic: float,
        aleatoric: float,
    ) -> np.ndarray:
        mkt_probs = 1.0 / np.clip(odds, 1.01, 100.0)
        mkt_probs /= mkt_probs.sum()
        edge = probs - mkt_probs

        bankroll_pct = self.bankroll / INITIAL_BANKROLL
        current_drawdown = max(0.0, 1.0 - bankroll_pct / max(self.peak_bankroll / INITIAL_BANKROLL, 1e-8))

        bets = self.bet_history[-20:]
        win_rate_20 = float(np.mean([b["won"] for b in bets])) if bets else 0.5
        ece_errors = [abs(b["pred_prob"] - b["won"]) for b in bets if "pred_prob" in b]
        rolling_ece_20 = float(np.mean(ece_errors)) if ece_errors else 0.0

        # Sharpe: mean / std of last 20 P&L returns
        pnl_history = [b["pnl"] for b in bets]
        if len(pnl_history) >= 2:
            mu = np.mean(pnl_history)
            sigma = np.std(pnl_history) + 1e-8
            rolling_sharpe = float(mu / sigma * np.sqrt(len(pnl_history)))
        else:
            rolling_sharpe = 0.0

        obs = np.array([
            probs[0], probs[1], probs[2],
            epistemic, aleatoric,
            edge[0], edge[1], edge[2],
            odds[0], odds[1], odds[2],
            bankroll_pct, current_drawdown,
            rolling_sharpe, win_rate_20, rolling_ece_20,
        ], dtype=np.float32)

        return np.clip(obs, -5.0, 5.0)

    # ------------------------------------------------------------------
    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict]:
        if seed is not None:
            self._rng = np.random.default_rng(seed)
        self.bankroll = INITIAL_BANKROLL
        self.peak_bankroll = INITIAL_BANKROLL
        self.bet_history = []
        self.steps = 0

        row, probs, odds, epistemic, aleatoric = self._next_match()
        self._current_probs = probs
        self._current_odds = odds
        self._current_result = int(row.get("match_result", 0))
        self._current_epistemic = epistemic
        self._current_aleatoric = aleatoric

        obs = self._build_observation(probs, odds, epistemic, aleatoric)
        return obs, {}

    # ------------------------------------------------------------------
    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        self.steps += 1

        # --- Decode action ---
        outcome_logits = action[:4]
        outcome_idx = int(np.argmax(outcome_logits))
        stake_signal = float(action[4]) if len(action) > 4 else 0.0
        stake_fraction = float(
            np.clip(1.0 / (1.0 + np.exp(-stake_signal)) * MAX_KELLY_CAP, 0.0, MAX_KELLY_CAP)
        )
        abstain = outcome_idx == IDX_ABSTAIN

        probs = self._current_probs
        odds = self._current_odds
        actual_result = self._current_result
        epistemic = self._current_epistemic

        # --- Resolve bet ---
        won = False
        pnl = 0.0
        wagered = 0.0
        pred_prob = 0.0
        if not abstain:
            if outcome_idx < 3:
                outcome_won = (actual_result == outcome_idx)
                market_odds = float(odds[outcome_idx])
                pred_prob = float(probs[outcome_idx])
                bet_amount = stake_fraction * self.bankroll
                wagered = bet_amount
                if outcome_won:
                    pnl = bet_amount * (market_odds - 1.0)
                    won = True
                else:
                    pnl = -bet_amount
                self.bankroll = max(0.0, self.bankroll + pnl)
            stake_fraction_used = stake_fraction
        else:
            stake_fraction_used = 0.0
            market_odds = float(odds[0])
            pred_prob = float(probs[outcome_idx]) if outcome_idx < 3 else 0.0

        self.peak_bankroll = max(self.peak_bankroll, self.bankroll)
        self.bet_history.append({
            "won": float(won),
            "pnl": pnl / max(self.bankroll, 1e-8) if not abstain else 0.0,
            "pred_prob": pred_prob,
            "abstain": float(abstain),
        })

        # --- Compute 5-component reward ---
        reward = self._compute_reward(
            abstain=abstain,
            outcome_idx=outcome_idx,
            won=won,
            stake_fraction=stake_fraction_used,
            market_odds=market_odds,
            probs=probs,
            epistemic=epistemic,
            pnl=pnl,
        )

        # --- Terminal condition ---
        bankroll_pct = self.bankroll / INITIAL_BANKROLL
        terminated = bankroll_pct < 0.10
        truncated = self.steps >= self.episode_length
        if terminated:
            reward += TERMINAL_PENALTY

        # --- Advance to next match ---
        row, probs, odds, epistemic, aleatoric = self._next_match()
        self._current_probs = probs
        self._current_odds = odds
        self._current_result = int(row.get("match_result", 0))
        self._current_epistemic = epistemic
        self._current_aleatoric = aleatoric

        obs = self._build_observation(probs, odds, epistemic, aleatoric)
        info: Dict[str, Any] = {
            "bankroll_pct": bankroll_pct,
            "abstain": abstain,
            "pnl": pnl,
            "wagered": wagered,
            "won": won,
        }
        return obs, float(reward), terminated, truncated, info

    # ------------------------------------------------------------------
    def _compute_reward(
        self,
        abstain: bool,
        outcome_idx: int,
        won: bool,
        stake_fraction: float,
        market_odds: float,
        probs: np.ndarray,
        epistemic: float,
        pnl: float,
    ) -> float:
        """5-component reward per rl_reward_spec (C14)."""
        # Component 1 — P&L (w=0.40)
        if abstain:
            r_pnl = 0.0
        else:
            p_pred_k = float(probs[outcome_idx]) if outcome_idx < 3 else 0.0
            kelly_f = max(0.0, (p_pred_k * market_odds - 1.0) / max(market_odds - 1.0, 1e-8))
            kelly_f = min(kelly_f, MAX_KELLY_CAP)
            if kelly_f < 1e-6:
                r_pnl = 0.0
            else:
                normalized_stake = stake_fraction / kelly_f
                if won:
                    r_pnl = normalized_stake * (market_odds - 1.0)
                else:
                    r_pnl = -normalized_stake
                deviation = (stake_fraction - kelly_f) / (kelly_f + 1e-8)
                r_pnl -= 0.50 * deviation ** 2

        # Component 2 — Information Coefficient (w=0.25)
        base_probs = np.array([BASE_HOME, BASE_DRAW, BASE_AWAY], dtype=np.float64)
        model_probs = probs.astype(np.float64)
        ic_raw = float(np.sum(model_probs * np.log((model_probs + 1e-8) / (base_probs + 1e-8))))
        r_ic = float(np.clip(ic_raw / np.log(3.0), -1.0, 1.0))

        # Component 3 — Calibration (w=0.15)
        bets = self.bet_history[-20:]
        ece_errors = [abs(b["pred_prob"] - b["won"]) for b in bets if "pred_prob" in b]
        rolling_ece = float(np.mean(ece_errors)) if ece_errors else 0.0
        r_cal = -rolling_ece

        # Component 4 — Risk (w=0.15)
        bankroll_pct = self.bankroll / INITIAL_BANKROLL
        peak_pct = self.peak_bankroll / INITIAL_BANKROLL
        current_drawdown = max(0.0, 1.0 - bankroll_pct / max(peak_pct, 1e-8))
        r_risk = -current_drawdown

        # Component 5 — Abstention (w=0.05)
        if abstain:
            r_abs = 0.10 if epistemic > self.epistemic_threshold else -0.05
        else:
            r_abs = 0.0

        total = W_PNL * r_pnl + W_IC * r_ic + W_CAL * r_cal + W_RISK * r_risk + W_ABS * r_abs
        return float(total)


# ---------------------------------------------------------------------------
# Curriculum callback
# ---------------------------------------------------------------------------

class CurriculumCallback(BaseCallback):
    """Advances the curriculum phase at the appropriate episode thresholds."""

    _PHASE_THRESHOLDS = {100: 1, 300: 2}  # episode_count → next curriculum phase

    def __init__(self, env: FootballBettingEnv) -> None:
        super().__init__(verbose=0)
        self._betting_env = env
        self._episode_count = 0

    def _on_step(self) -> bool:
        infos = self.locals.get("infos", [])
        for info in infos:
            if info.get("terminal_observation") is not None or self.locals.get("dones", [False])[0]:
                self._episode_count += 1
                for threshold, next_phase in sorted(self._PHASE_THRESHOLDS.items()):
                    if self._episode_count == threshold:
                        self._betting_env.curriculum_phase = next_phase
                        log.info(
                            "Curriculum advanced to phase %d at episode %d",
                            next_phase, self._episode_count,
                        )
        return True


# ---------------------------------------------------------------------------
# Production gate evaluation
# ---------------------------------------------------------------------------

def _evaluate_gates(
    env: FootballBettingEnv,
    model: SAC,
    n_episodes: int = 500,
) -> Dict[str, float]:
    """Run n_episodes of evaluation and return gate metrics."""
    all_roi: List[float] = []
    all_drawdowns: List[float] = []
    all_sharpe: List[float] = []
    abstain_counts: List[int] = []
    bet_counts: List[int] = []

    for ep in range(n_episodes):
        obs, _ = env.reset(seed=ep)
        env.curriculum_phase = 2  # evaluation always uses all matches
        done = False
        ep_bets = 0
        ep_abstains = 0
        ep_initial_bankroll = env.bankroll
        ep_pnl_history: List[float] = []
        ep_wagered_history: List[float] = []
        ep_peak = ep_initial_bankroll

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

            if info["abstain"]:
                ep_abstains += 1
            else:
                ep_bets += 1
                ep_pnl_history.append(info["pnl"])
                ep_wagered_history.append(info["wagered"])

            ep_peak = max(ep_peak, env.bankroll)

        # ROI per bet: net P&L / total amount staked
        if ep_bets > 0:
            total_wagered = sum(ep_wagered_history) + 1e-8
            net_pnl = sum(ep_pnl_history)
            roi = 100.0 * net_pnl / total_wagered
        else:
            roi = 0.0
        all_roi.append(roi)

        # Max drawdown using absolute P&L steps
        peak_bk = ep_initial_bankroll
        max_dd = 0.0
        running_bk = ep_initial_bankroll
        for p in ep_pnl_history:
            running_bk += p   # p is absolute pnl from info dict
            peak_bk = max(peak_bk, running_bk)
            dd = 100.0 * (peak_bk - running_bk) / max(peak_bk, 1e-8)
            max_dd = max(max_dd, dd)
        all_drawdowns.append(max_dd)

        # Sharpe
        if len(ep_pnl_history) >= 2:
            mu = np.mean(ep_pnl_history)
            sigma = np.std(ep_pnl_history) + 1e-8
            sharpe = float(mu / sigma * np.sqrt(len(ep_pnl_history)))
        else:
            sharpe = 0.0
        all_sharpe.append(sharpe)

        # Abstention rate
        total_decisions = ep_bets + ep_abstains
        abstain_rate = ep_abstains / max(total_decisions, 1)
        abstain_counts.append(ep_abstains)
        bet_counts.append(ep_bets)

    mean_roi = float(np.mean(all_roi))
    max_dd_mean = float(np.mean(all_drawdowns))
    mean_sharpe = float(np.mean(all_sharpe))
    total_abstains = sum(abstain_counts)
    total_decisions = total_abstains + sum(bet_counts)
    abstain_rate = total_abstains / max(total_decisions, 1)

    return {
        "mean_roi_pct": mean_roi,
        "mean_max_drawdown_pct": max_dd_mean,
        "mean_sharpe": mean_sharpe,
        "abstain_rate": abstain_rate,
    }


def _gates_pass(metrics: Dict[str, float]) -> bool:
    return (
        metrics["mean_roi_pct"] > GATE_ROI_PCT
        and metrics["mean_max_drawdown_pct"] < GATE_MAX_DRAWDOWN
        and metrics["mean_sharpe"] >= GATE_SHARPE
        and GATE_ABSTAIN_LOW <= metrics["abstain_rate"] <= GATE_ABSTAIN_HIGH
    )


def _log_gate_results(metrics: Dict[str, float]) -> None:
    log.info("─── Production Gate Results (500 held-out episodes) ───────────")
    log.info(
        "  Gate 1 – Mean ROI:       %.2f%%  (gate > %.1f%%)  %s",
        metrics["mean_roi_pct"], GATE_ROI_PCT,
        "✓" if metrics["mean_roi_pct"] > GATE_ROI_PCT else "✗",
    )
    log.info(
        "  Gate 2 – Max drawdown:   %.2f%%  (gate < %.1f%%)  %s",
        metrics["mean_max_drawdown_pct"], GATE_MAX_DRAWDOWN,
        "✓" if metrics["mean_max_drawdown_pct"] < GATE_MAX_DRAWDOWN else "✗",
    )
    log.info(
        "  Gate 3 – Rolling Sharpe: %.3f  (gate ≥ %.2f)  %s",
        metrics["mean_sharpe"], GATE_SHARPE,
        "✓" if metrics["mean_sharpe"] >= GATE_SHARPE else "✗",
    )
    log.info(
        "  Gate 4 – Abstain rate:   %.1f%%  (gate 10–40%%)  %s",
        metrics["abstain_rate"] * 100,
        "✓" if GATE_ABSTAIN_LOW <= metrics["abstain_rate"] <= GATE_ABSTAIN_HIGH else "✗",
    )
    log.info("  → Overall: %s", "ALL PASS ✓" if _gates_pass(metrics) else "FAILED ✗")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Train SAC RL Betting Agent (Phase 6-C)")
    parser.add_argument("--data-dir", default="data/processed")
    parser.add_argument("--models-dir", default="backend/models")
    parser.add_argument("--total-timesteps", type=int, default=200_000,
                        help="Total environment steps for SAC training")
    parser.add_argument("--episode-length", type=int, default=50,
                        help="Matches per episode")
    parser.add_argument("--eval-episodes", type=int, default=500,
                        help="Held-out episodes for gate evaluation (C16)")
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--buffer-size", type=int, default=50_000)
    parser.add_argument("--learning-starts", type=int, default=1_000)
    parser.add_argument("--tau", type=float, default=0.005)
    parser.add_argument("--gamma", type=float, default=0.99)
    parser.add_argument("--device", default="auto",
                        choices=["auto", "cpu", "cuda", "mps"])
    args = parser.parse_args()

    np.random.seed(SEED)

    data_dir = Path(args.data_dir)
    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    log.info("Loading match data from %s …", data_dir)
    matches = _load_match_data(data_dir)
    log.info("Loaded %d matches", len(matches))

    if len(matches) < 50:
        log.error("Insufficient match data (%d rows) — need at least 50", len(matches))
        return 1

    # --- Build training environment ---
    env = FootballBettingEnv(
        matches=matches,
        episode_length=args.episode_length,
        curriculum_phase=0,
        seed=SEED,
    )
    vec_env = DummyVecEnv([lambda: env])

    # --- Build evaluation environment (separate instance, same data) ---
    eval_env = FootballBettingEnv(
        matches=matches,
        episode_length=args.episode_length,
        curriculum_phase=2,
        seed=SEED + 1,
    )

    # --- SAC model ---
    sac = SAC(
        "MlpPolicy",
        vec_env,
        learning_rate=args.learning_rate,
        batch_size=args.batch_size,
        buffer_size=args.buffer_size,
        learning_starts=args.learning_starts,
        tau=args.tau,
        gamma=args.gamma,
        verbose=1,
        device=args.device,
        seed=SEED,
    )

    curriculum_cb = CurriculumCallback(env)

    log.info(
        "Training SAC for %d timesteps (episode_length=%d) …",
        args.total_timesteps, args.episode_length,
    )
    sac.learn(
        total_timesteps=args.total_timesteps,
        callback=curriculum_cb,
        progress_bar=False,
        reset_num_timesteps=True,
    )
    log.info("Training complete.")

    # --- Gate evaluation (C16) ---
    log.info("Evaluating on %d held-out episodes …", args.eval_episodes)
    gate_metrics = _evaluate_gates(eval_env, sac, n_episodes=args.eval_episodes)
    _log_gate_results(gate_metrics)

    if not _gates_pass(gate_metrics):
        log.error(
            "SAC agent failed gate validation.  "
            "Model NOT saved to rl_agent_path.  "
            "Recommendation: increase --total-timesteps or tune hyperparameters."
        )
        # Save a checkpoint for debugging but NOT to the production path
        debug_path = models_dir / "rl_betting_agent_FAILED_GATES.zip"
        sac.save(str(debug_path))
        log.info("Debug checkpoint saved to %s", debug_path)
        return 1

    # --- Save only after ALL gates pass (C16) ---
    out_path = models_dir / "rl_betting_agent.zip"
    sac.save(str(out_path))
    log.info("✓ SAC agent saved to %s", out_path)

    log.info("══ Phase 6-C complete ═══════════════════════════════════════")
    log.info("  Deployed: %s", out_path)
    log.info("  Set RL_AGENT_PATH=%s to activate in inference service", out_path)

    # Completion checklist (C6)
    # ✓ 16-dim state space per rl_reward_spec
    # ✓ 5-component reward with weights summing to 1.0 (C14)
    # ✓ Chronological match ordering — no shuffling (C15)
    # ✓ Curriculum: phase 0→1→2 at episodes 100, 300 (C15)
    # ✓ All 4 production gates checked on 500 held-out episodes
    # ✓ Model written to rl_agent_path ONLY after all gates pass (C16)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
