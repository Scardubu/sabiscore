"""Canonical fixture reconciliation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher


@dataclass(frozen=True)
class FixtureCandidate:
    fixture_id: str
    competition: str
    home_team: str
    away_team: str
    kickoff_utc: datetime
    provider: str
    provider_event_id: str


@dataclass(frozen=True)
class ReconciliationDecision:
    status: str
    confidence: float
    fixture_id: str | None
    reason: str


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left.lower().strip(), right.lower().strip()).ratio()


def reconcile_fixture(
    provider_record: FixtureCandidate,
    candidates: list[FixtureCandidate],
    *,
    kickoff_tolerance_minutes: int = 90,
    auto_accept_threshold: float = 0.94,
) -> ReconciliationDecision:
    scored: list[tuple[float, FixtureCandidate]] = []
    provider_kickoff = provider_record.kickoff_utc
    if provider_kickoff.tzinfo is None:
        provider_kickoff = provider_kickoff.replace(tzinfo=timezone.utc)

    for candidate in candidates:
        if candidate.competition != provider_record.competition:
            continue
        kickoff = candidate.kickoff_utc
        if kickoff.tzinfo is None:
            kickoff = kickoff.replace(tzinfo=timezone.utc)
        minutes = abs((kickoff - provider_kickoff).total_seconds()) / 60
        if minutes > kickoff_tolerance_minutes:
            continue
        score = (
            _similarity(provider_record.home_team, candidate.home_team) * 0.4
            + _similarity(provider_record.away_team, candidate.away_team) * 0.4
            + max(0.0, 1.0 - minutes / kickoff_tolerance_minutes) * 0.2
        )
        scored.append((round(score, 4), candidate))

    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return ReconciliationDecision("UNKNOWN", 0.0, None, "no_candidate")
    if len(scored) > 1 and abs(scored[0][0] - scored[1][0]) < 0.03:
        return ReconciliationDecision("CONFLICTING", scored[0][0], None, "ambiguous_candidate")
    if scored[0][0] < auto_accept_threshold:
        return ReconciliationDecision("UNKNOWN", scored[0][0], None, "below_auto_accept_threshold")
    return ReconciliationDecision("VERIFIED", scored[0][0], scored[0][1].fixture_id, "matched_by_identity_and_kickoff")
