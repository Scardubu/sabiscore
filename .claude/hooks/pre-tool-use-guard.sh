#!/bin/bash
# pre-tool-use-guard.sh — PreToolUse gate for the Bash tool.
#
# Replaces the previous check against $CLAUDE_TOOL_INPUT_COMMAND, which is
# not a real Claude Code hook variable — hook input arrives as JSON on
# stdin (docs.claude.com/en/docs/claude-code/hooks). That version never
# matched anything. The permissions.deny entries for "DROP TABLE"/
# "DELETE FROM" have the mirror-image problem: they pattern-match the
# outer Bash command's first token, but SQL is passed as a *string
# argument* to psql/sqlite3/mysql, not run as a top-level command — so
# this hook also does that check, on the actual command text, regardless
# of which binary is running it.
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

if echo "$COMMAND" | grep -qiE '(rm[[:space:]]+-rf|rm[[:space:]]+-r[[:space:]]+-f|sudo[[:space:]]|curl[^|]*\|[[:space:]]*(bash|sh)|wget[^|]*\|[[:space:]]*(bash|sh)|npx[^|]*\|[[:space:]]*(bash|sh))'; then
  echo "[SCAR GUARD] Blocked destructive/pipe-to-shell pattern: $COMMAND" >&2
  exit 2
fi

if echo "$COMMAND" | grep -qiE '\b(DROP[[:space:]]+TABLE|DELETE[[:space:]]+FROM|TRUNCATE[[:space:]]+TABLE)\b'; then
  echo "[SCAR GUARD] Blocked destructive SQL pattern inside command text: $COMMAND" >&2
  exit 2
fi

exit 0
