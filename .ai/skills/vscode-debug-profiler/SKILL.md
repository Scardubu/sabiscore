---
name: vscode-debug-profiler
description: >
  Configures and guides VS Code debugging and performance profiling for Node.js, Fastify,
  Next.js, and frontend applications. Generates launch.json configurations, explains CPU and
  memory profiling workflows, identifies performance bottlenecks, and documents advanced debugger
  features. Use this skill whenever a user wants to debug a Node.js or Next.js app in VS Code,
  profile CPU or memory usage, find a memory leak, set up breakpoints, configure source maps,
  asks "how do I debug this in VS Code", "my Node.js app is slow", "how do I find a memory leak",
  "set up launch.json for Fastify / Next.js", "how do I use the VS Code profiler", "CPU profile
  shows bottleneck", or "attach debugger to a running process". Always use this skill for
  debugging and profiling setup — these configs have non-obvious gotchas that this skill handles.
---

# VS Code Debug & Profiler

Configure and run production-grade debugging and performance profiling in VS Code for
Node.js backends and Next.js frontends. Every config is complete and immediately usable.

## Three Profiling Tools in VS Code

| Tool | Use for |
|---|---|
| **CPU Profile** | Slow endpoints, hot loops, blocking main thread |
| **Memory Profile (Heap)** | Memory leaks, unbounded growth, GC pressure |
| **Performance Profile** | Overall timeline — async waterfalls, render blocking |

All three are available in VS Code's built-in debugger. No extra tools required.

## Protocol

### Step 1 — Classify the Problem

Identify what the user is trying to debug:

| Symptom | Diagnosis | Tool |
|---|---|---|
| Endpoint is slow | CPU bottleneck or async waterfall | CPU Profile |
| Memory grows over time | Memory leak | Heap Snapshot + allocation timeline |
| App crashes on load | Startup error or unhandled rejection | Node debugger with breakpoints |
| Tests are failing inconsistently | Race condition or timing issue | Debugger + async call stack |
| Browser UI is janky | Long JS tasks blocking render | Browser DevTools performance tab |

### Step 2 — Generate `launch.json`

**For Node.js / Fastify:**
```jsonc
{
  "version": "0.2.0",
  "configurations": [
    // ─── Attach to running process ─────────────────────
    {
      "name": "🔌 Node: Attach (port 9229)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "sourceMaps": true,
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**"
      ],
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"]
    },
    // ─── Launch with debugger ──────────────────────────
    {
      "name": "🚀 Fastify: Debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}",
      "env": { "NODE_ENV": "development" },
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "console": "integratedTerminal",
      "restart": true,
      "autoAttachChildProcesses": true
    },
    // ─── CPU Profile ──────────────────────────────────
    {
      "name": "🔬 CPU Profile: Fastify",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}",
      "profileStartup": false,
      "console": "integratedTerminal"
      // After launch: Debug toolbar → "Take Performance Profile" button
    },
    // ─── Memory Leak Detection ────────────────────────
    {
      "name": "🧠 Heap Snapshot: Fastify",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--expose-gc", "--max-old-space-size=512"],
      "program": "${workspaceFolder}/src/server.ts",
      "cwd": "${workspaceFolder}",
      "sourceMaps": true,
      "console": "integratedTerminal"
      // After launch: Debug toolbar → "Take Heap Snapshot" button
    },
    // ─── Next.js Server-Side ─────────────────────────
    {
      "name": "🌐 Next.js: Server Debug",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}",
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "env": { "NODE_OPTIONS": "--inspect" },
      "console": "integratedTerminal"
    },
    // ─── Next.js Client-Side (Chrome) ────────────────
    {
      "name": "🌐 Next.js: Client Debug (Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
      "sourceMapPathOverrides": {
        "webpack://_N_E/*": "${workspaceFolder}/*"
      }
    },
    // ─── Jest: Debug Current Test ────────────────────
    {
      "name": "🧪 Jest: Debug Current File",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-coverage",
        "${fileBasenameNoExtension}"
      ],
      "cwd": "${fileDirname}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "sourceMaps": true
    }
  ]
}
```

**Start a process with inspector enabled (for attach mode):**
```bash
# In package.json scripts:
"dev:debug": "node --inspect=0.0.0.0:9229 -r ts-node/register src/server.ts"
# Or with tsx:
"dev:debug": "node --inspect tsx watch src/server.ts"
```

### Step 3 — CPU Profiling Workflow (step-by-step)

**Goal**: Find what's consuming CPU in a slow endpoint.

```
1. Run "🔬 CPU Profile: Fastify" launch config
2. App starts in debug mode
3. In Debug toolbar → click "Take Performance Profile" (circle icon)
4. Select "Manual" stop option
5. Send requests to the slow endpoint (use Thunder Client or curl)
6. Stop the profile: click the stop button in the profiling controls
7. VS Code opens a .cpuprofile flame chart
```

**Reading the flame chart:**
- Wide bars = time-consuming functions (start here)
- Stack depth = call depth (deep = potentially recursive or inefficient)
- Self time vs total time: "Self" excludes children — isolates the actual bottleneck
- Look for: synchronous `JSON.parse`/`JSON.stringify` on large objects, blocking loops,
  synchronous `fs` calls, unparallelized `await` chains (waterfall pattern)

