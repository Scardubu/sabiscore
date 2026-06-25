---
name: nexus
description: >
  Invoke NEXUS — the 34-skill orchestration engine. Classifies the task intent,
  selects the minimum effective skill graph, defines execution order, and produces
  a Skill Trace Block before any implementation. Use when beginning any engineering
  task to ensure the correct skills are selected in the right dependency order.
  Triggers on /nexus or when the user says "run NEXUS", "route this through NEXUS",
  or "what skills should I use for this".
argument-hint: [describe your task]
allowed-tools: Read, Grep, Glob
user-invocable: true
---

## NEXUS Activation

**Task from user:** $ARGUMENTS

**Live context:**
- Current file: !`git diff --name-only HEAD 2>/dev/null | head -5 || echo "(no recent changes)"`
- Stack summary: !`cat registry.json 2>/dev/null | jq -r '"Suite v" + .suiteVersion + " | " + (.skills | length | tostring) + " skills"' || echo "registry.json not found"`

---

Read `.ai/skills/NEXUS.md` (or the NEXUS section of `CLAUDE.md`) and execute the full NEXUS protocol:

1. **CLASSIFY** — Identify all intent types in the task above.
2. **SELECT** — Build the minimum effective skill graph from the 34-skill registry. No blind-loading.
3. **ORDER** — Resolve dependency order. List skills in execution sequence.
4. **OUTPUT** — Produce the Skill Trace Block:

```
┌─ NEXUS ────────────────────────────────────────────────┐
│ Task:      [one-line classification]                   │
│ Skills:    skill-a → skill-b → skill-c                 │
│ Order:     1. skill-a  2. skill-b  3. skill-c          │
│ Overrides: [conflict resolutions, or NONE]             │
│ Risk:      [critical risks identified, or NONE]        │
└────────────────────────────────────────────────────────┘
```

5. **HAND OFF** — Load the selected skills and begin implementation. Do not implement before the trace block is complete.
