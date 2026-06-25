---
name: vscode-ai-agent-stack
description: >
  Designs, configures, and documents a production-grade AI coding agent stack for VS Code,
  combining Claude Code (terminal-native agentic), GitHub Copilot (IDE-integrated completions),
  and Cline/Continue.dev (bring-your-own-key agent). Use this skill whenever a user asks to
  set up AI coding tools in VS Code, compare AI coding assistants, configure Claude Code with
  VS Code, set up Copilot agent mode, add Cline or Continue.dev to their workflow, or asks
  "what AI tools should I use in VS Code", "how do I set up Claude Code with VS Code",
  "best AI coding setup 2025", "configure Copilot agent mode", "how do I use multiple AI
  tools together", or any question about AI-assisted development tooling. Always use this
  skill for AI dev tooling configuration — the landscape changes fast and this skill has current guidance.
---

# VS Code AI Agent Stack

Design and configure a layered AI coding agent stack in VS Code. The 2026 professional
standard is a **hybrid approach**: two or three tools with non-overlapping roles, not one
tool trying to do everything.

## Protocol

### Step 1 — Intake

Ask only if not clear: **"Are you on a budget (BYOK), enterprise (GitHub), or solo/agentic (Claude Code + Copilot hybrid)?"**
Default: recommend the three-layer hybrid — Claude Code + Copilot + Cline.

### Step 2 — Generate in Order

1. Layer selection rationale (which tools, why)
2. Installation commands
3. `settings.json` block (copy-paste ready)
4. Keybindings (conflict-resolved)
5. Workflow guide (when to use which layer)
6. Quality gates

## The Three-Layer Model

```
┌─────────────────────────────────────────────────────┐
│  LAYER 3 — Agentic Reasoning (multi-file, complex)  │
│  Claude Code  ·  80.8% SWE-bench  ·  1M token ctx  │
├─────────────────────────────────────────────────────┤
│  LAYER 2 — IDE Completions (inline, fast)           │
│  GitHub Copilot  ·  or  ·  Cline (BYOK)            │
├─────────────────────────────────────────────────────┤
│  LAYER 1 — Static Intelligence (always-on)          │
│  TypeScript Language Server  ·  ESLint  ·  Prisma   │
└─────────────────────────────────────────────────────┘
```

Each layer has a distinct job. They don't conflict — they stack.

## Tool Selection Guide

### Claude Code — Use when:
- Multi-file refactor across the entire codebase
- Debugging complex issues that require reading many files
- Architectural decisions requiring full project context
- Writing migrations, schema changes, or multi-service integration
- You need the AI to run shell commands (tests, builds, git operations)

**Cost model**: $20/month Pro. Usage-based API charges for heavy sessions.
**Benchmark**: 80.8% SWE-bench Verified (as of May 2026, highest of the major tools)
**Context window**: 1M tokens — holds most of a large codebase in memory

### GitHub Copilot — Use when:
- Inline completions while typing (autocomplete, tab-to-accept)
- You're inside GitHub ecosystem (PR summaries, code review, issue → PR agent)
- You need multi-model access (GPT-5.x, Claude Sonnet 4.6, Gemini 3, Grok)
- Team environment — enterprise knowledge bases, shared context
- Free tier: 2,000 completions + 50 chat requests/month (no card required)

**Best paired with**: Claude Code for deep reasoning tasks

### Cline (open-source, BYOK) — Use when:
- You want Claude Code-style agentic behavior **inside** VS Code's sidebar
- You supply your own API key (Anthropic, OpenAI, etc.) for cost control
- You want the agent to see the VS Code file tree and open editors directly
- Budget-conscious: zero tool cost, pay only model API rates

**Install**: `ext install saoudrizwan.claude-dev`

### Continue.dev — Use when:
- You want a self-hosted, fully open-source alternative to Copilot
- Privacy is a requirement (run local models via Ollama)
- You want customizable autocomplete with your own fine-tuned model

## Setup Instructions

### Step 1 — Install the Foundation (all users)

```bash
# 1. Claude Code (terminal agent)
npm install -g @anthropic-ai/claude-code

# 2. Authenticate
claude auth login

# 3. Verify
claude --version
```

**VS Code integration for Claude Code:**
Open VS Code's integrated terminal (`Ctrl+`` `). Run Claude Code there — it reads your
open files and project structure. Claude Code does NOT need a VS Code extension to work.

### Step 2 — GitHub Copilot Setup

```
1. Install: VS Code Marketplace → "GitHub Copilot" (ms-vscode.copilot)
             + "GitHub Copilot Chat" (ms-vscode.copilot-chat)
2. Sign in: Command Palette → "GitHub Copilot: Sign In"
3. Enable agent mode: Settings → "github.copilot.chat.agent.enabled": true
4. Select model: Copilot Chat sidebar → model picker (top-right) → Claude Sonnet 4.6
```

