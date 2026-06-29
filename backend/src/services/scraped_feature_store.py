"""Read-only bridge from validated Node scraper artifacts to model features.

The Node scraper writes normalized team-form JSON under
``data/processed/node-scraper``. This module performs no network access and
never manufactures values. Records are accepted only when their schema,
result counts, derived PPG, source date, and prediction cutoff are coherent.
"""

from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]


def _default_processed_root() -> Path:
    candidates = (
        _REPO_ROOT / "data" / "processed" / "node-scraper",
        Path.cwd() / "data" / "processed" / "node-scraper",
    )
    return next((candidate for candidate in candidates if candidate.exists()), candidates[0])
_SUPPORTED_COMPETITIONS = {
    "EPL",
    "LA_LIGA",
    "SERIE_A",
    "BUNDESLIGA",
    "LIGUE_1",
}
_COMPETITION_ALIASES = {
    "PREMIER_LEAGUE": "EPL",
    "LA_LIGA": "LA_LIGA",
    "LALIGA": "LA_LIGA",
    "SERIE_A": "SERIE_A",
    "BUNDESLIGA": "BUNDESLIGA",
    "LIGUE_1": "LIGUE_1",
}


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def _competition_slug(value: str) -> str | None:
    slug = re.sub(r"[^A-Z0-9]+", "_", value.upper()).strip("_")
    slug = _COMPETITION_ALIASES.get(slug, slug)
    return slug if slug in _SUPPORTED_COMPETITIONS else None


def _parse_date(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except ValueError:
        return None


def _finite_number(item: dict[str, Any], field: str) -> float | None:
    value = item.get(field)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    parsed = float(value)
    return parsed if math.isfinite(parsed) else None


@dataclass(frozen=True)
class ScrapedTeamForm:
    team: str
    matches_sampled: int
    ppg: float
    wins: int
    draws: int
    losses: int
    goals_for_avg: float
    goals_against_avg: float
    goal_difference_avg: float
    latest_match_date: datetime
    source_file: Path

    def to_projection_stats(self) -> dict[str, float]:
        return {
            "ppg_5": self.ppg,
            "wins_5": float(self.wins),
            "draws_5": float(self.draws),
            "losses_5": float(self.losses),
            "goals_for_avg_5": self.goals_for_avg,
            "goals_against_avg_5": self.goals_against_avg,
            "gd_avg_5": self.goal_difference_avg,
            # Compatibility keys retained for legacy adapters. The canonical
            # projector remaps these into side-specific model features.
            "home_form_5": self.ppg / 3.0,
            "home_win_rate_5": self.wins / self.matches_sampled,
            "home_goals_per_match_5": self.goals_for_avg,
            "home_goals_conceded_per_match_5": self.goals_against_avg,
            "home_gd_avg_5": self.goal_difference_avg,
        }


class ScrapedTeamFormStore:
    """Load the newest validated team-form artifact for a competition."""

    def __init__(self, root: str | Path | None = None) -> None:
        configured = root or os.getenv("SCRAPER_PROCESSED_ROOT")
        self.root = Path(configured).expanduser().resolve() if configured else _default_processed_root().resolve()

    def get_team_form(
        self,
        *,
        competition: str,
        team: str,
        information_cutoff: datetime | None = None,
    ) -> ScrapedTeamForm | None:
        competition_slug = _competition_slug(competition)
        if competition_slug is None or not self.root.exists():
            return None

        cutoff = information_cutoff
        if cutoff is not None and cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=timezone.utc)

        files = sorted(
            self.root.glob(f"team-form-{competition_slug}-*.json"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        target = _norm(team)

        for path in files:
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(payload, list):
                continue
            for item in payload:
                if not isinstance(item, dict) or _norm(str(item.get("team") or "")) != target:
                    continue
                record = self._parse_record(item, path)
                if record is None:
                    continue
                # Strict point-in-time rule: evidence on or after kickoff is not
                # available to the prediction being assembled.
                if cutoff is not None and record.latest_match_date >= cutoff:
                    continue
                return record
        return None

    @staticmethod
    def _parse_record(item: dict[str, Any], path: Path) -> ScrapedTeamForm | None:
        numeric_fields = (
            "matches_sampled",
            "ppg",
            "wins",
            "draws",
            "losses",
            "goals_for_avg",
            "goals_against_avg",
            "goal_difference_avg",
        )
        values: dict[str, float] = {}
        for field in numeric_fields:
            value = _finite_number(item, field)
            if value is None:
                return None
            values[field] = value

        count_fields = ("matches_sampled", "wins", "draws", "losses")
        if any(not values[field].is_integer() for field in count_fields):
            return None

        matches = int(values["matches_sampled"])
        wins = int(values["wins"])
        draws = int(values["draws"])
        losses = int(values["losses"])
        ppg = float(values["ppg"])
        goals_for = float(values["goals_for_avg"])
        goals_against = float(values["goals_against_avg"])
        goal_difference = float(values["goal_difference_avg"])
        latest_match_date = _parse_date(item.get("latest_match_date"))

        if matches <= 0 or wins < 0 or draws < 0 or losses < 0:
            return None
        if wins + draws + losses != matches:
            return None
        if not 0.0 <= ppg <= 3.0 or goals_for < 0.0 or goals_against < 0.0:
            return None
        if abs(ppg - ((3 * wins + draws) / matches)) > 1e-6:
            return None
        if abs(goal_difference - (goals_for - goals_against)) > 1e-6:
            return None
        if latest_match_date is None:
            return None

        return ScrapedTeamForm(
            team=str(item.get("team") or ""),
            matches_sampled=matches,
            ppg=ppg,
            wins=wins,
            draws=draws,
            losses=losses,
            goals_for_avg=goals_for,
            goals_against_avg=goals_against,
            goal_difference_avg=goal_difference,
            latest_match_date=latest_match_date,
            source_file=path,
        )
