---
name: forge
description: >
  Generate a new production-grade SKILL.md file for any domain or workflow using the
  elite-skill-forge protocol. Outputs a complete, immediately-installable SKILL.md and
  updates registry.json automatically. Triggers on /forge or "create a skill for X",
  "make a new skill", "generate a skill that does Y".
argument-hint: [domain or workflow description]
allowed-tools: Read, Write, Edit, Bash(jq:*), Bash(cat:*), Bash(echo:*)
user-invocable: true
---

## Skill Forge Activation

**Domain / workflow to skill-ify:** $ARGUMENTS

**Existing suite context:**
!`jq -r '.skills | map(.name) | join(", ")' registry.json 2>/dev/null || echo "registry.json not found — run: make validate"`

---

Execute the `elite-skill-forge` protocol to generate a new, production-grade skill.

### Step 1 — Intake Analysis

Read the domain description above. Determine:
1. Is this a single focused skill or should it be decomposed into 2+ skills?
2. Does a similar skill already exist in the registry above? (If so, propose an enhancement instead of a duplicate.)
3. Which existing skills does this new one depend on or pair with?
4. Which product verticals does it serve? (TaxBridge / SabiScore / Hashablanca / SwarmX / all)

### Step 2 — Generate the SKILL.md

Produce a complete SKILL.md following the elite-skill-forge quality gate:
- [ ] `name`: lowercase-hyphenated, 3–64 chars, no reserved words
- [ ] `description`: 10–200 chars, 5+ trigger phrases embedded
- [ ] Body: behavioral protocol, concrete code examples, quality gates, activation triggers (8+ phrases)
- [ ] No vague instructions — every step is concrete and checkable
- [ ] Pairs with existing skills explicitly named

Output the file content wrapped in a code block labeled with the suggested path:
```
Path: .ai/skills/<name>/SKILL.md
```

### Step 3 — Registry Entry

After generating the SKILL.md, produce the JSON registry entry to append to `registry.json`:

```json
{
  "name": "<name>",
  "version": "1.0.0",
  "description": "<one-sentence summary>",
  "cluster": <number>,
  "clusterName": "<cluster>",
  "installOrder": <next available>,
  "filePath": ".ai/skills/<name>/SKILL.md",
  "triggers": ["<5+ trigger phrases>"],
  "dependencies": [],
  "pairedWith": [],
  "verticals": ["all"],
  "tags": []
}
```

### Step 4 — Installation Instructions

Tell the user:
1. Exact file path to save the SKILL.md
2. The `jq` command to append the registry entry to `registry.json`
3. `make validate` to confirm schema compliance
4. How to install it in Claude.ai (Settings → Skills → Install from file)
