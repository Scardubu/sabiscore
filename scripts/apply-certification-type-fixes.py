"""Use typed closures for enriched, lineup, and market provider calls."""

from pathlib import Path

path = Path("backend/src/providers/orchestrator.py")
text = path.read_text()
changes = [
    (
        "lambda a=apif, c=competition: a.injuries(competition=c)",
        "lambda: apif.injuries(competition=competition)",
    ),
    (
        'lambda a=apif, c=competition: a.lineups(fixture_id=fixture.get("provider_event_id"), competition=c)',
        'lambda: apif.lineups(fixture_id=fixture.get("provider_event_id"), competition=competition)',
    ),
    (
        "lambda a=apif, c=competition: a.teams(competition=c)",
        "lambda: apif.teams(competition=competition)",
    ),
    (
        "lambda s=sm, c=competition: s.injuries(competition=c)",
        "lambda: sm.injuries(competition=competition)",
    ),
    (
        "lambda a=apif, fid=fixture_id: a.lineups(fixture_id=fid)",
        "lambda: apif.lineups(fixture_id=fixture_id)",
    ),
    (
        "lambda s=sm, fid=fixture_id: s.lineups(fixture_id=fid)",
        "lambda: sm.lineups(fixture_id=fixture_id)",
    ),
]
for old, new in changes:
    if text.count(old) != 1:
        raise RuntimeError(f"provider closure no longer matches: {old}")
    text = text.replace(old, new, 1)

old_team = '''            result = await _safe_call(
                lambda a=apif, tid=int(decision.team_id), c=competition: a.team_statistics(team_id=tid, competition=c),
'''
new_team = '''            resolved_team_id = int(decision.team_id)
            result = await _safe_call(
                lambda: apif.team_statistics(team_id=resolved_team_id, competition=competition),
'''
if text.count(old_team) != 1:
    raise RuntimeError("team-statistics closure no longer matches")
text = text.replace(old_team, new_team, 1)

old_odds = '''            lambda o=odds_api, c=competition: o.odds(
                competition=c,
'''
new_odds = '''            lambda: odds_api.odds(
                competition=competition,
'''
if text.count(old_odds) != 1:
    raise RuntimeError("market-refresh closure no longer matches")
text = text.replace(old_odds, new_odds, 1)

path.write_text(text)
Path(__file__).unlink()
