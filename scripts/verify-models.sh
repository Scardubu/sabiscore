#!/usr/bin/env bash
set -euo pipefail

# Simple verification script to ensure MODEL_BASE_URL is set and reachable
# and that at least one expected artifact exists. Intended to be used in CI
# to fail fast if production model artifacts are not accessible.

MODEL_BASE_URL="${MODEL_BASE_URL:-""}"
MODEL_FETCH_TOKEN="${MODEL_FETCH_TOKEN:-""}"

if [ -z "$MODEL_BASE_URL" ]; then
  echo "ERROR: MODEL_BASE_URL is not set. Set secrets.MODEL_BASE_URL in your CI/repo settings."
  exit 1
fi

if [[ "$MODEL_BASE_URL" != https://* ]]; then
  echo "ERROR: MODEL_BASE_URL must use https:// for production safety. Got: $MODEL_BASE_URL"
  exit 1
fi

AUTH_HEADER=()
if [ -n "$MODEL_FETCH_TOKEN" ]; then
  AUTH_HEADER=( -H "Authorization: Bearer $MODEL_FETCH_TOKEN" )
fi

echo "Verifying MODEL_BASE_URL: $MODEL_BASE_URL"

# Quick check: ensure base URL responds
if ! curl -fsS --head "${MODEL_BASE_URL%/}/" "${AUTH_HEADER[@]}" > /dev/null; then
  echo "ERROR: MODEL_BASE_URL is not reachable or returned non-2xx for HEAD: $MODEL_BASE_URL"
  exit 2
fi

# Check that at least one expected artifact exists (HEAD request)
EXAMPLE_ARTIFACT="models/epl_ensemble.pkl"
EXAMPLE_URL="${MODEL_BASE_URL%/}/$EXAMPLE_ARTIFACT"
echo "Checking example artifact: $EXAMPLE_URL"
if ! curl -fsS --head "${EXAMPLE_URL}" "${AUTH_HEADER[@]}" > /dev/null; then
  echo "ERROR: Example artifact not found or inaccessible: $EXAMPLE_URL"
  echo "If your storage requires signed URLs or a token, provide MODEL_FETCH_TOKEN as a secret."
  exit 3
fi

echo "MODEL_BASE_URL verification passed. Artifacts appear available."
exit 0
