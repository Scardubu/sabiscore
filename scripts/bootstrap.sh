#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "SabiScore bootstrap"
echo "==================="

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install it with corepack enable or your package manager." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for PostgreSQL and Redis." >&2
  exit 1
fi

python_cmd="${PYTHON:-python}"
if ! command -v "$python_cmd" >/dev/null 2>&1; then
  echo "Python 3.11 is required." >&2
  exit 1
fi

echo "[1/5] Installing workspace dependencies"
pnpm install --frozen-lockfile

echo "[2/5] Preparing Python virtual environment"
if [ ! -d ".venv" ]; then
  "$python_cmd" -m venv .venv
fi

if [ -x ".venv/bin/python" ]; then
  venv_python=".venv/bin/python"
else
  venv_python=".venv/Scripts/python.exe"
fi
venv_python_abs="$ROOT_DIR/$venv_python"

"$venv_python_abs" -m pip install --upgrade pip
"$venv_python_abs" -m pip install -r backend/requirements.txt

echo "[3/5] Starting PostgreSQL and Redis"
docker compose up -d postgres redis

echo "[4/5] Running Alembic migrations"
(
  cd backend
  "$venv_python_abs" -m alembic upgrade head
)

echo "[5/5] Bootstrap complete"
cat <<SUMMARY

Local services:
  Backend API: http://localhost:${API_PORT:-8000}
  Web app:     http://localhost:${WEB_PORT:-3000}
  PostgreSQL:  localhost:${POSTGRES_PORT:-5432}
  Redis:       localhost:${REDIS_PORT:-6379}

Run backend:
  cd backend && "$venv_python_abs" -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

Run web:
  pnpm --filter @sabiscore/web dev
SUMMARY
