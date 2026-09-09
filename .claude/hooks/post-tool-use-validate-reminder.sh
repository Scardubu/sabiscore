#!/bin/bash
# post-tool-use-validate-reminder.sh — PostToolUse gate for Edit|Write|MultiEdit.
#
# The previous version wrote to stderr and exited 0 — on exit 0, stderr
# goes to the debug log only, never the transcript, never Claude. This
# version returns hookSpecificOutput.additionalContext, which Claude Code
# documents as surfacing "next to the tool result" for PostToolUse and
# reaching Claude on its next turn, so it can actually act on the
# reminder instead of it evaporating into --debug output.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

jq -n --arg path "$FILE_PATH" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("File modified: " + $path + " — run `make validate` before considering this change complete.")
  }
}'
exit 0
