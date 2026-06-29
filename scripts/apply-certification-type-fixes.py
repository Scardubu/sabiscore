from pathlib import Path

root = Path(__file__).resolve().parents[1]

store = root / "backend/src/services/scraped_feature_store.py"
source = store.read_text(encoding="utf-8")
old = '''        values = {field: _finite_number(item, field) for field in numeric_fields}
        if any(value is None for value in values.values()):
            return None

        count_fields = ("matches_sampled", "wins", "draws", "losses")
        if any(not values[field].is_integer() for field in count_fields):
            return None
'''
new = '''        values: dict[str, float] = {}
        for field in numeric_fields:
            value = _finite_number(item, field)
            if value is None:
                return None
            values[field] = value

        count_fields = ("matches_sampled", "wins", "draws", "losses")
        if any(not values[field].is_integer() for field in count_fields):
            return None
'''
if old not in source:
    raise SystemExit("scraped_feature_store.py no longer matches the reviewed source")
store.write_text(source.replace(old, new), encoding="utf-8")

projector = root / "backend/src/services/upcoming_match_feature_service.py"
source = projector.read_text(encoding="utf-8")
replacements = {
    '''        stats["home_goals_per_match_5"] = (
            np.mean(goals_for[:5]) if len(goals_for) >= 5 else np.mean(goals_for) if goals_for else 1.5
        )
''': '''        stats["home_goals_per_match_5"] = float(
            np.mean(goals_for[:5]) if len(goals_for) >= 5 else np.mean(goals_for) if goals_for else 1.5
        )
''',
    '''        stats["home_goals_conceded_per_match_5"] = (
            np.mean(goals_against[:5]) if len(goals_against) >= 5 else np.mean(goals_against) if goals_against else 1.2
        )
''': '''        stats["home_goals_conceded_per_match_5"] = float(
            np.mean(goals_against[:5]) if len(goals_against) >= 5 else np.mean(goals_against) if goals_against else 1.2
        )
''',
    '''        stats["home_gd_avg_5"] = np.mean(gd) if gd else 0.0
''': '''        stats["home_gd_avg_5"] = float(np.mean(gd)) if gd else 0.0
''',
    '''            stats["home_xg_avg_5"] = np.mean(xg_values[:5])
            stats["home_xg_consistency"] = np.std(xg_values[:5]) if len(xg_values) >= 5 else 0.75
''': '''            stats["home_xg_avg_5"] = float(np.mean(xg_values[:5]))
            stats["home_xg_consistency"] = (
                float(np.std(xg_values[:5])) if len(xg_values) >= 5 else 0.75
            )
''',
}
for old, new in replacements.items():
    if old not in source:
        raise SystemExit("upcoming_match_feature_service.py no longer matches the reviewed source")
    source = source.replace(old, new)
projector.write_text(source, encoding="utf-8")

Path(__file__).unlink()
