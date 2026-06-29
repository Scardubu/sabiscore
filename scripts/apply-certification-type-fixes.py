"""Narrow betting-intelligence runtime contracts for certified MyPy coverage."""

from pathlib import Path

path = Path("backend/src/services/betting_intelligence.py")
text = path.read_text()
replacements = [
    (
        "from typing import Any, Dict, List, Optional, Tuple\n",
        "from typing import Any, Dict, List, Optional, Tuple, cast\n",
    ),
    (
        'results.sort(key=lambda r: r["confidence_adjusted_value"], reverse=True)',
        'results.sort(key=lambda r: cast(float, r["confidence_adjusted_value"]), reverse=True)',
    ),
    (
        '''            overround, fair_h, fair_d, fair_a = _compute_devig(\n                market.home_odds, market.draw_odds, market.away_odds\n            )\n            if overround > float(policy["max_market_overround"]) or overround < float(policy["min_market_overround"]):\n                gaps.append(\n                    f"DATA_GAP: market_overround_outside_integrity_limits ({overround:.4f})"\n                )\n''',
        '''            validation_overround, _, _, _ = _compute_devig(\n                market.home_odds, market.draw_odds, market.away_odds\n            )\n            if validation_overround > float(policy["max_market_overround"]) or validation_overround < float(policy["min_market_overround"]):\n                gaps.append(\n                    f"DATA_GAP: market_overround_outside_integrity_limits ({validation_overround:.4f})"\n                )\n''',
    ),
    (
        "    if verdict not in (VerdictEnum.PARTIAL, VerdictEnum.NO_BET, VerdictEnum.HOLD) and best_eval:\n",
        '''    if (\n        verdict not in (VerdictEnum.PARTIAL, VerdictEnum.NO_BET, VerdictEnum.HOLD)\n        and best_eval\n        and model is not None\n        and market is not None\n    ):\n''',
    ),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise RuntimeError(f"betting-intelligence contract no longer matches: {old!r}")
    text = text.replace(old, new, 1)
path.write_text(text)
Path(__file__).unlink()
