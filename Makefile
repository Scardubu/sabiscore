# ══════════════════════════════════════════════════════════════════════════════
# SCAR Skill Suite v2.0 — Makefile
# Self-documenting. Run `make` or `make help` to see all targets.
# Cross-platform: macOS (Darwin/BSD), Linux (GNU), WSL2.
# ══════════════════════════════════════════════════════════════════════════════

.DEFAULT_GOAL := help
SHELL         := bash

# ── OS Detection ──────────────────────────────────────────────────────────────
UNAME_S := $(shell uname -s 2>/dev/null || echo Windows)

ifeq ($(UNAME_S),Darwin)
  SED_INPLACE := sed -i ''
  OPEN_CMD    := open
else
  SED_INPLACE := sed -i
  OPEN_CMD    := xdg-open
endif

# ── Variables ─────────────────────────────────────────────────────────────────
REGISTRY       := registry.json
SCHEMA         := registry.schema.json
SKILLS_DIR     := .ai/skills
CLAUDE_DIR     := .claude
INSTALL_SCRIPT := install.sh
LOG_DIR        := .logs

SUITE_VERSION  := $(shell jq -r '.suiteVersion' $(REGISTRY) 2>/dev/null || echo "unknown")
SKILL_COUNT    := $(shell jq '.skills | length' $(REGISTRY) 2>/dev/null || echo "0")
PYTHON_BIN     := ./.venv/bin/python

# ── Phony Targets ─────────────────────────────────────────────────────────────
.PHONY: help install install-force install-dry validate lint lint-md lint-sh \
	bump-version doctor clean check-tools status open-skills \
	phase7-caches phase7-caches-clean verify

# ── Self-Documenting Help ──────────────────────────────────────────────────────
help: ## Show this help (default target)
	@echo ""
	@echo "  SCAR Skill Suite v$(SUITE_VERSION) — $(SKILL_COUNT) skills"
	@echo "  OS: $(UNAME_S)"
	@echo ""
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Install ───────────────────────────────────────────────────────────────────
install: check-tools validate ## Install skills (idempotent, skips unchanged files)
	@chmod +x $(INSTALL_SCRIPT)
	@./$(INSTALL_SCRIPT)

install-force: check-tools validate ## Force-overwrite all existing skill files
	@chmod +x $(INSTALL_SCRIPT)
	@./$(INSTALL_SCRIPT) --force

install-dry: ## Preview install actions without writing any files
	@chmod +x $(INSTALL_SCRIPT)
	@./$(INSTALL_SCRIPT) --dry-run

install-validate: ## Run validation only, no install
	@chmod +x $(INSTALL_SCRIPT)
	@./$(INSTALL_SCRIPT) --validate

# ── Validation ────────────────────────────────────────────────────────────────
validate: check-tools ## Validate registry.json against JSON Schema 2020-12
	@echo "  Validating $(REGISTRY)…"
	@npx --yes ajv-cli@5 validate \
	  --spec=draft2020 \
	  -s $(SCHEMA) \
	  -d $(REGISTRY) \
	  --all-errors
	@echo "  ✓ $(REGISTRY) is schema-valid ($(SKILL_COUNT) skills, suite v$(SUITE_VERSION))"

validate-strict: check-tools ## Validate registry AND verify all skill files exist on disk
	@$(MAKE) validate
	@echo "  Checking skill files on disk…"
	@missing=0; \
	while IFS= read -r path; do \
	  if [[ ! -f "$$path" ]]; then \
	    echo "  ✗ Missing: $$path"; \
	    missing=$$((missing + 1)); \
	  fi; \
	done < <(jq -r '.skills[].filePath' $(REGISTRY)); \
	if [[ $$missing -gt 0 ]]; then \
	  echo "  ✗ $$missing skill file(s) missing from disk"; \
	  echo "    Run: make status to see what's installed"; \
	  exit 1; \
	else \
	  echo "  ✓ All skill files present on disk"; \
	fi

