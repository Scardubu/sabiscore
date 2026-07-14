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
PYTHON_BIN     := $(or \
  $(if $(wildcard .venv/bin/python),.venv/bin/python),\
  $(if $(wildcard .venv/Scripts/python.exe),.venv/Scripts/python.exe),\
  python)

# ── Phony Targets ─────────────────────────────────────────────────────────────
.PHONY: help install install-force install-dry validate lint lint-md lint-sh \
	bump-version doctor clean check-tools status open-skills \
	phase7-caches phase7-caches-clean verify verify-core

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
	@"$(MAKE)" validate
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

verify-core: ## Run deterministic SabiScore checks without live providers or Docker
	@echo "  SabiScore deterministic verification"
	@echo "  1/6 Backend safety, provider, engine, and scraper regressions"
	@cd backend && PYTHONPATH=. DEBUG=false ALLOW_SQLITE_FALLBACK=true $(PYTHON_BIN) -m pytest -q \
	  tests/test_secret_safety.py \
	  tests/test_database_migration_hardening.py \
	  tests/test_provider_cli_contract.py \
	  tests/test_league_policy_contract.py \
	  tests/test_zero_fabrication_contract.py \
	  tests/test_providers_gateway.py \
	  tests/test_betting_intelligence_engine.py \
	  tests/providers/test_reconciliation_and_odds.py \
	  tests/test_scraped_feature_store.py \
	  tests/test_no_synthetic_scrapers.py \
	  tests/test_scrapers.py
	@echo "  2/6 OpenAPI contract"
	@cd backend && timeout 90s env PYTHONPATH=. DEBUG=false ALLOW_SQLITE_FALLBACK=true $(PYTHON_BIN) scripts/verify_openapi.py
	@echo "  3/6 Provider CLI (offline/configuration mode)"
	@cd backend && timeout 60s env PYTHONPATH=. DEBUG=false PROVIDER_LIVE_TESTS=false $(PYTHON_BIN) -m src.cli providers doctor >/dev/null
	@echo "  4/6 Scraper parser tests"
	@node --test apps/scraper/tests/*.test.mjs
	@echo "  5/6 Scraper source and manifest validation"
	@node apps/scraper/src/cli.mjs validate
	@echo "  6/6 Python compilation"
	@$(PYTHON_BIN) -m compileall -q backend/src backend/scripts
	@echo "  Zero-fabrication scan"
	@! grep -rn --include="*.py" \
	  "FEATURE_DEFAULTS\[" \
	  backend/src/api backend/src/services backend/src/providers backend/src/insights backend/src/data/transformers.py \
	  2>/dev/null | grep -v "test_" | grep -v "#" || \
	  { echo "  ✗ FEATURE_DEFAULTS used in production API/service/provider path — C-02 violation"; exit 1; }
	@! grep -rn --include="*.py" "full_kelly_fraction" backend/src 2>/dev/null || \
	  { echo "  ✗ Public Full-Kelly payload exposure is forbidden"; exit 1; }
	@! grep -rn -E 'full_kelly|Full-Kelly|Full Kelly' apps/web/src --include='*.ts' --include='*.tsx' 2>/dev/null || \
	  { echo "  ✗ Public Full-Kelly frontend exposure is forbidden"; exit 1; }
	@! grep -rn 'NEXT_PUBLIC_KELLY_FRACTION' vercel.json .env.example apps/web backend/.env.example 2>/dev/null || \
	  { echo "  ✗ Kelly fraction must not be exposed as NEXT_PUBLIC_*"; exit 1; }
	@! grep -rn --include="*.py" "Base\.metadata\.create_all" backend/alembic 2>/dev/null || \
	  { echo "  ✗ create_all in Alembic chain — C-01 violation"; exit 1; }
	@echo "  ✓ Zero-fabrication scan passed"

verify: ## Run every SabiScore production release gate; requires pnpm, Postgres, Docker, browsers, and gitleaks
	@command -v gitleaks >/dev/null || { echo "gitleaks is required for production verification"; exit 1; }
	@command -v pnpm >/dev/null || { echo "pnpm is required for production verification"; exit 1; }
	@command -v docker >/dev/null || { echo "Docker is required for production verification"; exit 1; }
	@echo "  SabiScore production verification"
	@echo "  1/14 Secret scan"
	@gitleaks detect --no-git --source . --redact --exit-code 1
	@echo "  2/14 Deterministic core gates"
	@"$(MAKE)" verify-core
	@echo "  3/14 Complete backend suite"
	@cd backend && PYTHONPATH=. DEBUG=false $(PYTHON_BIN) -m pytest tests -q
	@echo "  4/14 Alembic upgrade and schema drift check"
	@cd backend && alembic upgrade head && alembic check
	@echo "  5/14 Scraper workspace tests"
	@pnpm --filter @sabiscore/scraper test
	@echo "  6/14 Web lint"
	@pnpm --filter @sabiscore/web lint
	@echo "  7/14 Web typecheck"
	@pnpm --filter @sabiscore/web typecheck
	@echo "  8/14 Web component tests"
	@pnpm --filter @sabiscore/web test
	@echo "  9/14 Web production build"
	@pnpm --filter @sabiscore/web build
	@echo "  10/14 Docker Compose configuration"
	@docker compose -f docker-compose.prod.yml config --quiet
	@echo "  11/14 Backend image"
	@docker build -f backend/Dockerfile -t sabiscore-backend:verify backend/
	@echo "  12/14 Web image"
	@docker build -f apps/web/Dockerfile -t sabiscore-web:verify .
	@echo "  13/14 Playwright desktop/mobile smoke"
	@pnpm exec playwright test
	@echo "  14/14 Final OpenAPI regeneration"
	@cd backend && timeout 90s env PYTHONPATH=. DEBUG=false python scripts/verify_openapi.py
	@echo "  ✓ All production release gates passed"

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

# ── TLS / SSL ─────────────────────────────────────────────────────────────────
ssl-dev-certs: ## Generate self-signed TLS certs in ./ssl/ for local nginx (prod compose)
	@mkdir -p ssl
	@if command -v openssl >/dev/null 2>&1; then \
	  openssl req -x509 -nodes -newkey rsa:4096 \
	    -keyout ssl/nginx.key -out ssl/nginx.crt \
	    -days 365 -subj "/CN=localhost" 2>/dev/null && \
	  echo "  ✓ Self-signed certs written to ./ssl/ (valid 365 days)"; \
	else \
	  echo "  [SKIP] openssl not found — install it or place real certs in ./ssl/nginx.{key,crt}"; \
	fi

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
	@echo "  Bumping $(SUITE_VERSION) → $(V)…"
	@tmp=$$(mktemp); \
	  jq --arg v "$(V)" --arg d "$$(date +%Y-%m-%d)" \
	     '.suiteVersion=$$v | .updatedAt=$$d' $(REGISTRY) > "$$tmp" && \
	  mv "$$tmp" $(REGISTRY)
	@"$(MAKE)" validate
	@echo "  ✓ Suite version bumped to v$(V). Commit: git add registry.json && git commit -m 'chore: bump skill suite to v$(V)'"

bump-skill: ## Bump a single skill version (usage: make bump-skill NAME=backend-systems-auditor V=1.3.0)
	@test -n "$(NAME)" || { echo "  Error: NAME required. Usage: make bump-skill NAME=<skill-name> V=<version>"; exit 1; }
	@test -n "$(V)"    || { echo "  Error: V required."; exit 1; }
	@echo "  Bumping $(NAME) to v$(V)…"
	@tmp=$$(mktemp); \
	  jq --arg name "$(NAME)" --arg ver "$(V)" \
	     '(.skills[] | select(.name==$$name) | .version) = $$ver' $(REGISTRY) > "$$tmp" && \
	  mv "$$tmp" $(REGISTRY)
	@"$(MAKE)" validate
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