**Recommended Copilot settings.json additions:**
```jsonc
{
  // ─── GitHub Copilot ────────────────────────────────────
  "github.copilot.enable": {
    "*": true,
    "markdown": false,       // avoid hallucinated doc completions
    "plaintext": false
  },
  "github.copilot.chat.agent.enabled": true,
  "github.copilot.editor.enableAutoCompletions": true,
  "github.copilot.renameSuggestions.triggerAutomatically": true,
  "chat.editor.fontFamily": "JetBrains Mono",  // readable chat output
}
```

### Step 3 — Cline Setup (optional, BYOK)

```
1. Install: ext install saoudrizwan.claude-dev
2. Open Cline sidebar (robot icon in Activity Bar)
3. Settings → API Provider → Anthropic
4. Paste your ANTHROPIC_API_KEY
5. Select model: claude-sonnet-4-6 (best speed/intelligence ratio)
```

**Cline settings.json:**
```jsonc
{
  // ─── Cline ─────────────────────────────────────────────
  "cline.preferredLanguage": "English",
  "cline.enableCheckpoints": true,   // snapshot before each destructive action
  "cline.alwaysAllowReadOnly": true, // skip confirm on file reads
}
```

### Step 4 — The Hybrid Workflow

```
Daily coding:
  → Copilot handles completions as you type (Tab to accept)
  → Copilot Chat for quick questions, inline explain/fix

Complex task (refactor, debug, new feature):
  → Open integrated terminal
  → claude "refactor the auth module to use Effect-TS layers"
  → Claude Code reads the entire codebase, proposes changes, runs tests

BYOK / budget mode:
  → Replace Copilot Chat with Cline sidebar
  → Cline for agentic tasks, Copilot for completions only
```

## Workspace Settings Block (copy-paste ready)

```jsonc
{
  // ─── AI Agent Stack ────────────────────────────────────
  // Copilot
  "github.copilot.enable": { "*": true, "markdown": false, "plaintext": false },
  "github.copilot.chat.agent.enabled": true,
  "github.copilot.editor.enableAutoCompletions": true,

  // Inline AI suggestions — don't clash with manual intellisense trigger
  "editor.inlineSuggest.enabled": true,
  "editor.inlineSuggest.suppressSuggestions": false,

  // Chat panel
  "chat.editor.fontFamily": "JetBrains Mono",
  "chat.editor.fontSize": 13,

  // Claude Code lives in the terminal — keep terminal performant
  "terminal.integrated.gpuAcceleration": "on",
  "terminal.integrated.fontSize": 13,
  "terminal.integrated.lineHeight": 1.3,
  "terminal.integrated.scrollback": 5000,
}
```

## Extension Install Commands

```bash
# Install all at once via CLI
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat
code --install-extension saoudrizwan.claude-dev    # Cline
code --install-extension Continue.continue          # Continue.dev (optional)
```

## Quality Gates

Before considering the AI stack configured:
- [ ] `claude --version` returns without error in VS Code terminal
- [ ] Copilot ghost text appears when typing in a `.ts` file
- [ ] Copilot Chat responds in the sidebar panel
- [ ] Claude Code can `ls` and read files in your project directory
- [ ] No two tools are fighting for the same Tab keypress (check keybindings)

## Keybinding — Prevent Conflicts

```jsonc
// keybindings.json — accept Copilot with Tab, dismiss with Escape
{ "key": "tab",    "command": "editor.action.inlineSuggest.commit",
  "when": "inlineSuggestionVisible && !editorTabMovesFocus" },
{ "key": "escape", "command": "editor.action.inlineSuggest.hide",
  "when": "inlineSuggestionVisible" },

// Open Copilot Chat
{ "key": "ctrl+shift+i", "command": "workbench.panel.chat.view.copilot.focus" },

// Open Cline sidebar
{ "key": "ctrl+shift+a", "command": "workbench.view.extension.claude-dev-sidebar" }
```

## Activation Triggers

- "Set up AI coding tools in VS Code"
- "How do I use Claude Code with VS Code?"
- "Configure GitHub Copilot agent mode"
- "Best AI coding setup 2025 / 2026"
- "Should I use Cline or Copilot?"
- "How do I use multiple AI tools together?"
- "Set up Continue.dev / BYOK AI in VS Code"
- "What's the difference between Claude Code and Cursor?"

## Skill Chain

**Feeds into**: `vscode-debug-profiler` (once AI tools are running, configure profiling to validate AI-suggested changes) → `elite-skill-forge` (use Claude Code to generate new skills from inside VS Code).

**Creative combination**: Pair with `vscode-monorepo-forge` to configure workspace-scoped AI settings per package — the web app gets Copilot tuned for React/Tailwind, the API gets it tuned for Fastify/Prisma.
