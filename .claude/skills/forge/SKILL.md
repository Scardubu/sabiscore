---
name: forge
description: >
  Generate a new production-grade SKILL.md file for any domain or workflow using the
  elite-skill-forge protocol. Performs duplicate detection against the 34-skill registry,
  determines the correct cluster placement, generates a complete installable SKILL.md with
  behavioral protocols and SabiScore/monorepo context awareness, and produces the registry
  entry and installation steps. Triggers: /forge, "create a skill for X", "make a new skill",
  "generate a skill that does Y", "turn this into a skill", "I need a skill for Z",
  "package this workflow as a skill", "skill for my new vertical", "add a skill to the suite".
argument-hint: "[domain, workflow, or vertical description — be specific about what problem it solves]"
allowed-tools: Read, Write, Edit, Bash(jq:*), Bash(cat:*), Bash(echo:*), Bash(find:*), Glob
user-invocable: true
---

## Skill Forge Activation

**Domain / workflow to skill-ify:** $ARGUMENTS

**Existing suite context (read before generating — avoid duplicates):**

```
Installed skills:
!`jq -r '.skills | map("  [" + (.cluster | tostring) + "] " + .name + " — " + .description[:60]) | join("\n")' .ai/registry.json 2>/dev/null || echo "  (registry.json not found — run: make validate to generate it)"`

Suite version: !`jq -r '.suiteVersion' .ai/registry.json 2>/dev/null || echo "unknown"`
Total skills:  !`jq -r '.skills | length' .ai/registry.json 2>/dev/null || echo "0"`
```

**Active verticals in this repo:** SabiScore · TaxBridge · Hashablanca · SwarmX

---

## FORGE PROTOCOL — Execute All Five Steps

---

### Step 1 — Intake Analysis

Read the domain description above. Answer each question explicitly before proceeding:

**1a. Decomposition check**
Is this a single focused skill, or should it be decomposed into 2+ skills?
- A skill solves ONE problem well. If the description contains "and also" or "as well as" with unrelated concerns, split it.
- Rule of thumb: if two different intent types from the NEXUS classifier apply, they belong in separate skills.

**1b. Duplicate / overlap check**
Does a similar skill already exist in the registry above?
- List any overlapping skills found.
- If overlap is ≥ 70% coverage: propose an **enhancement** to the existing skill instead of a new file.
- If overlap is 30–70%: propose a new skill that explicitly **pairs with** the overlapping skill with non-overlapping scope.
- If overlap is < 30%: proceed with new skill generation.

**1c. Cluster assignment**
Which cluster does this skill belong to?

| Cluster | Name | Scope |
|---|---|---|
| 1 | Editor & Environment | VS Code, tsconfig, Git, monorepo tooling |
| 2 | Frontend Design | Components, tokens, a11y, motion, charts, product design |
| 3 | Backend Engineering | Fastify, FastAPI, Prisma, Alembic, BullMQ, SQLAlchemy, Effect-TS |
| 4 | Application Layer | Next.js, Auth, Testing, AI SDK, Prompt engineering, Release |
| 5 | Mobile & Meta | Expo/RN, skill generation itself |
| 6 | Vertical Intelligence | Nigerian fintech, Multi-agent orchestration, **SabiScore domain** |
| 7 | Real-Time & Data | WebSocket/SSE, data visualization |

**1d. Vertical scope**
Which product verticals does this skill serve?
- `SabiScore` — provider gateway, evidence, betting engine, /intelligence UI, ML pipeline
- `TaxBridge` — Nigerian tax compliance, FIRS, BullMQ, kobo arithmetic
- `Hashablanca` — blockchain analytics
- `SwarmX` — multi-agent orchestration, BullMQ chains, LLM routing
- `all` — cross-vertical concerns

**1e. Dependency map**
Which existing skills does this new one:
- **Require** to run first? (e.g., a SabiScore provider skill would require `backend-systems-auditor` first)
- **Pair well with** in a skill chain recipe?
- **Must never conflict with**?

---

### Step 2 — Generate the SKILL.md

Produce a complete SKILL.md following the elite-skill-forge quality gate:

#### Quality gate checklist (verify every item before outputting)

- [ ] `name`: lowercase-hyphenated, 3–64 chars, globally unique, no reserved words (`nexus`, `forge`, `audit`)
- [ ] `description`: 10–250 chars, 6+ distinct trigger phrases embedded, states what problem it solves
- [ ] `argument-hint`: concise hint for what argument to pass with the slash command
- [ ] `allowed-tools`: explicit list, never wildcard `Bash(*)`
- [ ] Body: behavioral protocol with numbered steps, not a bulleted wish list
- [ ] Every step is concrete and checkable — no vague directives like "ensure quality"
- [ ] At least 2 code examples (showing real code patterns, not pseudocode)
- [ ] At least 1 quality gate or checklist embedded in the body
- [ ] Activation triggers section with 8+ phrases
- [ ] Pairs-with section naming existing skills explicitly
- [ ] SabiScore/vertical-specific constraints noted where applicable
- [ ] No placeholder text — every section has real content