**Common Node.js bottlenecks and fixes:**

| Bottleneck | Symptom in flame chart | Fix |
|---|---|---|
| Async waterfall | Many sequential `await` blocks | `Promise.all([...])` or `Effect.all(..., {concurrency: N})` |
| Blocking JSON | Large `JSON.parse` at top of stack | Stream parsing or partial reads |
| N+1 query | `prisma.findUnique` called N times in a loop | `prisma.findMany` with `where: { id: { in: ids } }` |
| Synchronous crypto | `crypto.pbkdf2Sync` | Switch to async `crypto.pbkdf2` |

### Step 4 — Memory Leak Detection (step-by-step)

**Goal**: Find what's accumulating in the heap over time.

```
1. Run "🧠 Heap Snapshot: Fastify" launch config
2. Navigate to: Run & Debug panel → Call Stack → click process name
3. Memory tab appears → click "Take Heap Snapshot" (baseline)
4. Send 100–500 requests to the leaky endpoint (use Apache Bench or k6)
5. Take another heap snapshot
6. Compare: select snapshot 2 → filter "Objects allocated between..."
7. Look for growing arrays, retained DOM nodes, EventEmitter listeners, closures
```

**Common memory leaks and fixes:**

| Leak type | How it shows in heap | Fix |
|---|---|---|
| EventEmitter listeners | `EventEmitter` instances growing | `emitter.removeListener()` or `{ once: true }` |
| Unbounded cache | `Map` or plain object growing without eviction | Add LRU eviction (`lru-cache`) |
| Closed-over variables in timers | Function scopes retained by `setInterval` | `clearInterval` on shutdown |
| Prisma connection pool | Connection objects not returned | Ensure `await db.$disconnect()` in shutdown |

### Step 5 — Source Map Debugging (fixing "can't find source" errors)

Source map issues are the most common debugger setup problem. Fix in order:

```jsonc
// In launch.json, always include both:
"sourceMaps": true,
"resolveSourceMapLocations": [
  "${workspaceFolder}/**",
  "!**/node_modules/**"
],
// For Next.js specifically:
"sourceMapPathOverrides": {
  "webpack://_N_E/*": "${workspaceFolder}/*",
  "webpack:///./*": "${workspaceFolder}/*"
}
```

```jsonc
// In tsconfig.json, ensure:
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSources": true,   // embeds source in the map — most reliable
    "outDir": "./dist"
  }
}
```

### Step 6 — Advanced Debugger Features

**Conditional breakpoints**: Right-click a breakpoint → "Edit Breakpoint"
```
// Only break when userId is a specific value:
userId === "user_abc123"

// Only break after 50 hits (find intermittent bugs):
hitCount: 50
```

**Logpoints**: Right-click line gutter → "Add Logpoint" — logs without `console.log` in code
```
// In logpoint expression:
Request received: {req.method} {req.url} — user: {req.user?.id}
```

**Watch expressions**: Debug panel → WATCH → `+` → add any expression
```
// Useful watches:
process.memoryUsage().heapUsed / 1024 / 1024   // heap in MB
Object.keys(cache).length                         // cache size
```

## Required Extensions

```bash
code --install-extension ms-vscode.js-debug          # Node.js debugger (built-in, ensure updated)
code --install-extension rangav.vscode-thunder-client # HTTP client for sending test requests
```

## Quick Reference: Debug Toolbar

```
▶  Continue (F5)          — resume after breakpoint
⏭  Step Over (F10)        — execute line, don't enter function
⬇  Step Into (F11)        — enter the called function
⬆  Step Out (Shift+F11)  — finish current function, return to caller
⟳  Restart (Ctrl+Shift+F5)
⏹  Stop (Shift+F5)

⊙  Take CPU Profile       — appears when process is paused
📷 Take Heap Snapshot     — memory tab, appears on process node
```

## Quality Gates

- [ ] Breakpoints hit correctly with source mapped to TypeScript (not compiled JS)
- [ ] `--inspect` flag enabled for all `dev` scripts (or use attach mode)
- [ ] CPU profile flame chart readable (not showing only `<anonymous>` nodes)
- [ ] Heap snapshot shows user code (not only V8 internals)
- [ ] Jest debugger stops at test breakpoints, not inside Jest internals

## Activation Triggers

- "How do I debug this in VS Code?"
- "Set up launch.json for Fastify / Next.js"
- "How do I find a memory leak in Node.js?"
- "My endpoint is slow — how do I profile it?"
- "Breakpoints aren't hitting in VS Code"
- "Source maps not working in VS Code debugger"
- "How do I use the VS Code CPU profiler?"
- "Attach VS Code debugger to a running process"

## Skill Chain

**Feeds into**: `opentelemetry-observability-architect` (what you find locally with the profiler, instrument in production with OTel) → `backend-systems-auditor` (profiler findings often reveal idempotency or shutdown issues).

**Creative combination**: Use `vscode-debug-profiler` to find a slow Prisma query in development, then `prisma-database-architect` to fix the query and add the right index, then `opentelemetry-observability-architect` to confirm the fix in production via traces.
