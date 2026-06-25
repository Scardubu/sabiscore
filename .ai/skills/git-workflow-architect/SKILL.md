---
name: git-workflow-architect
description: >
  Designs and generates complete Git workflow configurations: branch strategies, conventional
  commit setups (commitlint + commitizen + husky), PR templates, GitLens configuration,
  GitHub Actions CI workflows, and semantic release pipelines. Use this skill whenever a
  user wants to set up a Git workflow, configure commit linting, add pre-commit hooks,
  create PR templates, set up semantic versioning, configure GitHub Actions for CI/CD,
  set up branch protection rules, or asks "set up conventional commits", "configure husky
  and commitlint", "create a PR template", "set up semantic release", "configure GitHub
  Actions for my Next.js / Node.js project", "set up pre-commit hooks", "what branch
  strategy should I use", or "configure GitLens". Always use this skill for Git workflow
  configuration — these pipelines have specific dependency ordering and hook setup steps
  that are easy to get wrong.
---

# Git Workflow Architect

Design and generate production-grade Git workflows: commit standards, pre-commit hooks,
PR templates, CI pipelines, and semantic release. Everything is generated as complete,
copyable files.

## Workflow Stack

```
commitizen + commitlint   ← enforce commit message format
husky                     ← run hooks on git events
lint-staged               ← run linters only on changed files
PR template               ← guide PR quality
GitHub Actions CI         ← validate every PR and push to main
semantic-release          ← automated versioning + changelog from commits
```

## Protocol

### Step 1 — Intake

Ask only if not clear:
- **Repository host**: GitHub (default), GitLab, Bitbucket?
- **Branch strategy**: trunk-based (recommended), Gitflow, or GitHub flow?
- **Semantic release**: automated versioning needed?
- **Package manager**: pnpm, yarn, or npm?

### Step 2 — Branch Strategy

**Trunk-Based Development (recommended for teams shipping fast):**
```
main          ← always deployable; direct deploys to production
  ↑ PR
feature/      ← short-lived; 1–3 days max; one developer
fix/          ← bug fixes; even shorter-lived
release/x.y   ← only if needed for staged rollouts
```

**Gitflow (for scheduled releases):**
```
main          ← stable release tags only
develop       ← integration branch
  ↑ PR
feature/*     ← off develop
hotfix/*      ← off main, merged to both main and develop
release/*     ← stabilization branch before tagging main
```

Default recommendation: **Trunk-Based** — less overhead, forces CI quality gates.

### Step 3 — Conventional Commits Setup

**Install:**
```bash
pnpm add -D \
  @commitlint/cli \
  @commitlint/config-conventional \
  commitizen \
  cz-conventional-changelog \
  husky \
  lint-staged
```

**Initialize husky:**
```bash
pnpm exec husky init
# Creates .husky/ directory with a pre-commit hook
```

**`commitlint.config.ts`:**
```typescript
import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce types (feat, fix, docs, etc.)
    'type-enum': [2, 'always', [
      'feat',     // new feature
      'fix',      // bug fix
      'docs',     // documentation only
      'style',    // formatting, missing semicolons — no logic change
      'refactor', // code change that neither fixes a bug nor adds a feature
      'perf',     // performance improvement
      'test',     // adding or correcting tests
      'build',    // build system, package.json changes
      'ci',       // CI/CD configuration
      'chore',    // maintenance tasks
      'revert',   // reverts a previous commit
    ]],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 150],
    'footer-max-line-length': [2, 'always', 150],
  },
  prompt: {
    settings: {
      enableMultipleScopes: true,
      scopeEnumSeparator: ',',
    },
    messages: {
      type: 'Select the type of change you\'re committing:',
      scope: 'Scope (optional, e.g. api, web, ui):',
      subject: 'Short description (lowercase, imperative, no period):',
      body: 'Longer description (optional, wrap at 150 chars):\n',
      breaking: 'BREAKING CHANGES (optional):\n',
      footer: 'Issues closed by this commit (e.g. #123):\n',
    },
  },
}

export default config
```

**`.husky/commit-msg`** (lint commit messages):
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec commitlint --edit "$1"
```

**`.husky/pre-commit`** (lint + format staged files):
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec lint-staged
```

**`lint-staged.config.ts`:**
```typescript
export default {
  // TypeScript + React: lint and format
  '*.{ts,tsx}': [
    'eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  // JS files: format only
  '*.{js,mjs,cjs}': ['prettier --write'],
  // JSON, CSS, MD: format only
  '*.{json,css,md,yaml,yml}': ['prettier --write'],
  // Prisma schema: format
  '*.prisma': ['prisma format'],
}
```

**`package.json` additions:**
```jsonc
{
  "scripts": {
    "commit":        "git add -A && cz",   // interactive commit via commitizen
    "prepare":       "husky"               // install hooks after pnpm install
  },
  "config": {
    "commitizen": { "path": "cz-conventional-changelog" }
  }
}
```

### Step 4 — PR Template

