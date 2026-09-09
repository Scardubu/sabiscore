#!/bin/bash
# session-start-banner.sh — SessionStart banner.
#
# The previous version wrote to stderr. Claude Code's documented
# exception for SessionStart is plain *stdout* shown as context — stderr
# on exit 0 still only reaches the debug log. This writes to stdout, and
# resolves registry.json via ${CLAUDE_PROJECT_DIR} so it's correct
# regardless of the directory Claude Code started in.
set -euo pipefail

REGISTRY="${CLAUDE_PROJECT_DIR}/registry.json"
if [ -f "$REGISTRY" ]; then
  VERSION=$(jq -r '.suiteVersion // "unknown"' "$REGISTRY" 2>/dev/null || echo "unknown")
  SKILL_COUNT=$(jq -r '.skills | length' "$REGISTRY" 2>/dev/null || echo 0)
else
  VERSION="unknown"
  SKILL_COUNT=0
fi

echo "[NEXUS] Session started. Suite v${VERSION} | ${SKILL_COUNT} skills active."
exit 0
