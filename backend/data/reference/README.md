# Drift reference artifacts

`baseline_v1.parquet` is deliberately **not committed or fabricated**. Generate
it from the production-compatible database only after the Phase 1 settlement
gate has been met:

```bash
cd backend
python -m pip install -r requirements.txt -r requirements-mlops.txt
PYTHONPATH=. python scripts/generate_reference_baseline.py
```

The generator:

- selects only score-verified settled fixtures;
- uses `UpcomingMatchFeatureProjector.build_live_feature_vector()`;
- excludes identifiers and targets;
- rejects reduced-evidence rows by default;
- writes the Parquet file atomically;
- writes `baseline_v1.manifest.json` with artifact/schema hashes, date range,
  league composition, code SHA, and skipped-row counts.

Never rename the template to `baseline_v1.manifest.json` and claim readiness.
The generated manifest must report `"status": "READY"` and its SHA-256 must
match the generated artifact.
