---
name: multi-agent-orchestration-architect
description: >
  Designs, implements, and audits multi-agent AI orchestration systems with BullMQ job chains,
  LLM routing, tool registries, agent state machines, and prompt injection defenses. Use this
  skill for SwarmX architecture, agent role design, LLM fallback routing, agent observability,
  or any system where multiple AI agents coordinate to complete a task. Triggers: "SwarmX",
  "multi-agent system", "agent orchestration", "agent routing", "LLM routing", "tool dispatch",
  "agent state machine", "agent control plane", "coordinate agents", "agent pipeline",
  "agent observability", "prompt injection defense". Always use this skill before writing
  any agent code — routing discipline and state management are the hardest problems to retrofit.
---

# Multi-Agent Orchestration Architect

Design multi-agent AI systems that are deterministic, observable, and safe. The hardest
problems in agent systems are routing correctness, state integrity, and failure isolation —
solve them architecturally, not per-feature.

## Core Principles

- Agents are stateless between turns — all state lives in the job payload or database.
- One agent = one clearly defined role. Never give an agent two conflicting jobs.
- The orchestrator decides routing; agents do not route themselves.
- Every LLM call has a fallback model and a timeout.
- Tool dispatch is explicit and audited — agents cannot call tools they aren't registered for.
- Prompt injection is a security surface — treat user input as untrusted inside every agent.

---

## Step 1 — Define the Agent Registry

Every agent has a contract before implementation:

```typescript
// lib/agents/registry.ts
import { Schema } from 'effect'

export const AgentRole = Schema.Literal(
  'orchestrator',  // routes tasks, does not execute directly
  'strategist',    // breaks down goals into sub-tasks
  'researcher',    // retrieves and synthesizes information
  'coder',         // writes, reviews, and refactors code
  'evaluator',     // assesses output quality, flags issues
  'synthesizer',   // merges multi-agent outputs into coherent result
  'executor',      // calls external tools and APIs
)
export type AgentRole = typeof AgentRole.Type

export interface AgentSpec {
  role:            AgentRole
  model:           string               // primary LLM
  fallbackModel:   string               // on rate-limit or timeout
  maxTokens:       number
  allowedTools:    string[]             // explicit allowlist — never wildcard
  timeoutMs:       number               // hard kill after this
  systemPromptKey: string               // versioned prompt ID
}

export const AGENT_REGISTRY: Record<AgentRole, AgentSpec> = {
  orchestrator: {
    role:            'orchestrator',
    model:           'claude-sonnet-4-6',
    fallbackModel:   'claude-haiku-4-5-20251001',
    maxTokens:       4096,
    allowedTools:    ['route_to_agent', 'read_context', 'write_plan'],
    timeoutMs:       30_000,
    systemPromptKey: 'orchestrator-v3',
  },
  coder: {
    role:            'coder',
    model:           'claude-sonnet-4-6',
    fallbackModel:   'claude-haiku-4-5-20251001',
    maxTokens:       8192,
    allowedTools:    ['read_file', 'write_file', 'run_tests', 'search_codebase'],
    timeoutMs:       60_000,
    systemPromptKey: 'coder-v2',
  },
  // ... additional roles
}
```

---

## Step 2 — BullMQ Job Architecture for Agent Orchestration

```typescript
// lib/queues/agent-queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

// Critical: separate Redis connections per role (BullMQ requirement)
const queueConnection = new IORedis({ maxRetriesPerRequest: null })
const workerConnection = new IORedis({ maxRetriesPerRequest: null })
const eventsConnection = new IORedis({ maxRetriesPerRequest: null })

export const agentQueue = new Queue<AgentJob>('swarmx:agents', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },    // keep 1hr for debugging
    removeOnFail:     { age: 86400 },   // keep 24hr for postmortem
  },
})

// Agent job payload — all state is in the payload (agents are stateless)
export interface AgentJob {
  jobId:       string           // correlation ID for the full pipeline
  taskId:      string           // this specific agent invocation
  role:        AgentRole
  input:       string           // sanitized user input (XSS-stripped, length-limited)
  context:     AgentContext     // shared context across agent chain
  parentJobId: string | null    // for tree-shaped pipelines
  traceId:     string           // OTel trace context propagation
}

// Worker — one per agent role, isolated concurrency
export const coderWorker = new Worker<AgentJob>(
  'swarmx:agents',
  async (job) => {
    if (job.data.role !== 'coder') return  // route guard

    return withSpan('agent.coder.execute', job.data.traceId, async (span) => {
      span.setAttributes({
        'agent.role':    'coder',
        'agent.task_id': job.data.taskId,
        'agent.job_id':  job.data.jobId,
      })

      const result = await invokeAgent(job.data)
      return result
    })
  },
  {
    connection: workerConnection,
    concurrency: 3,   // never saturate local LLM
  }
)
```

