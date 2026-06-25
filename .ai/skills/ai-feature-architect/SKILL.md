---
name: ai-feature-architect
description: >
  Designs and implements production AI features using Vercel AI SDK v6: streaming chat,
  tool calling, structured output, RAG pipelines with pgvector, multi-model routing,
  and AI gateway patterns. Use this skill whenever a user wants to add AI to their app,
  build a chatbot, implement RAG, stream LLM responses, use tool calling, generate
  structured output, route between models, or says "add AI to my Next.js app",
  "build a chatbot with streaming", "implement RAG", "tool calling with Claude/GPT",
  "structured AI output", "AI gateway setup", "embeddings and vector search",
  "useChat hook", "streamText", "generateObject", or "LLM feature architecture".
  Always use this skill for AI feature design — Vercel AI SDK v6 APIs, streaming
  patterns, and RAG pipelines have changed significantly since v3/v4.
---

# AI Feature Architect

Design and implement production AI features with Vercel AI SDK v6. Covers streaming UI,
tool calling, structured output, RAG, and multi-model routing — all with proper error
handling, rate limiting, and observability.

## Core Primitives (AI SDK v6)

| Primitive | Use for |
|---|---|
| `streamText()` | Streaming chat responses (most common) |
| `generateText()` | Non-streaming, single response |
| `generateObject()` | Structured JSON output with Zod schema validation |
| `streamObject()` | Stream structured JSON progressively |
| `embed()` | Single embedding for a string |
| `embedMany()` | Batch embedding for RAG ingestion |
| `useChat()` | React hook: manages streaming chat state |
| `useObject()` | React hook: manages streaming structured objects |

## Protocol

### Step 1 — Classify the Feature

- **Chat UI with streaming**: `streamText` + `useChat`
- **AI form fill / extraction**: `generateObject` with Zod schema
- **Knowledge Q&A over docs**: RAG pipeline with `embedMany` + pgvector
- **AI that takes actions**: tool calling with `streamText` + tools
- **Multi-model**: model routing based on task complexity or cost

### Step 2 — Streaming Chat Route (Next.js App Router)

```typescript
// app/api/chat/route.ts
import { streamText, convertToCoreMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createRouteRatelimit } from '@/lib/ratelimit'

const ratelimit = createRouteRatelimit({ requests: 10, window: '1m' })

export async function POST(req: Request) {
  // ─── Rate limiting ───────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return new Response('Too many requests', { status: 429 })
  }

  const { messages, systemPrompt } = await req.json() as {
    messages: unknown[]
    systemPrompt?: string
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt ?? 'You are a helpful assistant.',
    messages: convertToCoreMessages(messages),
    maxTokens: 1024,
    temperature: 0.7,
    onFinish({ usage, finishReason }) {
      // Log token usage for cost tracking
      logger.info({ usage, finishReason }, 'AI stream completed')
    },
  })

  return result.toDataStreamResponse()
}
```

```tsx
// components/chat/Chat.tsx — client component
'use client'
import { useChat } from 'ai/react'

export function Chat({ systemPrompt }: { systemPrompt?: string }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat',
    body: { systemPrompt },
    onError: (err) => console.error('Chat error:', err),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <span className="inline-block max-w-[80%] rounded-xl px-4 py-2 bg-surface-raised">
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && <LoadingDots />}
        {error && <ErrorMessage error={error} />}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border p-4 flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything..."
          className="flex-1 rounded-lg border border-border px-4 py-2"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      </form>
    </div>
  )
}
```

### Step 3 — Structured Output with Zod

```typescript
// Extract typed data from unstructured text
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const InvoiceSchema = z.object({
  vendor:      z.string(),
  amount:      z.number(),
  currency:    z.string().default('NGN'),
  invoiceDate: z.string(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity:    z.number(),
    unitPrice:   z.number(),
  })),
  vatAmount:   z.number().nullable(),
})

export async function extractInvoiceData(rawText: string) {
  const { object } = await generateObject({
    model:  anthropic('claude-sonnet-4-6'),
    schema: InvoiceSchema,
    prompt: `Extract invoice data from the following text:\n\n${rawText}`,
  })
  return object  // ← typed as z.infer<typeof InvoiceSchema>
}
```

### Step 4 — Tool Calling

```typescript
import { streamText, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  messages,
  tools: {
    // Tool 1: look up invoice status
    getInvoiceStatus: tool({
      description: 'Get the current status of an invoice by its ID',
      parameters: z.object({
        invoiceId: z.string().describe('The invoice ID to look up'),
      }),
      execute: async ({ invoiceId }) => {
        const invoice = await db.invoice.findUnique({
          where: { id: invoiceId },
          select: { id: true, status: true, amount: true, dueAt: true },
        })
        return invoice ?? { error: 'Invoice not found' }
      },
    }),
    // Tool 2: send a payment reminder
    sendReminder: tool({
      description: 'Send a payment reminder email for an overdue invoice',
      parameters: z.object({
        invoiceId: z.string(),
        message:   z.string().optional(),
      }),
      execute: async ({ invoiceId, message }) => {
        await enqueueEmail({ type: 'payment-reminder', invoiceId, message })
        return { success: true, message: 'Reminder queued' }
      },
    }),
  },
  maxSteps: 5,    // allow up to 5 tool calls before final response
})
```

