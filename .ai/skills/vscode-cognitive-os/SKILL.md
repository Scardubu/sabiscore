---
name: vscode-cognitive-os
description: >
  Transforms VS Code into a high-performance cognitive workspace by auditing and generating
  settings.json, keybindings, extension recommendations, and theme configurations. Use this
  skill whenever a user asks to optimize their VS Code setup, improve their dev environment,
  configure extensions, generate settings.json, set up a workspace for a specific stack, reduce
  cognitive load in their editor, or says things like "optimize my VS Code", "what extensions
  should I install", "make my editor faster", "set up my workspace for Next.js / TypeScript /
  Python / etc", or "help me configure VS Code". Always use this skill for any editor
  configuration or developer environment request.
---

# VS Code Cognitive OS

Audit and generate elite VS Code configurations that eliminate friction, reduce cognitive load,
and maximize flow state. Every setting must be justified. Every extension must earn its place.

## Core Philosophy

- **Signal over noise**: Disable everything decorative that adds no information density
- **Keyboard-first**: Every frequent action reachable without a mouse
- **Stack-aware**: Configuration is always tailored to the active tech stack
- **Baseline grid**: Visual rhythm enforced via font sizing, line height, and panel proportions
- **Calm, alive, fast**: The editor should feel responsive and quiet simultaneously

## Protocol

### Step 1 — Audit Input

If the user shares an existing settings.json or workspace config, audit it first:
- Flag redundant settings (duplicates, defaults being re-declared)
- Flag conflicts (settings that cancel each other out)
- Flag missing high-leverage settings for their stack
- Flag extension bloat (installed but unused or overlapping)

If no existing config is shared, ask: **"What's your primary stack?"** then generate from scratch.

### Step 2 — Generate Configuration

Produce a complete, commented `settings.json` structured in these sections:

```jsonc
// ─── Editor Core ───────────────────────────────────────────
// ─── Font & Typography ─────────────────────────────────────
// ─── UI & Visual Hierarchy ─────────────────────────────────
// ─── Terminal ──────────────────────────────────────────────
// ─── Language: TypeScript ──────────────────────────────────
// ─── Language: [Stack-specific] ────────────────────────────
// ─── Extensions ────────────────────────────────────────────
// ─── Performance ───────────────────────────────────────────
// ─── Git ───────────────────────────────────────────────────
```

Every setting includes an inline comment explaining **why** it's set, not just what it does.

### Step 3 — Extension Stack

Produce a tiered extension list:

**Tier 1 — Non-negotiable** (install immediately)
**Tier 2 — Stack-specific** (install for this project)
**Tier 3 — Optional** (situational, with use-case note)

For each extension: name, publisher ID (for CLI install), one-line justification.

### Step 4 — Keybindings

Generate a `keybindings.json` for the top 10 highest-frequency actions in the user's workflow.
Format:
```jsonc
{ "key": "...", "command": "...", "when": "...", "// why": "..." }
```

### Step 5 — Workspace File (optional)

If the user is setting up a monorepo or multi-root workspace, produce a `.code-workspace` file
with per-folder settings, recommended extensions, and launch configs.

## Quality Gates

- No setting is present without justification
- No two extensions do the same thing
- Font size + line height combination produces a comfortable 24px baseline rhythm
- TypeScript strict mode is always enabled for TS stacks
- `editor.formatOnSave` is always configured with a formatter specified
- Terminal uses a consistent shell with proper PATH and env setup

## Stack Presets

When a stack is identified, apply these opinionated defaults:

**Next.js / React / TypeScript**
- ESLint + Prettier with strict TS rules
- Tailwind CSS IntelliSense + Headwind
- Pretty TypeScript Errors + Error Lens
- Auto-import, path aliases, jsconfig/tsconfig awareness

**Python**
- Pylance strict mode, Black formatter, isort
- Jupyter support, virtualenv auto-activation

**Rust**
- rust-analyzer with full inlay hints, Clippy on save

**Monorepo (Turborepo / Nx)**
- Multi-root workspace, per-package lint configs, task runner integration

## Activation Triggers

- "Optimize my VS Code"
- "Generate a settings.json for [stack]"
- "What extensions should I use for [stack]?"
- "My editor feels slow / noisy / cluttered"
- "Set up my workspace for [project type]"
- "Configure VS Code for TypeScript strict mode"
- "Make my terminal better in VS Code"
- "Help me set up keybindings"

## Skill Chain

**Feeds into**: `vscode-ai-agent-stack` (layer AI tools on top of this base config) → `vscode-monorepo-forge` (extend to multi-root workspace) → `typescript-config-surgeon` (wire TypeScript into the configured editor).

**Creative combination**: Run `vscode-cognitive-os` first to establish the editor baseline, then `vscode-ai-agent-stack` to install the AI layer, then `vscode-monorepo-forge` to configure the workspace. That sequence takes any dev machine from zero to elite in three skill invocations.
