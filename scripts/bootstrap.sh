#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"
PYTHON_CMD="${PYTHON:-python}"

echo "SabiScore production bootstrap"
echo "=============================="

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required." >&2
    exit 1
  fi
}

require_tool pnpm
require_tool docker
require_tool "$PYTHON_CMD"

echo "[1/7] Verifying canonical workspace"
if [ ! -f "apps/api/LEGACY_ARCHIVED" ] || [ ! -f "frontend/LEGACY_ARCHIVED" ]; then
  echo "Legacy archive markers are required for apps/api and frontend." >&2
  exit 1
fi

echo "[2/7] Installing workspace dependencies"
pnpm install --frozen-lockfile

echo "[3/7] Preparing Python virtual environment"
if [ ! -d ".venv" ]; then
  "$PYTHON_CMD" -m venv .venv
fi

if [ -x ".venv/bin/python" ]; then
  VENV_PYTHON="$ROOT_DIR/.venv/bin/python"
else
  VENV_PYTHON="$ROOT_DIR/.venv/Scripts/python.exe"
fi

"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r backend/requirements.txt

echo "[4/7] Starting PostgreSQL and Redis"
docker compose up -d postgres redis

echo "[5/7] Running Alembic migrations"
(
  cd backend
  "$VENV_PYTHON" -m alembic upgrade head
)

echo "[6/7] Starting backend and web containers"
docker compose up -d backend web

echo "[7/7] Checking service endpoints"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://localhost:${API_PORT}/health/live" >/dev/null
  curl -fsS "http://localhost:${API_PORT}/health/ready" >/dev/null || {
    echo "Readiness is not green yet. Check: docker compose logs backend" >&2
    exit 1
  }
else
  echo "curl not found; skipping endpoint smoke checks."
fi

cat <<SUMMARY

Bootstrap complete.

Local services:
  Backend API: http://localhost:${API_PORT}
  Web app:     http://localhost:${WEB_PORT}
  PostgreSQL:  localhost:${POSTGRES_PORT}
  Redis:       localhost:${REDIS_PORT}

Useful commands:
  docker compose ps
  docker compose logs -f backend
  pnpm --filter @sabiscore/web dev
SUMMARY