verify: ## Run SabiScore production release gates
	@echo "  SabiScore production verification"
	@echo "  1/8 Secret and provider contract tests"
	@cd backend && python -m pytest tests/test_secret_safety.py tests/test_providers_gateway.py -q --no-cov
	@echo "  2/8 Backend regression tests"
	@cd backend && python -m pytest tests -q --no-cov
	@echo "  3/8 Provider CLI doctor"
	@cd backend && python -m src.cli providers doctor >/dev/null
	@echo "  4/8 Scraper tests"
	@pnpm --filter @sabiscore/scraper test
	@echo "  5/8 Web lint"
	@pnpm --filter @sabiscore/web lint
	@echo "  6/8 Web typecheck"
	@pnpm --filter @sabiscore/web typecheck
	@echo "  7/8 Web tests"
	@pnpm --filter @sabiscore/web test
	@echo "  8/8 Web build"
	@pnpm --filter @sabiscore/web build

phase7-caches: ## Build deterministic Phase 7 cache artifacts (Elo + StatsBomb tactical cache)
	@test -x "$(PYTHON_BIN)" || { echo "  Missing virtualenv python at $(PYTHON_BIN). Run: python -m venv .venv && ./.venv/bin/pip install -r requirements.txt"; exit 1; }
	@echo "  Building Elo cache…"
	@$(PYTHON_BIN) scripts/populate_elo_ratings.py --limit 600
	@echo "  Building StatsBomb tactical cache…"
	@$(PYTHON_BIN) scripts/build_statsbomb_cache.py
	@echo "  ✓ Phase 7 cache artifacts refreshed"

phase7-caches-clean: ## Remove generated Phase 7 cache artifacts
	@rm -f data/processed/elo_ratings.parquet data/processed/statsbomb_features_cache.parquet
	@echo "  ✓ Removed Phase 7 cache artifacts"

# ── Linting ───────────────────────────────────────────────────────────────────
lint: lint-md lint-sh ## Run all linters (Markdown + Shell)

lint-md: ## Lint all Markdown files with markdownlint-cli2
	@echo "  Linting Markdown…"
	@npx --yes markdownlint-cli2 \
	  "$(SKILLS_DIR)/**/*.md" \
	  "$(CLAUDE_DIR)/skills/**/*.md" \
	  "CLAUDE.md" \
	  "NEXUS.md" \
	  "#node_modules" \
	  "#.pnpm"
	@echo "  ✓ Markdown lint passed"

lint-sh: ## Lint shell scripts with shellcheck
	@if ! command -v shellcheck >/dev/null 2>&1; then \
	  echo "  [SKIP] shellcheck not installed (brew install shellcheck / apt install shellcheck)"; \
	  exit 0; \
	fi
	@echo "  Linting shell scripts…"
	@shellcheck -x $(INSTALL_SCRIPT)
	@echo "  ✓ Shell lint passed"

# ── Version Management ────────────────────────────────────────────────────────
bump-version: ## Bump suiteVersion in registry.json (usage: make bump-version V=2.1.0)
	@test -n "$(V)" || { echo "  Error: V is required. Usage: make bump-version V=2.1.0"; exit 1; }
	@echo "  Bumping suite version: $(SUITE_VERSION) → $(V)…"
	@tmp=$$(mktemp); \
	  jq --arg v "$(V)" --arg d "$$(date +%Y-%m-%d)" \
	     '.suiteVersion=$$v | .updatedAt=$$d' $(REGISTRY) > "$$tmp" && \
	  mv "$$tmp" $(REGISTRY)
	@$(MAKE) validate
	@echo "  ✓ Suite version bumped to $(V). Commit: git add registry.json && git commit -m 'chore: bump skill suite to v$(V)'"

bump-skill: ## Bump a single skill version (usage: make bump-skill NAME=backend-systems-auditor V=1.3.0)
	@test -n "$(NAME)" || { echo "  Error: NAME required. Usage: make bump-skill NAME=<skill-name> V=<version>"; exit 1; }
	@test -n "$(V)"    || { echo "  Error: V required."; exit 1; }
	@echo "  Bumping $(NAME) to v$(V)…"
	@tmp=$$(mktemp); \
	  jq --arg name "$(NAME)" --arg ver "$(V)" \
	     '(.skills[] | select(.name==$$name) | .version) = $$ver' $(REGISTRY) > "$$tmp" && \
	  mv "$$tmp" $(REGISTRY)
	@$(MAKE) validate
	@echo "  ✓ $(NAME) bumped to v$(V)"

