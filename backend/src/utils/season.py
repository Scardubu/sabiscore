"""Single source of truth for the "YYYY/YYYY" season-string format.

Previously fixture_sync_service wrote a bare 4-digit year ("2026") while
upcoming_match_feature_service derived "2026/2027" independently — two
incompatible formats for the same Match.season concept, silently breaking any
future join/filter keyed on season.
"""

from __future__ import annotations

from datetime import datetime


def canonical_season(match_date: datetime) -> str:
    """European season label for a match date: Jul-Dec -> this/next year, Jan-Jun -> prev/this year."""
    year = match_date.year
    if match_date.month >= 7:
        return f"{year}/{year + 1}"
    return f"{year - 1}/{year}"
