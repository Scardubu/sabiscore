---
name: typescript-config-surgeon
description: >
  Surgically audits and generates tsconfig.json, ESLint flat config, Prettier config, and
  their integration for TypeScript strict mode projects. Diagnoses and fixes common
  misconfigurations: wrong moduleResolution, path alias issues, slow type-checking, ESLint
  and Prettier conflicts, and monorepo project references. Use this skill whenever a user
  asks to configure TypeScript, fix tsconfig.json, set up ESLint for TypeScript, resolve
  Prettier/ESLint conflicts, fix path aliases, speed up TypeScript builds, set up project
  references in a monorepo, or says "my TypeScript is slow", "path aliases aren't working",
  "ESLint and Prettier are conflicting", "tsconfig.json is wrong", "strict mode errors",
  "fix my TypeScript config", or "set up ESLint flat config". Always use this skill for
  TypeScript toolchain configuration — these files have subtle interdependencies that cause
  hours of debugging if wrong.
---

# TypeScript Config Surgeon

Audit and generate precise TypeScript toolchain configurations. Every setting is justified.
Every conflict is resolved. Every path alias works.

## The Configuration Stack

```
tsconfig.json          ← TypeScript compiler options + project references
eslint.config.ts       ← ESLint flat config (ESLint 9+) with TS rules
.prettierrc.json       ← Prettier formatting rules
.prettierignore        ← Exclude from formatting
package.json scripts   ← typecheck, lint, format commands
```

These four files must be coordinated. Conflicts between them — especially ESLint ↔ Prettier —
are the #1 source of "linting is broken" issues.

## Protocol

### Step 1 — Classify

Identify:
- **Project type**: single app, library, or monorepo with project references?
- **Stack**: Next.js 15, Fastify/Node, React library, or mixed?
- **Current pain**: slow builds, wrong errors, path aliases broken, ESLint fighting Prettier?
- **ESLint version**: v8 (`.eslintrc.json`) or v9 (flat `eslint.config.ts`)?

Default to: **Next.js 15 + ESLint 9 flat config + Prettier** if not specified.

### Step 2 — Generate `tsconfig.json`

**Base (shared across all project types):**
```jsonc
// tsconfig.base.json (for monorepos) or tsconfig.json (single app)
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // ─── Module System ─────────────────────────────────
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",    // ← for Next.js/Vite; use "node16" for pure Node
    "moduleDetection": "force",       // treat all files as modules
    "verbatimModuleSyntax": true,     // preserves import type for tree-shaking

    // ─── Emit ──────────────────────────────────────────
    "noEmit": true,                   // Next.js handles emit; tsc is type-check only
    "sourceMap": true,
    "inlineSources": true,            // embed source in map — reliable debugger attach
    "declaration": false,             // set true only for library packages

    // ─── Strict Mode (all enabled, no exceptions) ──────
    "strict": true,                   // enables all strict flags below
    "noUncheckedIndexedAccess": true, // arr[0] is T | undefined, not T
    "noImplicitReturns": true,        // every code path must return
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true, // optional prop ≠ prop | undefined
    "noPropertyAccessFromIndexSignature": true,

    // ─── Imports ────────────────────────────────────────
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,          // required for SWC/esbuild transforms

    // ─── Path Aliases ───────────────────────────────────
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    },

    // ─── Performance ────────────────────────────────────
    "skipLibCheck": true,             // skip .d.ts checks in node_modules — major speedup
    "incremental": true,              // cache build info
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", ".next"]
}
```

**Next.js 15 override (extends base):**
```jsonc
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "plugins": [{ "name": "next" }],    // Next.js TS plugin for App Router awareness
    "moduleResolution": "bundler",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

**Node.js / Fastify override:**
```jsonc
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",   // ← Node 22 requires NodeNext, not bundler
    "outDir": "./dist",
    "noEmit": false,                  // Fastify emits compiled output
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Library package (packages/ui):**
```jsonc
// packages/ui/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/*.stories.*", "**/*.test.*"]
}
```

### Step 3 — Generate ESLint Flat Config (ESLint 9+)

```typescript
// eslint.config.ts
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'
import prettierConfig from 'eslint-config-prettier'  // ← MUST be last: disables ESLint formatting rules

export default tseslint.config(
  // ─── Global ignores ──────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/*.config.js',   // avoid linting build configs
      'coverage/**',
    ],
  },

  // ─── Base JS rules ───────────────────────────────────────
  eslint.configs.recommended,

  // ─── TypeScript rules (strict) ───────────────────────────
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,          // use tsconfig.json from each package
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TS-specific overrides
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },  // allow async event handlers in JSX
      }],
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,    // allow ${number} in template literals
      }],
      // Allow explicit any in specific cases (escape hatch)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ─── React rules ─────────────────────────────────────────
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',     // not needed in React 17+
      'react/prop-types': 'off',             // use TypeScript instead
      'react-hooks/exhaustive-deps': 'error', // ← warning is not enough
    },
    settings: { react: { version: 'detect' } },
  },

  // ─── Next.js rules ───────────────────────────────────────
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // ─── Prettier (MUST be last) ─────────────────────────────
  // Disables all ESLint rules that would conflict with Prettier formatting
  prettierConfig,
)
```