**`.github/pull_request_template.md`:**
```markdown
## Summary

<!-- One paragraph: what changed and why. -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking, fixes an issue)
- [ ] ✨ Feature (non-breaking, adds functionality)
- [ ] 💥 Breaking change (fix or feature that causes existing functionality to break)
- [ ] 🔧 Refactor / tech debt
- [ ] 📚 Documentation
- [ ] 🏗️ Infrastructure / CI

## Related Issues

Closes #<!-- issue number -->

## Changes Made

<!-- Bullet list of specific changes -->
-
-

## How to Test

<!-- Steps to verify this PR works correctly -->
1.
2.

## Checklist

- [ ] Tests added or updated
- [ ] TypeScript errors: `pnpm typecheck` passes
- [ ] Linting: `pnpm lint` passes
- [ ] No console.log left in production code
- [ ] Breaking changes documented in commit body
- [ ] Self-reviewed the diff before requesting review
```

### Step 5 — GitHub Actions CI

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true    # cancel redundant runs on new push

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0        # full history for commitlint

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type-check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Test
        run: pnpm test --coverage
        env:
          CI: true

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: validate
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile

      - name: Build (Turborepo)
        run: pnpm turbo build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM:  ${{ vars.TURBO_TEAM }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: |
            apps/web/.next
            apps/api/dist
          retention-days: 7

  commitlint:
    name: Commit Lint
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Lint PR commits
        run: pnpm exec commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD
```

### Step 6 — Semantic Release (optional)

**Install:**
```bash
pnpm add -D semantic-release \
  @semantic-release/changelog \
  @semantic-release/git \
  @semantic-release/github
```

**`.releaserc.json`:**
```jsonc
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", {
      "changelogFile": "CHANGELOG.md"
    }],
    ["@semantic-release/npm", {
      "npmPublish": false    // set true for libraries
    }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
    }],
    "@semantic-release/github"
  ]
}
```

**Add to CI (runs only on main push):**
```yaml
  release:
    name: Release
    runs-on: ubuntu-latest
    needs: [validate, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0, persist-credentials: false }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Release
        run: pnpm exec semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN:    ${{ secrets.NPM_TOKEN }}
```

### Step 7 — GitLens VS Code Configuration

```jsonc
// settings.json additions for GitLens
{
  // ─── GitLens ─────────────────────────────────────────────
  "gitlens.blame.format":          "${author|10} ${agoOrDate|14}",
  "gitlens.blame.highlight.enabled": true,
  "gitlens.codeLens.enabled":      false,   // can be noisy — enable per-project
  "gitlens.currentLine.enabled":   true,
  "gitlens.hovers.currentLine.over": "line",
  "gitlens.graph.layout":          "editor",
  "gitlens.statusBar.enabled":     true,
  "gitlens.statusBar.format":      "${author}, ${agoOrDate}",

  // ─── Diff editor ──────────────────────────────────────────
  "diffEditor.renderSideBySide":   true,
  "diffEditor.ignoreTrimWhitespace": false,  // see real whitespace diffs
  "scm.defaultViewMode":           "tree",   // tree view in Source Control panel
}
```

## One-Time Setup Sequence

```bash
# 1. Install all hook tooling
pnpm add -D @commitlint/cli @commitlint/config-conventional \
            commitizen cz-conventional-changelog \
            husky lint-staged

# 2. Initialize husky
pnpm exec husky init

# 3. Write hook files (from Step 3 above)
echo "pnpm exec commitlint --edit \$1" > .husky/commit-msg
chmod +x .husky/commit-msg

# 4. Verify hooks are working
git add -A
git commit -m "test: bad commit message format"  # should fail with commitlint error
git commit -m "feat: add commitlint"              # should pass
```

## Quality Gates

- [ ] `git commit -m "bad message"` is rejected by commitlint
- [ ] `git commit` (interactive) launches commitizen prompt
- [ ] Pre-commit hook runs lint-staged on only changed files (not all files)
- [ ] CI fails on TypeScript errors, lint errors, or test failures
- [ ] CI passes on a clean main branch
- [ ] PR template appears automatically when opening a PR on GitHub
- [ ] Semantic release creates a GitHub release and CHANGELOG.md on main push

## Activation Triggers

- "Set up conventional commits / commitlint / commitizen"
- "Configure husky and lint-staged"
- "Create a PR template for GitHub"
- "Set up GitHub Actions CI for Next.js / Node.js"
- "Set up semantic release / automated versioning"
- "Configure pre-commit hooks"
- "What branch strategy should I use?"
- "Configure GitLens in VS Code"

## Skill Chain

**Feeds into**: `testing-strategy-architect` (CI workflow generated here is where tests run) → `backend-systems-auditor` (CI is where graceful shutdown and migration safety are validated).

**Creative combination**: Combine with `prompt-engineering-architect` to generate a commit-message linting prompt that ensures AI-assisted commits still follow conventional commit format. Keeps AI-generated code disciplined inside the workflow.
