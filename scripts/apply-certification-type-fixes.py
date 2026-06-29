from pathlib import Path

path = Path("backend/src/services/upcoming_match_feature_service.py")
text = path.read_text()
old = '"features_dict": {f: float(features_array[i]) for i, f in enumerate(self.canonical_features)},'
new = '"features_dict": {f: round(float(features_array[i]), 6) for i, f in enumerate(self.canonical_features)},'
if text.count(old) != 1:
    raise RuntimeError("feature serialization contract changed")
path.write_text(text.replace(old, new, 1))
Path(__file__).unlink()
