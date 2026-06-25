---
name: vscode-monorepo-forge
description: >
  Generates complete VS Code multi-root workspace configurations for monorepos: .code-workspace
  files, per-package settings.json, launch.json debug configs, tasks.json, and turbo.json
  pipeline definitions. Use this skill whenever a user is working in a monorepo, Turborepo,
  Nx, or pnpm workspace and asks to configure VS Code for it, set up debugging across packages,
  generate a .code-workspace file, configure multi-root workspaces, set up per-package ESLint
  or TypeScript settings, or says "set up VS Code for my monorepo", "configure debugging in
  Turborepo", "my monorepo VS Code setup is a mess", "how do I debug multiple packages at once",
  "create a .code-workspace file", or "configure tasks for my monorepo". Always use this skill
  for any monorepo + VS Code configuration — don't improvise these files without it.
---

# VS Code Monorepo Forge

Generate production-grade VS Code configuration for monorepos. The output is always complete,
copyable files — not fragments. Every generated file is immediately usable.

## Monorepo Structure Assumed

```
my-monorepo/
├── apps/
│   ├── web/          ← Next.js 15 frontend
│   └── api/          ← Fastify 5 backend
├── packages/
│   ├── ui/           ← Shared component library
│   ├── config/       ← Shared ESLint/TS configs
│   └── db/           ← Prisma schema + client
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── my-project.code-workspace   ← GENERATED
```

Adapt all generated files to the user's actual structure.

## Protocol

### Step 1 — Intake

Ask only if not already clear:
- **Package manager**: pnpm (preferred), yarn, npm?
- **Apps in the monorepo**: names and tech stacks?
- **Primary pain point**: Explorer noise? Slow watcher? Can't debug across packages?

If the user shares their directory structure or `package.json`, extract from it directly.

### Step 2 — Generate the `.code-workspace` File

```jsonc
// my-project.code-workspace
{
  "folders": [
    { "name": "🏗️  Root",    "path": "." },
    { "name": "🌐  Web",     "path": "apps/web" },
    { "name": "⚡  API",     "path": "apps/api" },
    { "name": "🎨  UI",      "path": "packages/ui" },
    { "name": "🗄️  DB",      "path": "packages/db" },
    { "name": "⚙️  Config",  "path": "packages/config" }
  ],
  "settings": {
    // ─── Explorer: hide noise ────────────────────────────
    "files.exclude": {
      "**/node_modules": true,
      "**/.turbo": true,
      "**/.next": true,
      "**/dist": true,
      "**/.cache": true
    },
    "files.watcherExclude": {
      "**/node_modules/**": true,
      "**/.turbo/**": true,
      "**/.next/**": true,
      "**/dist/**": true
    },
    // ─── Search: exclude build artifacts ─────────────────
    "search.exclude": {
      "**/node_modules": true,
      "**/dist": true,
      "**/.next": true,
      "**/.turbo": true,
      "**/pnpm-lock.yaml": true
    },
    // ─── TypeScript: workspace version ───────────────────
    "typescript.tsdk": "node_modules/typescript/lib",
    "typescript.enablePromptUseWorkspaceTsdk": true,
    // ─── ESLint: per-package working dirs ────────────────
    "eslint.workingDirectories": [
      { "mode": "auto" }
    ],
    // ─── Editor ──────────────────────────────────────────
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit",
      "source.organizeImports": "explicit"
    },
    // ─── Git ─────────────────────────────────────────────
    "git.detectSubmodules": false,
    "gitlens.blame.format": "${author|10} ${agoOrDate|14}"
  },
  "extensions": {
    "recommendations": [
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint",
      "bradlc.vscode-tailwindcss",
      "Prisma.prisma",
      "ms-vscode.vscode-typescript-next",
      "usernamehw.errorlens",
      "eamodio.gitlens",
      "yoavbls.pretty-ts-errors",
      "folke.vscode-monorepo-workspace",
      "ms-vscode-remote.remote-containers"
    ]
  }
}
```

### Step 3 — Generate `launch.json` (Debug All Apps)

