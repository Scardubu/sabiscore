"""ESPN canonical competition mappings.

ESPN exposes football data under per-league path slugs (e.g. ``eng.1``).
SabiScore works in canonical competition codes. This module is the single
source of truth for translating between the two, and it is intentionally
*closed*: a competition that is not declared here is not supported by the
ESPN provider, and callers must fail closed rather than guess a slug.

Canonical authority: SABISCORE_PRODUCTION_SETUP_GUIDE.md (7-competition set).
"""

from __future__ import annotations

from enum import Enum
from types import MappingProxyType
from typing import Final


class Competition(str, Enum):
    """Canonical SabiScore competition codes supported by ESPN discovery."""

    EPL = "EPL"
    LA_LIGA = "LA_LIGA"
    SERIE_A = "SERIE_A"
    BUNDESLIGA = "BUNDESLIGA"
    LIGUE_1 = "LIGUE_1"
    EREDIVISIE = "EREDIVISIE"
    UCL = "UCL"


# Canonical code -> ESPN league slug. Immutable on purpose.
_ESPN_SLUG_BY_COMPETITION: Final = MappingProxyType(
    {
        Competition.EPL: "eng.1",
        Competition.LA_LIGA: "esp.1",
        Competition.SERIE_A: "ita.1",
        Competition.BUNDESLIGA: "ger.1",
        Competition.LIGUE_1: "fra.1",
        Competition.EREDIVISIE: "ned.1",
        Competition.UCL: "uefa.champions",
    }
)

# Reverse lookup, built once.
_COMPETITION_BY_ESPN_SLUG: Final = MappingProxyType(
    {slug: comp for comp, slug in _ESPN_SLUG_BY_COMPETITION.items()}
)

# Competitions where ESPN may only ever act as supplementary/keyless context.
# UCL additionally carries the soft-coverage cap enforced by the betting engine;
# ESPN never lifts that cap.
SUPPLEMENTARY_ONLY: Final[frozenset[Competition]] = frozenset(Competition)


class UnsupportedCompetitionError(ValueError):
    """Raised when a competition has no ESPN mapping. Callers must fail closed."""


def espn_slug(competition: Competition | str) -> str:
    """Return the ESPN slug for a canonical competition.

    Fails closed: unknown competitions raise rather than returning a guess.
    """
    comp = _coerce(competition)
    try:
        return _ESPN_SLUG_BY_COMPETITION[comp]
    except KeyError as exc:  # pragma: no cover - guarded by _coerce
        raise UnsupportedCompetitionError(
            f"No ESPN slug for competition {comp!r}"
        ) from exc


def competition_from_slug(slug: str) -> Competition:
    """Return the canonical competition for an ESPN slug. Fails closed."""
    try:
        return _COMPETITION_BY_ESPN_SLUG[slug]
    except KeyError as exc:
        raise UnsupportedCompetitionError(
            f"Unrecognized ESPN league slug {slug!r}"
        ) from exc


def supported_competitions() -> tuple[Competition, ...]:
    """All competitions ESPN can discover, in declaration order."""
    return tuple(_ESPN_SLUG_BY_COMPETITION.keys())


def _coerce(competition: Competition | str) -> Competition:
    if isinstance(competition, Competition):
        return competition
    try:
        return Competition(competition)
    except ValueError as exc:
        raise UnsupportedCompetitionError(
            f"{competition!r} is not a canonical SabiScore competition"
        ) from exc
