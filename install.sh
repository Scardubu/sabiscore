#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# install.sh — SCAR Skill Suite v2.0 Installer
# Idempotent. Safe to re-run. Never overwrites without --force.
# Usage:
#   ./install.sh             Install all skills to ~/.claude/skills/
#   ./install.sh --force     Overwrite existing skill files
#   ./install.sh --dry-run   Preview actions without making changes
#   ./install.sh --validate  Run validation only, no install
#   ./install.sh --user-only Install to user scope only (skip project .claude/)
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

# ── Constants ──────────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REGISTRY="${SCRIPT_DIR}/registry.json"
readonly SCHEMA="${SCRIPT_DIR}/registry.schema.json"
readonly SKILLS_SRC="${SCRIPT_DIR}/.ai/skills"
readonly CLAUDE_SKILLS_SRC="${SCRIPT_DIR}/.claude/skills"

readonly USER_SKILLS_DIR="${HOME}/.claude/skills"
readonly USER_SETTINGS="${HOME}/.claude/settings.json"
readonly PROJECT_SETTINGS="${SCRIPT_DIR}/.claude/settings.json"
readonly LOG_FILE="${SCRIPT_DIR}/.install.log"

readonly VERSION="2.0.0"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# ── Flags ──────────────────────────────────────────────────────────────────────
FORCE=false
DRY_RUN=false
VALIDATE_ONLY=false
USER_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --force)       FORCE=true       ;;
    --dry-run)     DRY_RUN=true     ;;
    --validate)    VALIDATE_ONLY=true ;;
    --user-only)   USER_ONLY=true   ;;
    --help|-h)
      grep "^# " "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "[ERROR] Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# ── Colours ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[INSTALL]${RESET} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}[  OK  ]${RESET} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[ WARN ]${RESET} $*" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[ FAIL ]${RESET} $*" | tee -a "$LOG_FILE"; }
dry()  { echo -e "${YELLOW}[DRY-RUN]${RESET} Would: $*"; }

# Safe idempotent file copy: skip if same content, backup if different and --force
copy_skill() {
  local src="$1" dst="$2"

  if [[ "$DRY_RUN" == true ]]; then
    dry "Copy $src → $dst"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [[ -f "$dst" ]]; then
    if cmp -s "$src" "$dst"; then
      ok "Unchanged: $(basename "$dst")"
      return
    fi
    if [[ "$FORCE" == false ]]; then
      warn "Exists (different): $dst — use --force to overwrite"
      return
    fi
    # Backup existing before overwrite
    local backup="${dst}.bak.${TIMESTAMP}"
    cp "$dst" "$backup"
    warn "Backed up existing → $(basename "$backup")"
  fi

  cp "$src" "$dst"
  ok "Installed: $(basename "$dst")"
}

# ── Phase 0: Preflight ────────────────────────────────────────────────────────
preflight() {
  log "Running preflight checks…"

  # Required tools
  local missing=()
  for tool in jq node npx; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Missing required tools: ${missing[*]}"
    echo "  Install with:"
    echo "  • jq:   https://stedolan.github.io/jq/download/"
    echo "  • node: https://nodejs.org/ (v20+)"
    exit 1
  fi

  # Node version check (v18+)
  local node_ver
  node_ver="$(node --version | sed 's/v//' | cut -d. -f1)"
  if [[ "$node_ver" -lt 18 ]]; then
    err "Node.js v18+ required (found v${node_ver})"
    exit 1
  fi

  # Registry file
  if [[ ! -f "$REGISTRY" ]]; then
    err "registry.json not found at: $REGISTRY"
    exit 1
  fi

  # Skills source directory
  if [[ ! -d "$SKILLS_SRC" ]]; then
    warn ".ai/skills/ directory not found — run from the repo root or create it"
    warn "Expected: $SKILLS_SRC"
  fi

  ok "Preflight passed (node v${node_ver}, jq $(jq --version))"
}

# ── Phase 1: Validate Registry ────────────────────────────────────────────────
validate_registry() {
  log "Validating registry.json against schema…"

  if [[ ! -f "$SCHEMA" ]]; then
    warn "registry.schema.json not found — skipping schema validation"
    return
  fi

  if ! command -v npx >/dev/null 2>&1; then
    warn "npx not available — skipping schema validation"
    return
  fi

  if npx --yes ajv-cli@5 validate \
      --spec=draft2020 \
      -s "$SCHEMA" \
      -d "$REGISTRY" \
      --all-errors \
      >/dev/null 2>&1; then
    ok "registry.json is schema-valid"
  else
    err "registry.json failed schema validation"
    echo "  Run: npx ajv-cli@5 validate --spec=draft2020 -s registry.schema.json -d registry.json"
    exit 1
  fi

  # Count check
  local declared actual
  declared=$(jq '.skills | length' "$REGISTRY")
  ok "Registry declares ${declared} skills"
}

