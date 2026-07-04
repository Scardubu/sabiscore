#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SOURCE="$ROOT/.ai/skills"
PARENT="$ROOT/.agents"
DEST="$PARENT/skills"

if [[ ! -d "$SOURCE" ]]; then
  echo "error: canonical skill directory not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$PARENT"

if [[ -L "$DEST" ]]; then
  CURRENT="$(readlink "$DEST")"
  if [[ "$CURRENT" == "../.ai/skills" ]]; then
    echo "Codex skill bridge already configured: $DEST -> $CURRENT"
    exit 0
  fi
  echo "error: $DEST is a symlink to $CURRENT; refusing to replace it" >&2
  exit 1
fi

if [[ -e "$DEST" ]]; then
  echo "error: $DEST already exists and is not the expected symlink." >&2
  echo "Back it up or remove it, then rerun this script." >&2
  exit 1
fi

ln -s ../.ai/skills "$DEST"
echo "Created Codex skill bridge: $DEST -> ../.ai/skills"
echo "Restart Codex/VS Code if /skills does not refresh automatically."
