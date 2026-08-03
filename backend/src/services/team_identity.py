"""Team-name identity resolution shared by feature-projection and fixture-sync.

Both callers previously did their own case-insensitive exact-match query, which
fails on short-name vs legal-name variants ("Arsenal" vs "Arsenal FC",
"Bournemouth" vs "AFC Bournemouth"). This adds an affix-stripped retry and,
failing that, falls back to the existing reconcile_team() fuzzy matcher
(providers/reconciliation.py) — already used by orchestrator.py for a different
purpose (API-Football provider-ID resolution), reused here unchanged.

Fails closed: true nicknames ("Spurs" for "Tottenham Hotspur") still resolve to
None rather than guess — documented limitation of reconcile_team() itself, not a
regression introduced here.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import Team
from ..providers.reconciliation import TeamCandidate, reconcile_team

_CLUB_AFFIXES = re.compile(r"^(afc|cf|1\.)\s+|\s+(fc|afc|cf|sc)$", flags=re.IGNORECASE)


def _strip_affixes(name: str) -> str:
    stripped = _CLUB_AFFIXES.sub("", name.strip()).strip()
    return stripped or name.strip()


async def resolve_team_id(name: str, db: AsyncSession) -> str | None:
    """Resolve a provider/user-supplied team name to a ``Team.id``, or ``None``.

    Order: exact case-insensitive match, then affix-stripped exact match, then
    reconcile_team()'s fuzzy matcher (VERIFIED only — REQUIRES_REVIEW/CONFLICTING/
    UNKNOWN all fail closed to None, same fail-closed convention orchestrator.py
    already uses for provider team IDs).
    """
    name = name.strip()
    if not name:
        return None

    rows = (await db.execute(select(Team.id, Team.name))).all()
    if not rows:
        return None

    lname = name.lower()
    for row_id, row_name in rows:
        if row_name.lower() == lname:
            return row_id

    normalized = _strip_affixes(name).lower()
    for row_id, row_name in rows:
        if _strip_affixes(row_name).lower() == normalized:
            return row_id

    candidates = [TeamCandidate(team_id=row_id, name=row_name) for row_id, row_name in rows]
    decision = reconcile_team(name, candidates)
    if decision.status == "VERIFIED" and decision.team_id:
        return decision.team_id
    return None