# ── Phase 2: Install AI Skills (Claude.ai) ────────────────────────────────────
install_ai_skills() {
  log "Installing AI skills to ${USER_SKILLS_DIR}…"

  if [[ ! -d "$SKILLS_SRC" ]]; then
    warn ".ai/skills/ not found — skipping AI skill install"
    warn "Create skill files at .ai/skills/<name>/SKILL.md first"
    return
  fi

  local installed=0 skipped=0

  # Read each skill name from registry (authoritative source of truth)
  while IFS= read -r skill_name; do
    local src="${SKILLS_SRC}/${skill_name}/SKILL.md"
    local dst="${USER_SKILLS_DIR}/${skill_name}/SKILL.md"

    if [[ ! -f "$src" ]]; then
      warn "Skill file not found: $src (declared in registry but file missing)"
      ((skipped++)) || true
      continue
    fi

    copy_skill "$src" "$dst"
    ((installed++)) || true
  done < <(jq -r '.skills[].name' "$REGISTRY")

  log "AI Skills: ${installed} installed, ${skipped} skipped"
}

# ── Phase 3: Install Claude Code Slash Commands ───────────────────────────────
install_claude_code_skills() {
  if [[ "$USER_ONLY" == true ]]; then
    log "Skipping project .claude/ skills (--user-only mode)"
    return
  fi

  log "Installing Claude Code slash commands to .claude/skills/…"

  if [[ ! -d "$CLAUDE_SKILLS_SRC" ]]; then
    warn ".claude/skills/ not found — skipping slash command install"
    return
  fi

  local installed=0

  while IFS= read -r -d '' cmd_dir; do
    local cmd_name
    cmd_name="$(basename "$cmd_dir")"
    local src="${cmd_dir}/SKILL.md"
    local dst="${SCRIPT_DIR}/.claude/skills/${cmd_name}/SKILL.md"

    if [[ ! -f "$src" ]]; then continue; fi

    copy_skill "$src" "$dst"
    ((installed++)) || true
  done < <(find "$CLAUDE_SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -print0)

  log "Claude Code slash commands: ${installed} installed"
}

# ── Phase 4: Merge Project Settings ──────────────────────────────────────────
install_settings() {
  if [[ "$USER_ONLY" == true ]]; then
    log "Skipping project settings.json (--user-only mode)"
    return
  fi

  if [[ ! -f "$PROJECT_SETTINGS" ]]; then
    warn ".claude/settings.json not found — skipping settings install"
    return
  fi

  # Validate JSON before touching anything
  if ! jq empty "$PROJECT_SETTINGS" 2>/dev/null; then
    err ".claude/settings.json is invalid JSON — fix before installing"
    exit 1
  fi

  ok ".claude/settings.json is valid JSON"

  # If user settings exist, report but don't overwrite (project settings auto-merge)
  if [[ -f "$USER_SETTINGS" ]]; then
    ok "User settings found at $USER_SETTINGS — project settings will merge at higher precedence"
  fi
}

# ── Phase 5: Verify Installation ──────────────────────────────────────────────
verify_installation() {
  log "Verifying installation…"

  local expected
  expected=$(jq '.skills | length' "$REGISTRY")

  local found=0
  if [[ -d "$USER_SKILLS_DIR" ]]; then
    found=$(find "$USER_SKILLS_DIR" -name "SKILL.md" -mindepth 2 -maxdepth 2 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [[ "$found" -ge "$expected" ]]; then
    ok "Verification passed: ${found}/${expected} skills present in ${USER_SKILLS_DIR}"
  else
    warn "Verification: ${found}/${expected} skills found"
    warn "Some skills may be missing. Check .ai/skills/ and re-run: ./install.sh"
  fi

  # Check Claude Code slash commands
  local cmd_found=0
  if [[ -d "${SCRIPT_DIR}/.claude/skills" ]]; then
    cmd_found=$(find "${SCRIPT_DIR}/.claude/skills" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
    ok "Claude Code slash commands: ${cmd_found} installed"
  fi
}

# ── Phase 6: Post-install Summary ─────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}══════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  SCAR Skill Suite v${VERSION} — Install Complete${RESET}"
  echo -e "${BOLD}══════════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "  AI Skills:     ${USER_SKILLS_DIR}"
  echo -e "  Slash commands: .claude/skills/"
  echo -e "  Settings:       .claude/settings.json"
  echo -e "  Log:            ${LOG_FILE}"
  echo ""
  echo -e "${BOLD}Next steps:${RESET}"
  echo "  1. Open Claude.ai → Settings → Skills"
  echo "     Verify $(jq '.skills | length' "$REGISTRY") skills appear"
  echo "  2. In Claude Code: run /nexus to test orchestration"
  echo "  3. Run: make validate  (confirms registry integrity)"
  echo "  4. Run: make doctor    (confirms tool availability)"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  # Rotate log file (keep last 10)
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "── Install run: $TIMESTAMP ──" >> "$LOG_FILE"

  echo -e "${BOLD}SCAR Skill Suite v${VERSION} — Installer${RESET}"
  [[ "$DRY_RUN"       == true ]] && echo -e "${YELLOW}[DRY-RUN MODE — no files will be written]${RESET}"
  [[ "$FORCE"         == true ]] && echo -e "${YELLOW}[FORCE MODE — existing files will be overwritten]${RESET}"
  [[ "$VALIDATE_ONLY" == true ]] && echo -e "${CYAN}[VALIDATE-ONLY MODE]${RESET}"
  echo ""

  preflight
  validate_registry

  if [[ "$VALIDATE_ONLY" == true ]]; then
    ok "Validation complete. No files written."
    exit 0
  fi

  install_ai_skills
  install_claude_code_skills
  install_settings
  verify_installation
  print_summary
}

main "$@"