# ── Doctor ────────────────────────────────────────────────────────────────────
doctor: ## Check all required tools and environment health
	@echo ""
	@echo "  ═══════════════════════════════════════"
	@echo "  SCAR Skill Suite — Doctor"
	@echo "  OS: $(UNAME_S)"
	@echo "  ═══════════════════════════════════════"
	@echo ""
	@echo "  Required tools:"
	@for t in jq node npx claude shellcheck; do \
	  if command -v $$t >/dev/null 2>&1; then \
	    ver=$$($$t --version 2>/dev/null | head -1 || echo ""); \
	    printf "  %-14s ✓  %s\n" "$$t" "$$ver"; \
	  else \
	    printf "  %-14s ✗  NOT FOUND\n" "$$t"; \
	  fi; \
	done
	@echo ""
	@echo "  Registry:"
	@if [[ -f "$(REGISTRY)" ]]; then \
	  echo "  registry.json    ✓  $(SKILL_COUNT) skills, v$(SUITE_VERSION)"; \
	else \
	  echo "  registry.json    ✗  NOT FOUND"; \
	fi
	@if [[ -f "$(SCHEMA)" ]]; then \
	  echo "  schema.json      ✓  present"; \
	else \
	  echo "  schema.json      ✗  NOT FOUND"; \
	fi
	@echo ""
	@echo "  Claude directories:"
	@for d in "$$HOME/.claude" "$$HOME/.claude/skills" ".claude" ".claude/skills" ".ai/skills"; do \
	  if [[ -d "$$d" ]]; then \
	    count=$$(find "$$d" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' '); \
	    printf "  %-30s ✓  %s SKILL.md files\n" "$$d" "$$count"; \
	  else \
	    printf "  %-30s —  (not created yet)\n" "$$d"; \
	  fi; \
	done
	@echo ""
	@echo "  Settings files:"
	@for f in ".claude/settings.json" ".mcp.json" "$$HOME/.claude/settings.json"; do \
	  if [[ -f "$$f" ]]; then \
	    if jq empty "$$f" 2>/dev/null; then \
	      printf "  %-40s ✓  valid JSON\n" "$$f"; \
	    else \
	      printf "  %-40s ✗  INVALID JSON\n" "$$f"; \
	    fi; \
	  else \
	    printf "  %-40s —  (not present)\n" "$$f"; \
	  fi; \
	done
	@echo ""

check-tools: ## Verify minimum required tools are present (jq, node, npx)
	@missing=0; \
	for t in jq node npx; do \
	  command -v $$t >/dev/null 2>&1 || { echo "  Missing: $$t"; missing=$$((missing+1)); }; \
	done; \
	if [[ $$missing -gt 0 ]]; then echo "  Run: make doctor to see install instructions"; exit 1; fi

# ── Status ────────────────────────────────────────────────────────────────────
status: ## Show installed vs declared skills
	@echo ""
	@echo "  Suite v$(SUITE_VERSION) — $(SKILL_COUNT) skills declared"
	@echo ""
	@echo "  Cluster breakdown:"
	@jq -r '.skills | group_by(.clusterName) | .[] | "  C\(.[0].cluster) \(.[0].clusterName): \(length) skills"' $(REGISTRY) 2>/dev/null
	@echo ""
	@installed=$$(find "$$HOME/.claude/skills" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' '); \
	echo "  Installed in ~/.claude/skills/: $$installed skill files"
	@echo ""

# ── Utilities ─────────────────────────────────────────────────────────────────
open-skills: ## Open the ~/.claude/skills directory
	@$(OPEN_CMD) "$$HOME/.claude/skills" 2>/dev/null || \
	  echo "  Skills directory: $$HOME/.claude/skills"

clean: ## Remove install log and temp files
	@rm -f $(LOG_DIR)/*.log .install.log
	@echo "  ✓ Cleaned"

# ── Safety ────────────────────────────────────────────────────────────────────
# Prevent running targets that modify files without validation
install install-force: validate
