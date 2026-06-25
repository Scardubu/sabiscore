---
name: prompt-engineering-architect
description: >
  Designs, audits, and optimizes prompts for AI features embedded in applications:
  system prompts, few-shot examples, chain-of-thought instructions, structured output
  prompts, RAG context injection, tool descriptions, and multi-turn conversation design.
  Use this skill whenever a user wants to improve an AI feature's outputs, write a system
  prompt, design few-shot examples, make an LLM follow instructions reliably, improve
  extraction accuracy, reduce hallucinations, or says "my AI gives inconsistent results",
  "how do I write a better system prompt", "few-shot examples for extraction",
  "make the LLM output JSON reliably", "chain-of-thought prompting", "reduce hallucinations",
  "prompt for RAG", "design a conversational agent prompt", or "audit my prompt".
  Always use this skill for in-app prompt design — these patterns differ significantly
  from chat prompting and have measurable accuracy impact.
---

# Prompt Engineering Architect

Design and optimize prompts for production AI features. Every prompt is versioned,
testable, and grounded in what the model actually does well.

## Core Principles

1. **Specificity beats brevity** — detailed instructions outperform short ones
2. **Positive > negative** — "respond only in JSON" beats "don't use markdown"
3. **Examples are the strongest signal** — few-shot beats instruction for format tasks
4. **Structure the output explicitly** — never leave format to inference
5. **Role + goal + constraints + format** — the four components of every system prompt

## The Four Prompt Components

```
ROLE       — What entity is the model playing?
GOAL       — What is the primary objective?
CONSTRAINTS — What must never happen?
FORMAT     — What exactly should the output look like?
```

## Protocol

### Step 1 — Classify the Prompt Type

| Type | Best technique | Output format |
|---|---|---|
| Chat / conversation | Role + goal + constraints | Natural language |
| Data extraction | Few-shot + Zod schema | Structured JSON |
| Classification | Few-shot + label list | Single label or confidence |
| Summarization | Role + constraints + length | Prose |
| Document Q&A (RAG) | Context injection + boundary instructions | Prose |
| Code generation | Role + examples + test spec | Code |
| Multi-step reasoning | Chain-of-thought | Reasoned steps + answer |

### Step 2 — System Prompt Template

```typescript
// lib/prompts/invoice-extractor.ts
export const INVOICE_EXTRACTOR_PROMPT = `
You are a financial document parser specializing in Nigerian business invoices.

## GOAL
Extract structured invoice data from OCR text or document content. Your extractions
feed directly into an accounting system, so precision is critical.

## WHAT TO EXTRACT
- vendor_name: The company issuing the invoice (not the buyer)
- invoice_number: The vendor's invoice reference number
- invoice_date: Issue date in ISO 8601 format (YYYY-MM-DD)
- due_date: Payment due date in ISO 8601 format, or null if not specified
- line_items: Array of items/services billed
- subtotal: Amount before tax
- vat_amount: Value Added Tax amount (7.5% standard Nigerian rate)
- total_amount: Final amount due including all taxes
- currency: Three-letter ISO code (NGN, USD, EUR, GBP)
- payment_terms: E.g. "Net 30", "Due on receipt", or null

## CONSTRAINTS
- If a field is not present in the document, use null — do not infer or hallucinate
- All monetary amounts must be numbers, not strings (50000 not "50,000" or "₦50,000")
- If the date format is ambiguous (03/04/2026 could be March 4 or April 3),
  choose the format that makes contextual sense given other dates on the document
- If the document language is not English, translate field values to English

## OUTPUT FORMAT
Respond with a single JSON object. No markdown, no explanation, no preamble.
Schema is provided separately via the generateObject Zod schema.
`.trim()
```

### Step 3 — Few-Shot Examples (Extraction Tasks)

Few-shot examples are the single highest-leverage technique for extraction tasks.
Provide 2–3 examples that cover edge cases:

```typescript
export const CLASSIFICATION_PROMPT = `
You classify customer support tickets into categories for routing.

## CATEGORIES
- billing: payment issues, invoice disputes, refund requests
- technical: bugs, errors, app not working
- account: login issues, password reset, profile changes
- feature: feature requests, product feedback
- other: anything that doesn't fit above

## EXAMPLES

Input: "I can't log into my account after changing my password yesterday"
Output: account

Input: "I was charged twice for my subscription this month"
Output: billing

Input: "The export button gives me a 500 error when I try to download my invoices"
Output: technical

Input: "It would be great if you could add dark mode to the mobile app"
Output: feature

## INSTRUCTIONS
Respond with exactly one category label from the list above.
No explanation, no punctuation, just the label.
`.trim()
```

### Step 4 — Chain-of-Thought Prompting

For complex reasoning tasks, instruct the model to reason before answering:

```typescript
export const TAX_ADVISOR_PROMPT = `
You are a Nigerian tax compliance advisor with expertise in FIRS regulations,
VAT, CIT, and Withholding Tax.

## HOW TO RESPOND
For every question:
1. IDENTIFY the relevant tax regulation(s) (cite section numbers where possible)
2. ANALYZE how they apply to the specific situation
3. CALCULATE any amounts if applicable, showing your working
4. STATE the answer clearly
5. CAVEAT if professional tax advice should be sought

Use the format:
**Regulation**: [relevant law/section]
**Analysis**: [how it applies]
**Calculation**: [if applicable]
**Answer**: [clear conclusion]
**Note**: [professional advice caveat if needed]