Place at monorepo root `.vscode/launch.json`:

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    // ─── Next.js Web App ────────────────────────────────
    {
      "name": "🌐 Next.js: Web",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/apps/web",
      "env": { "NODE_ENV": "development" },
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "console": "integratedTerminal",
      "restart": true
    },
    // ─── Fastify API ─────────────────────────────────────
    {
      "name": "⚡ Fastify: API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/apps/api",
      "env": { "NODE_ENV": "development" },
      "sourceMaps": true,
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal",
      "restart": true
    },
    // ─── CPU Profiler (API) ──────────────────────────────
    {
      "name": "🔬 Profile: API CPU",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/apps/api",
      "profileStartup": true,
      "console": "integratedTerminal"
    },
    // ─── Jest: Current File ──────────────────────────────
    {
      "name": "🧪 Jest: Current File",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["${fileBasenameNoExtension}", "--no-coverage", "--watch"],
      "cwd": "${fileDirname}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    // ─── Prisma Studio ───────────────────────────────────
    {
      "name": "🗄️ Prisma: Studio",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/prisma",
      "args": ["studio"],
      "cwd": "${workspaceFolder}/packages/db",
      "console": "integratedTerminal"
    }
  ],
  "compounds": [
    {
      "name": "🚀 Full Stack: Web + API",
      "configurations": ["🌐 Next.js: Web", "⚡ Fastify: API"],
      "stopAll": true
    }
  ]
}
```

### Step 4 — Generate `tasks.json`

Place at monorepo root `.vscode/tasks.json`:

```jsonc
{
  "version": "2.0.0",
  "tasks": [
    // ─── Turbo: Dev ──────────────────────────────────────
    {
      "label": "turbo: dev",
      "type": "shell",
      "command": "pnpm turbo dev",
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "isBackground": true,
      "problemMatcher": {
        "owner": "typescript",
        "pattern": { "regexp": "." },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "Starting",
          "endsPattern": "Ready"
        }
      }
    },
    // ─── Turbo: Build ────────────────────────────────────
    {
      "label": "turbo: build",
      "type": "shell",
      "command": "pnpm turbo build",
      "group": { "kind": "build", "isDefault": true },
      "presentation": { "reveal": "always", "panel": "shared" }
    },
    // ─── Turbo: Type-Check ───────────────────────────────
    {
      "label": "turbo: typecheck",
      "type": "shell",
      "command": "pnpm turbo typecheck",
      "group": "test",
      "presentation": { "reveal": "always", "panel": "dedicated" }
    },
    // ─── Prisma: Generate ────────────────────────────────
    {
      "label": "prisma: generate",
      "type": "shell",
      "command": "pnpm --filter db prisma generate",
      "group": "none",
      "presentation": { "reveal": "silent", "panel": "shared" }
    },
    // ─── Prisma: Migrate Dev ─────────────────────────────
    {
      "label": "prisma: migrate dev",
      "type": "shell",
      "command": "pnpm --filter db prisma migrate dev",
      "group": "none",
      "presentation": { "reveal": "always", "panel": "dedicated" }
    },
    // ─── Clean: All Artifacts ────────────────────────────
    {
      "label": "clean: all",
      "type": "shell",
      "command": "find . -name '.turbo' -o -name 'dist' -o -name '.next' | grep -v node_modules | xargs rm -rf",
      "group": "none",
      "presentation": { "reveal": "silent" }
    }
  ]
}
```

### Step 5 — Generate `turbo.json` Pipeline

```jsonc
// turbo.json (root)
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env.local"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["**/*.ts", "**/*.tsx", "tsconfig.json"]
    },
    "lint": {
      "inputs": ["**/*.ts", "**/*.tsx", ".eslintrc.*", "eslint.config.*"]
    },
    "test": {
      "inputs": ["**/*.ts", "**/*.tsx", "jest.config.*"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Step 6 — Per-Package Settings

Generate a `.vscode/settings.json` per app package:

**apps/web/.vscode/settings.json** (Next.js):
```jsonc
{
  "typescript.tsdk": "../../node_modules/typescript/lib",
  "files.associations": { "*.css": "tailwindcss" },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
}
```

**apps/api/.vscode/settings.json** (Fastify):
```jsonc
{
  "typescript.tsdk": "../../node_modules/typescript/lib",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.workingDirectories": [{ "directory": ".", "changeProcessCWD": true }],
  "node.terminal.startArgs": ["--inspect"],  // auto-enable debugger attach
}
```

## Installation Steps (one-time)

```bash
# 1. Install recommended extensions from the workspace file
# VS Code will prompt automatically — click "Install All"

# Or manually:
code --install-extension folke.vscode-monorepo-workspace
code --install-extension karrettgelley.monolithium

# 2. Open the workspace file (not a folder)
code my-project.code-workspace

# 3. Trust the workspace when prompted

# 4. Select TypeScript version
# Ctrl+Shift+P → "TypeScript: Select TypeScript Version" → "Use Workspace Version"
```

## Key Keybindings to Add

```jsonc
// Run turbo dev (full stack)
{ "key": "ctrl+shift+d", "command": "workbench.action.tasks.runTask",
  "args": "turbo: dev" },
// Run type-check
{ "key": "ctrl+shift+t", "command": "workbench.action.tasks.runTask",
  "args": "turbo: typecheck" },
// Run full-stack debug compound
{ "key": "ctrl+shift+f5", "command": "workbench.action.debug.selectandstart" }
```

## Quality Gates

- [ ] File explorer shows no `node_modules`, `.next`, `.turbo`, or `dist` folders
- [ ] Search results exclude build artifacts and lockfiles
- [ ] `turbo: dev` task starts all apps and shows logs in the terminal
- [ ] Full-stack debug compound attaches to both web and API simultaneously
- [ ] TypeScript uses workspace version (not VS Code's bundled version)
- [ ] ESLint resolves correctly per-package (no "no config found" errors)

## Activation Triggers

- "Set up VS Code for my monorepo"
- "Configure debugging in Turborepo"
- "Generate a .code-workspace file"
- "My monorepo VS Code setup is a mess"
- "How do I debug multiple packages at once in VS Code?"
- "Configure pnpm workspace in VS Code"
- "Generate tasks.json for Turborepo"
- "VS Code search is finding stuff in node_modules"

## Skill Chain

**Feeds into**: `typescript-config-surgeon` (the generated workspace exposes per-package tsconfig gaps) → `git-workflow-architect` (monorepo needs branch strategy + conventional commits) → `vscode-debug-profiler` (launch.json generated here feeds directly into profiling workflows).

**Creative combination**: After generating the `.code-workspace`, immediately run `vscode-ai-agent-stack` to add per-folder AI context. Then `git-workflow-architect` to wire CI that validates across all packages. Full DX stack in three invocations.
