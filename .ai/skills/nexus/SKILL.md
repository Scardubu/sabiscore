---
name: nexus
description: Mandatory first-step orchestrator for non-trivial engineering work in this repository. Classifies intent, selects the minimum relevant skills, orders execution, resolves conflicts, and emits a NEXUS trace. Do not use it to create skills; route skill-authoring to elite-skill-forge.
---

# NEXUS — Codex orchestration skill

Use this skill before substantive repository analysis, coding, debugging, testing,
security, architecture, deployment, or release work.

## Procedure

1. Read the user's request and inspect the repository context needed to understand it.
2. Read `/NEXUS.md` from the repository root.
3. Classify all applicable intent types.
4. Select the smallest sufficient skill graph from the registry.
5. Order the skills by dependency and NEXUS conflict priority.
6. Activate the selected Codex skills explicitly when available.
7. If a selected skill is not discovered, read
   `.ai/skills/<skill-name>/SKILL.md` directly and report the bridge issue.
8. Apply nested `AGENTS.md` instructions for every directory you modify.
9. Execute the work; do not stop after routing.
10. Validate changes using repository-defined commands.

## Required trace

```text
┌─ NEXUS ────────────────────────────────────────────────┐
│ Task:      <intent classification>                     │
│ Skills:    <skill-a → skill-b → skill-c>               │
│ Order:     <1. skill-a  2. skill-b  3. skill-c>        │
│ Overrides: <conflict resolution or NONE>               │
│ Risk:      <material risk or NONE>                     │
└────────────────────────────────────────────────────────┘
```

## Selection rules

- Never activate the entire registry by default.
- Prefer domain-specific skills over generic personas.
- Security and safety override convenience.
- Correctness and testability override performance and aesthetics.
- Repository code and tests override stale prose.
- `elite-skill-forge` is the only route for creating or upgrading skills.
- A skill trace is not proof that a skill was applied; follow its instructions.

## Completion

Report evidence inspected, findings, changes, tests, remaining risks, and any action
that could not be performed. Never claim unexecuted work.