## CONSTRAINTS
- Never give advice that contradicts current FIRS guidelines
- If a regulation is ambiguous or has changed recently, say so explicitly
- All naira amounts should be formatted as ₦X,XXX,XXX
- Do not invent tax rates — if uncertain, recommend consulting a tax professional
`.trim()
```

### Step 5 — RAG Context Injection

```typescript
// The critical pattern: boundary instructions prevent "context bleeding"
export function buildRAGPrompt(chunks: string[], userQuery: string): string {
  return `
You are a knowledge assistant for ${COMPANY_NAME}.

## INSTRUCTIONS
Answer the user's question using ONLY the information provided in the CONTEXT section below.

Rules:
- If the answer is in the context, answer directly and cite which section contains it
- If the answer is NOT in the context, respond exactly: "I don't have that information in my knowledge base. Please contact support at support@example.com."
- Do not use knowledge outside the provided context
- Do not make up information, extrapolate, or speculate

## CONTEXT
${chunks.map((chunk, i) => `[Section ${i + 1}]\n${chunk}`).join('\n\n')}

## USER QUESTION
${userQuery}

## ANSWER
`.trim()
}
```

### Step 6 — Tool / Function Descriptions

Tool descriptions are prompts — write them as precisely as possible:

```typescript
// ❌ Vague tool description
const vagueTool = tool({
  description: 'Get invoice information',
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => getInvoice(id),
})

// ✅ Precise tool description
const preciseTool = tool({
  description:
    'Retrieve a specific invoice by its ID. Use this when the user asks about ' +
    'the status, amount, due date, or line items of a particular invoice. ' +
    'Do NOT use this for listing invoices — use the listInvoices tool instead.',
  parameters: z.object({
    id: z.string().describe(
      'The invoice ID, which starts with "inv_" followed by alphanumeric characters. ' +
      'Example: inv_abc123'
    ),
  }),
  execute: async ({ id }) => getInvoice(id),
})
```

### Step 7 — Prompt Versioning

```typescript
// lib/prompts/index.ts — versioned prompt registry
export const PROMPTS = {
  invoiceExtractor: {
    version: '2.1.0',
    model:   'claude-sonnet-4-6',
    prompt:  INVOICE_EXTRACTOR_PROMPT,
    // Track what changed for debugging
    changelog: [
      '2.1.0: Added explicit null instruction for missing dates',
      '2.0.0: Added Nigerian VAT rate constraint',
      '1.0.0: Initial version',
    ],
  },
} as const

// Log prompt version with every AI call for debugging
logger.info({ promptVersion: PROMPTS.invoiceExtractor.version }, 'Running extraction')
```

### Step 8 — Prompt Evaluation

Test prompts against a fixed set of inputs to measure accuracy:

```typescript
// src/test/prompts/__tests__/invoice-extractor.eval.ts
const TEST_CASES = [
  {
    input: 'Invoice #INV-2024-001 from Acme Corp dated January 15, 2024...',
    expected: {
      vendor_name: 'Acme Corp',
      invoice_number: 'INV-2024-001',
      invoice_date: '2024-01-15',
    },
  },
  // ... more cases
]

describe('Invoice Extractor Prompt', () => {
  for (const { input, expected } of TEST_CASES) {
    it(`extracts from: "${input.slice(0, 50)}..."`, async () => {
      const result = await extractInvoiceData(input)
      expect(result.vendor_name).toBe(expected.vendor_name)
      expect(result.invoice_date).toBe(expected.invoice_date)
    })
  }
})
```

## Prompt Anti-Patterns to Flag

| Anti-pattern | Problem | Fix |
|---|---|---|
| "Don't do X" without positive alternative | Model forgets negative constraints | Add "Instead, do Y" |
| Unprompted chain-of-thought | Model gives reasoning when you want an answer | Add "Respond with only the answer, no explanation" |
| Vague output format | Model invents its own format | Add exact schema or example output |
| Missing null handling | Model invents data for missing fields | Explicitly instruct: "Use null if not present" |
| Long preamble before instructions | Model drifts by end of long prompt | Put key instructions at the end too (primacy + recency) |
| No temperature guidance | Unpredictable creativity in factual tasks | Use `temperature: 0` for deterministic extraction |

## Quality Gates

- [ ] System prompt has all four components: role, goal, constraints, format
- [ ] Extraction prompts have 2–3 few-shot examples covering edge cases
- [ ] All prompts specify null/missing field behavior explicitly
- [ ] Tool descriptions distinguish from other similar tools
- [ ] RAG prompts include explicit "not in context" fallback instruction
- [ ] Prompts are versioned with changelog
- [ ] Prompt accuracy tested against fixed eval set

## Activation Triggers

- "My AI gives inconsistent / wrong results"
- "How do I write a better system prompt?"
- "Few-shot examples for [extraction task]"
- "Make the LLM output JSON reliably"
- "Chain-of-thought prompting setup"
- "Reduce hallucinations in my AI feature"
- "Prompt for RAG / document Q&A"
- "Audit / improve my existing prompt"

## Skill Chain

**Feeds into**: `ai-feature-architect` (refined prompts feed back into the AI feature implementation) → `elite-skill-forge` (prompt engineering principles apply directly to writing better skill descriptions).

**Creative combination**: `prompt-engineering-architect` → `ai-feature-architect` is a deliberate iterative loop. Design the prompt first, embed it in the feature, measure accuracy with the eval harness, return to prompt engineering to refine. This loop is how AI features improve over time rather than stagnating at v1.0.