---

## Step 3 — LLM Router with Fallback

```typescript
// lib/agents/llm-router.ts
import { Effect, Schedule, Duration } from 'effect'

export class LLMRouter extends Effect.Service<LLMRouter>()('LLMRouter', {
  effect: Effect.gen(function* () {
    return {
      invoke: (
        spec:   AgentSpec,
        prompt: string,
        input:  string,
      ): Effect.Effect<AgentResponse, LLMError> =>
        Effect.gen(function* () {
          // 1. Input sanitization (prompt injection defense)
          const safeInput = sanitizeAgentInput(input)

          // 2. Build the message — user input is always in user turn, never system prompt
          const messages = [
            { role: 'user' as const, content: safeInput },
          ]

          // 3. Try primary model with timeout
          const response = yield* pipe(
            callLLM(spec.model, spec.systemPromptKey, messages, spec.maxTokens),
            Effect.timeout(Duration.millis(spec.timeoutMs)),
            // 4. Fallback to secondary model on rate limit or timeout
            Effect.catchTags({
              TimeoutException: () => callLLM(spec.fallbackModel, spec.systemPromptKey, messages, spec.maxTokens),
              RateLimitError:   () => pipe(
                Effect.sleep(Duration.seconds(2)),
                Effect.flatMap(() => callLLM(spec.fallbackModel, spec.systemPromptKey, messages, spec.maxTokens)),
              ),
            }),
          )

          // 5. Emit token usage metric
          yield* emitTokenMetric({
            role:         spec.role,
            model:        response.model,
            inputTokens:  response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          })

          return response
        }),
    }
  }),
}) {}

// Prompt injection defense
function sanitizeAgentInput(raw: string): string {
  return raw
    .slice(0, 32_768)                                   // hard length cap
    .replace(/^\s*system:/gim, '[BLOCKED]')             // block system: prefix injection
    .replace(/\[INST\]|\[\/INST\]/g, '')                // block Llama injection markers
    .replace(/<\|im_start\|>|<\|im_end\|>/g, '')        // block ChatML injection
}
```

---

## Step 4 — Orchestrator State Machine

```typescript
// lib/agents/orchestrator.ts
// State machine for multi-agent pipeline coordination

type PipelineStatus =
  | 'initializing'
  | 'planning'
  | 'executing'
  | 'evaluating'
  | 'synthesizing'
  | 'completed'
  | 'failed'

interface PipelineState {
  id:        string
  status:    PipelineStatus
  plan:      AgentTask[]
  results:   Map<string, AgentResult>
  startedAt: Date
  updatedAt: Date
}

export class AgentOrchestrator {
  async run(input: string, traceId: string): Promise<AgentResult> {
    const pipeline = await this.db.createPipeline({ input, traceId, status: 'initializing' })

    try {
      // Phase 1: Planning (orchestrator decomposes the task)
      await this.transition(pipeline.id, 'planning')
      const plan = await this.invokeAgent('orchestrator', input, traceId)
      const tasks = parsePlan(plan.output)

      // Phase 2: Parallel execution of independent tasks
      await this.transition(pipeline.id, 'executing')
      const results = await Promise.allSettled(
        tasks.map(task => this.dispatchTask(task, pipeline.id, traceId))
      )

      // Phase 3: Evaluation
      await this.transition(pipeline.id, 'evaluating')
      const evaluation = await this.invokeAgent('evaluator', JSON.stringify(results), traceId)

      // Phase 4: Synthesis
      await this.transition(pipeline.id, 'synthesizing')
      const synthesis = await this.invokeAgent('synthesizer',
        JSON.stringify({ results, evaluation }), traceId
      )

      await this.transition(pipeline.id, 'completed')
      return { output: synthesis.output, pipelineId: pipeline.id }

    } catch (error) {
      await this.transition(pipeline.id, 'failed')
      throw error
    }
  }

  private async transition(id: string, status: PipelineStatus) {
    await this.db.updatePipeline(id, { status, updatedAt: new Date() })
    // Emit status via SSE for dashboard (real-time-systems-architect)
    this.events.emit(`pipeline:${id}:status`, { status })
  }
}
```

