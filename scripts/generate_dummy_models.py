#!/usr/bin/env python3
"""
generate_dummy_models.py — REMOVED

This repository has removed the development-only dummy model generator to
enforce production-grade artifacts. If you are a developer who previously
relied on this script for quick local testing, please do one of the following:

- Provide real, validated model artifacts under `backend/models` or the
  repository `models/` directory and validate them with
  `python scripts/validate_models.py --models-dir ./models`.
- Configure `MODEL_BASE_URL` in your environment/CI so the backend fetches
  artifacts during startup (recommended for CI / integration tests).

If you need a temporary lightweight test artifact for isolated local runs,
create them outside of repository (do NOT commit them) or use a dedicated
dev-only branch where such generators are explicitly allowed.
"""

import sys

print("This repository no longer supports generate_dummy_models.py.\n" \
      "Provide real model artifacts or set MODEL_BASE_URL.\n")
sys.exit(2)