Output the file content wrapped in a code block labeled with the suggested path:

```
Path: .ai/skills/<name>/SKILL.md
```

**Skill body structure template** (adapt as needed):

```markdown
---
name: <name>
description: >
  <10–250 chars with 6+ trigger phrases>
argument-hint: "<what to pass as $ARGUMENTS>"
allowed-tools: Read, Grep, Glob, Bash(<specific commands>:*)
user-invocable: true
---

# <Skill Display Name>

<One paragraph: what problem this skill solves and why it matters. What goes wrong without it.>

## Core Principles

- <Non-negotiable principle 1>
- <Non-negotiable principle 2>
- <Non-negotiable principle 3>

---

## Step 1 — <First Action>

<Concrete instruction, not vague.>

```<language>
// Real code example, not pseudocode
<actual implementation pattern>
```

<Why this pattern, and what breaks if you skip it.>

## Step 2 — <Second Action>

...

## Quality Gate

Before finishing, verify:

- [ ] <Checkable criterion 1>
- [ ] <Checkable criterion 2>
- [ ] <Checkable criterion 3>

## Activation Triggers

Use this skill when:
- "<trigger phrase 1>"
- "<trigger phrase 2>"
...
(8+ phrases minimum)

## Pairs With

- `<existing-skill-name>` — <why and in what order>
- `<existing-skill-name>` — <why and in what order>

## Vertical Notes

**SabiScore:** <specific constraints or patterns for this vertical>
**TaxBridge:** <specific constraints or patterns for this vertical>
```

---

### Step 3 — Registry Entry

After generating the SKILL.md, produce the JSON registry entry:

```json
{
  "name": "<name>",
  "version": "1.0.0",
  "description": "<one-sentence summary, matches first line of description field>",
  "cluster": <1–7>,
  "clusterName": "<cluster name from table above>",
  "installOrder": <next available integer after current max>,
  "filePath": ".ai/skills/<name>/SKILL.md",
  "triggers": [
    "<trigger phrase 1>",
    "<trigger phrase 2>",
    "<trigger phrase 3>",
    "<trigger phrase 4>",
    "<trigger phrase 5>"
  ],
  "dependencies": ["<skill-name-this-depends-on>"],
  "pairedWith": ["<skill-name-pairs-well-with>"],
  "verticals": ["<sabiscore|taxbridge|hashablanca|swarmx|all>"],
  "tags": ["<domain-tag>", "<technology-tag>"]
}
```

Determine `installOrder` by reading the current max from the registry:

```bash
jq '[.skills[].installOrder] | max + 1' .ai/registry.json
```

Then produce the `jq` append command:

```bash
jq '.skills += [<your registry entry JSON>]' .ai/registry.json > /tmp/registry_updated.json \
  && mv /tmp/registry_updated.json .ai/registry.json
```

---

### Step 4 — Validation and Installation

After generating the skill and updating the registry:

**1. Schema validation:**
```bash
make validate
# Verifies: all required fields present, cluster valid, triggers non-empty, filePath exists
```

**2. Duplicate trigger check:**
```bash
jq -r '.skills | group_by(.triggers[]) | .[] | select(length > 1) | .[].name' .ai/registry.json
# Must return empty — no two skills should share identical trigger phrases
```

**3. Install in Claude Code:**
- Copy `.ai/skills/<name>/SKILL.md` to the project
- Claude Code auto-discovers skills in `.ai/skills/` directories
- Verify: open Claude Code, type `/<name>` — it should autocomplete

**4. Install as slash command:**
- If also needed as a `.claude/skills/` slash command, create a wrapper:

```markdown
---
name: <name>
description: > <same description>
argument-hint: "<same hint>"
allowed-tools: Read
user-invocable: true
---

## <Skill Name> Activation

**Input:** $ARGUMENTS

Read `.ai/skills/<name>/SKILL.md` and execute the full protocol for the input above.
```

**5. Test the skill:**
```
/<name> [describe a real task from this vertical]
```

Confirm the skill trace block is produced and the output is concrete, not generic.

---

### Step 5 — Suite Health Check

After any skill addition or modification, verify suite integrity:

```bash
make validate              # Schema compliance for all 34+ skills
make doctor               # Dependency graph — no circular deps, no missing refs
jq '.skills | length' .ai/registry.json   # Confirm count incremented
```

If `make validate` fails, the skill is not installed. Fix the schema error before closing.