---

## Step 5 — Tool Registry and Dispatch

```typescript
// lib/agents/tool-registry.ts
// Explicit tool registration — agents cannot call unregistered tools

interface Tool<I, O> {
  name:        string
  description: string
  inputSchema: Schema.Schema<I>
  execute:     (input: I) => Promise<O>
}

export class ToolRegistry {
  private tools = new Map<string, Tool<unknown, unknown>>()

  register<I, O>(tool: Tool<I, O>) {
    this.tools.set(tool.name, tool as Tool<unknown, unknown>)
  }

  async dispatch(
    toolName:  string,
    input:     unknown,
    agentRole: AgentRole,
  ): Promise<unknown> {
    const spec = AGENT_REGISTRY[agentRole]

    // Authorization check — explicit allowlist
    if (!spec.allowedTools.includes(toolName)) {
      throw new ToolAuthorizationError({
        agentRole,
        toolName,
        message: `Agent '${agentRole}' is not authorized to call tool '${toolName}'`,
      })
    }

    const tool = this.tools.get(toolName)
    if (!tool) throw new ToolNotFoundError({ toolName })

    // Validate input against schema
    const validated = await Schema.decode(tool.inputSchema)(input)
    return tool.execute(validated)
  }
}
```

---

## Step 6 — Agent Observability

```typescript
// lib/agents/observability.ts
// Every agent invocation emits a structured span

export async function withAgentSpan<T>(
  role:    AgentRole,
  taskId:  string,
  traceId: string,
  fn:      (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`agent.${role}`, {
    kind:       SpanKind.INTERNAL,
    attributes: {
      'agent.role':     role,
      'agent.task_id':  taskId,
      'agent.trace_id': traceId,
    },
  }, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}

// Metrics: per-agent token usage and latency
export const agentMetrics = {
  tokenUsage: meter.createHistogram('swarmx.agent.token_usage', {
    description: 'Token usage per agent invocation',
    unit:        'tokens',
  }),
  latency: meter.createHistogram('swarmx.agent.latency', {
    description: 'Agent invocation latency',
    unit:        'ms',
  }),
}
```

---

## Quality Gates

- [ ] Every agent role is explicitly registered with an allowedTools list
- [ ] No agent can call tools outside its allowlist (authorization check in dispatcher)
- [ ] All user input is sanitized before entering any agent's context window
- [ ] Every LLM call has a timeout and a fallback model
- [ ] Agent state is entirely in the job payload or database — zero in-memory state
- [ ] Every agent invocation emits a trace span with role, task ID, and token usage
- [ ] Pipeline state transitions are persisted before the transition executes
- [ ] BullMQ workers use separate ioredis connections (Queue / Worker / QueueEvents)

---

## Pair This Skill With

- `prompt-engineering-architect` — system prompts for each agent role (always first)
- `bullmq-job-architect` — queue architecture, DLQ, retry strategy for agent jobs
- `real-time-systems-architect` — streaming agent status and progress to the dashboard
- `opentelemetry-observability-architect` — full trace propagation through agent chain
- `security-hardening-auditor` — prompt injection defense, API key rotation
- `backend-systems-auditor` — graceful shutdown with in-flight agent job completion

---

## Activation Triggers

- "SwarmX architecture / orchestration"
- "Multi-agent system design"
- "Agent routing / LLM routing"
- "Agent state machine"
- "Tool dispatch / tool registry"
- "Agent observability / agent tracing"
- "Prompt injection defense for agents"
- "BullMQ job chains for AI agents"
- "Agent control plane"
- "Coordinate multiple AI agents"
- "Agent fallback / timeout strategy"
- "How do I make my agent system production-ready?"