### Step 5 — RAG Pipeline (Retrieval-Augmented Generation)

**Architecture:**
```
Ingestion:   Document → Chunk → Embed → Store in pgvector
Retrieval:   Query → Embed → Vector similarity search → Top-K chunks
Generation:  System prompt + chunks + user query → streamText
```

**Setup pgvector:**
```sql
-- Migration: enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

```prisma
// schema.prisma
model DocumentChunk {
  id         String  @id @default(cuid())
  content    String
  embedding  Unsupported("vector(1536)")  // 1536 for text-embedding-3-small
  documentId String  @map("document_id")
  createdAt  DateTime @default(now()) @map("created_at")

  @@map("document_chunks")
}
```

**Ingestion pipeline:**
```typescript
import { embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function ingestDocument(content: string, documentId: string) {
  // 1. Chunk the document
  const chunks = chunkText(content, { maxChunkSize: 500, overlap: 50 })

  // 2. Embed all chunks in one batch call
  const { embeddings } = await embedMany({
    model:  openai.embedding('text-embedding-3-small'),
    values: chunks,
  })

  // 3. Store in PostgreSQL with pgvector
  await db.$executeRaw`
    INSERT INTO document_chunks (id, content, embedding, document_id)
    SELECT
      gen_random_uuid(),
      chunk,
      embedding::vector,
      ${documentId}
    FROM UNNEST(
      ${chunks}::text[],
      ${embeddings.map(e => `[${e.join(',')}]`)}::text[]
    ) AS t(chunk, embedding)
  `
}

function chunkText(text: string, { maxChunkSize = 500, overlap = 50 } = {}) {
  const words = text.split(' ')
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxChunkSize - overlap) {
    chunks.push(words.slice(i, i + maxChunkSize).join(' '))
  }
  return chunks
}
```

**Retrieval + generation:**
```typescript
import { embed, streamText } from 'ai'

export async function ragQuery(userQuery: string) {
  // 1. Embed the query
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: userQuery,
  })

  // 2. Vector similarity search
  const chunks = await db.$queryRaw<Array<{ content: string; similarity: number }>>`
    SELECT content, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT 5
  `

  // 3. Build context from top-K chunks
  const context = chunks.map(c => c.content).join('\n\n---\n\n')

  // 4. Generate with context
  const result = streamText({
    model:  anthropic('claude-sonnet-4-6'),
    system: `Answer using only the provided context. If the answer isn't in the context, say so.
Context:
${context}`,
    messages: [{ role: 'user', content: userQuery }],
  })

  return result.toDataStreamResponse()
}
```

### Step 6 — Multi-Model Routing

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { openai }    from '@ai-sdk/openai'

type TaskComplexity = 'simple' | 'complex' | 'reasoning'

function selectModel(complexity: TaskComplexity) {
  return {
    simple:    openai('gpt-4o-mini'),            // cheap, fast
    complex:   anthropic('claude-sonnet-4-6'),    // balanced
    reasoning: anthropic('claude-opus-4-6'),      // best quality, costly
  }[complexity]
}

// Usage
const model = selectModel(classifyTask(userMessage))
const result = streamText({ model, messages })
```

## Quality Gates

- [ ] All AI routes have rate limiting (by IP + by user)
- [ ] Token usage logged for cost tracking
- [ ] `maxTokens` set on every `streamText`/`generateText` call (prevent runaway costs)
- [ ] Structured output validated with Zod (never `as unknown as Type`)
- [ ] RAG retrieval returns similarity scores (filter below 0.7 threshold)
- [ ] Tool calling has `maxSteps` limit (prevent infinite loops)
- [ ] AI errors handled gracefully (model overload, rate limits, context overflow)
- [ ] Streaming UI shows loading state and error state explicitly

## Activation Triggers

- "Add AI chat to my Next.js app"
- "Implement RAG / semantic search over my documents"
- "Build a chatbot with streaming"
- "Tool calling with Claude / GPT"
- "Extract structured data with AI"
- "Set up Vercel AI SDK"
- "useChat hook / streamText setup"
- "Multi-model routing for AI features"

## Skill Chain

**Feeds into**: `prompt-engineering-architect` (every AI feature needs a versioned, tested system prompt) → `opentelemetry-observability-architect` (AI calls need token-usage spans and latency tracking) → `security-hardening-auditor` (AI endpoints need rate limiting and input sanitisation).

**Creative combination**: `ai-feature-architect` builds the streaming chat or RAG pipeline. `prompt-engineering-architect` designs and versions the system prompt driving it. `opentelemetry-observability-architect` tracks token cost and latency per model in production. This three-skill chain turns an AI feature from a prototype into a production system.