### Step 4 — Generate Prettier Config

```jsonc
// .prettierrc.json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "importOrder": [
    "^(react/(.*)$)|^(react$)",
    "^(next/(.*)$)|^(next$)",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@/(.*)$",
    "^[./]"
  ],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"]
}
```

```
# .prettierignore
node_modules
dist
.next
.turbo
coverage
*.min.js
pnpm-lock.yaml
```

### Step 5 — `package.json` Scripts

```jsonc
{
  "scripts": {
    "typecheck":      "tsc --noEmit",
    "typecheck:watch":"tsc --noEmit --watch",
    "lint":           "eslint . --max-warnings 0",
    "lint:fix":       "eslint . --fix",
    "format":         "prettier --write .",
    "format:check":   "prettier --check .",
    "validate":       "pnpm typecheck && pnpm lint && pnpm format:check"
  }
}
```

### Step 6 — Fix Common Failures

**Path aliases not working at runtime (Node.js):**
```bash
# Install: resolves @/* paths in compiled output
pnpm add -D tsconfig-paths
# In package.json:
"dev": "node -r tsconfig-paths/register dist/server.js"
# Or with ts-node:
"dev": "ts-node -r tsconfig-paths/register src/server.ts"
```

**`moduleResolution: "bundler"` causing errors in Node.js:**
```jsonc
// Node.js requires explicit extensions with NodeNext:
// tsconfig.json
{ "moduleResolution": "NodeNext", "module": "NodeNext" }
// imports must include .js extension (resolved to .ts by compiler):
import { handler } from './routes/auth.js'  // ← .js not .ts — this is correct
```

**`exactOptionalPropertyTypes` breaking existing code:**
```typescript
// Problem:
interface Config { debug?: boolean }
const config: Config = { debug: undefined }  // ❌ error with exactOptional

// Fix: explicitly allow undefined when needed
interface Config { debug?: boolean | undefined }
// Or narrow where assigned:
const config: Config = {}  // ✅ omit the property entirely
```

**ESLint `parserOptions.project` performance (slow linting):**
```typescript
// eslint.config.ts — scope type-aware rules to TS files only
{
  files: ['**/*.{ts,tsx}'],  // ← only run type-aware rules on TS files
  languageOptions: {
    parserOptions: { project: true }
  }
}
```

## VS Code Integration

```jsonc
// .vscode/settings.json — wire ESLint and Prettier to VS Code
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]":      { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"  // ← let Prettier sort imports, not VS Code
  },
  "eslint.useFlatConfig": true,        // required for ESLint 9 flat config
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "relative",
}
```

## Quality Gates

- [ ] `pnpm typecheck` exits 0 (no type errors)
- [ ] `pnpm lint` exits 0 with `--max-warnings 0`
- [ ] `pnpm format:check` exits 0 (code is already formatted)
- [ ] `pnpm validate` (all three) exits 0 in CI
- [ ] Path aliases resolve correctly in both VS Code IntelliSense and at runtime
- [ ] No rule in ESLint config conflicts with Prettier (verified by `eslint-config-prettier`)
- [ ] `strict: true` + `noUncheckedIndexedAccess: true` both enabled with zero `@ts-ignore`

## Activation Triggers

- "Configure TypeScript / tsconfig.json for [stack]"
- "Fix my path aliases in TypeScript"
- "ESLint and Prettier are conflicting"
- "My TypeScript type-checking is slow"
- "Set up ESLint flat config for TypeScript"
- "Strict mode is throwing too many errors"
- "Set up TypeScript project references in monorepo"
- "Fix moduleResolution error in Node.js"

## Skill Chain

**Feeds into**: `component-quality-gate` (strict mode surfaces prop contract issues) → `testing-strategy-architect` (Vitest needs tsconfig awareness) → `git-workflow-architect` (typecheck and lint commands belong in CI).

**Creative combination**: Run `typescript-config-surgeon` to establish strict mode, then `component-quality-gate` to find all the prop type violations it surfaces, then `testing-strategy-architect` to write tests that lock in the corrected contracts. The three skills form a quality ratchet.
