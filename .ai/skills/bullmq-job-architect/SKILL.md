---
name: bullmq-job-architect
description: >
  Designs and implements production-grade BullMQ job queues with Redis: queue isolation,
  worker concurrency sizing, rate limiting, dead letter queues, job flows, priority lanes,
  graceful shutdown, and Bull Board monitoring. Use this skill whenever a user wants to
  set up background jobs, design a job queue, configure BullMQ workers, handle failed jobs,
  add job retry logic, set up a dead letter queue, schedule recurring jobs, configure rate
  limiting for external APIs, or says "set up BullMQ", "background job architecture",
  "how do I handle failed jobs", "schedule a cron job with BullMQ", "DLQ setup",
  "worker concurrency sizing", "Bull Board setup", or "job queue for [task]".
  Always use this skill — BullMQ concurrency, rate limiting, and graceful shutdown
  have non-obvious production gotchas.
---

# BullMQ Job Architect

Design and implement production-grade BullMQ job queue systems. Every queue is isolated,
every worker is correctly sized, every failure path is handled.

## Queue Architecture Principles

**One queue per job type** — never mix job types in one queue. Isolation prevents a slow
AI inference job from blocking fast email delivery jobs.

**Separate Redis connection per role** — BullMQ requires separate `ioredis` instances for
Queue, Worker, and QueueEvents. Reusing one connection causes deadlocks.

**Queue taxonomy:**
```
queues/
  email-dispatch     ← transactional emails; high priority, fast
  pdf-generation     ← CPU-bound; separate worker pool
  ai-inference       ← LLM calls; rate-limited by provider
  data-sync          ← low priority, bulk, interruptible
  scheduled-jobs     ← cron/recurring tasks
  dead-letter        ← failed jobs for inspection and replay
```

## Protocol

### Step 1 — Classify the Job Type

| Type | Concurrency | Rate limit? | Retry strategy |
|---|---|---|---|
| Transactional email | High (20–50) | By provider limit | 3x exponential backoff |
| PDF/media generation | CPU cores | No | 2x, then DLQ |
| LLM API call | Derived from rate limit | Yes — provider quota | 5x with jitter, respect 429 |
| Database batch sync | Low (2–5) | No | 3x, then DLQ |
| Cron/scheduled | 1 | No | Log + alert |

**Concurrency sizing formula:**
```
concurrency = ceil(rate_limit_per_sec × avg_job_duration_sec × 1.2_buffer)
// Example: 50 req/s limit, 500ms avg → ceil(50 × 0.5 × 1.2) = 30
// For CPU-bound: use os.cpus().length
```

### Step 2 — Redis Connection Setup

```typescript
// lib/redis.ts — shared connection factory
import IORedis from 'ioredis'

const redisOptions = {
  host:     process.env.REDIS_HOST ?? 'localhost',
  port:     Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,  // ← REQUIRED for BullMQ workers
  enableReadyCheck:     false, // ← REQUIRED for BullMQ workers
  lazyConnect:          true,
}

// Each role needs its OWN connection instance
export const createRedisConnection = () => new IORedis(redisOptions)
// Usage: const workerConnection = createRedisConnection()
//        const queueConnection  = createRedisConnection()
//        const eventsConnection = createRedisConnection()
```

### Step 3 — Queue + Worker Implementation

```typescript
// queues/email-dispatch.ts
import { Queue, Worker, QueueEvents, type Job } from 'bullmq'
import { createRedisConnection } from '../lib/redis'

// ─── Types ────────────────────────────────────────────────
interface EmailJob {
  to:      string
  subject: string
  template: string
  variables: Record<string, string>
}

// ─── Queue (producer side) ────────────────────────────────
export const emailQueue = new Queue<EmailJob>('email-dispatch', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts:    3,
    backoff: {
      type:  'exponential',
      delay: 1000,          // 1s, 2s, 4s
    },
    removeOnComplete: { count: 1000 },  // keep last 1000 completed
    removeOnFail:     { count: 5000 },  // keep last 5000 failed
  },
})

// ─── Producer helper ──────────────────────────────────────
export async function enqueueEmail(data: EmailJob, options?: {
  priority?: number   // 1 = highest, default = 0
  delay?: number      // ms before job becomes active
}) {
  return emailQueue.add('send-email', data, {
    priority: options?.priority,
    delay:    options?.delay,
  })
}

// ─── Worker (consumer side) ───────────────────────────────
export function startEmailWorker() {
  const worker = new Worker<EmailJob>(
    'email-dispatch',
    async (job: Job<EmailJob>) => {
      const { to, subject, template, variables } = job.data

      // Update progress (visible in Bull Board)
      await job.updateProgress(10)

      await sendTransactionalEmail({ to, subject, template, variables })

      await job.updateProgress(100)

      return { sentAt: new Date().toISOString(), to }
    },
    {
      connection:  createRedisConnection(),
      concurrency: 20,    // 20 emails processed in parallel
      limiter: {
        max:      50,
        duration: 1000,   // max 50 emails/sec (respect SendGrid limits)
      },
    }
  )

  // ─── Lifecycle events ────────────────────────────────────
  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Email sent')
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email failed')
    // After all retries exhausted, move to DLQ
    if ((job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 3)) {
      moveToDLQ('email-dispatch', job!, err)
    }
  })

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error')
  })

  return worker
}
```

### Step 4 — Dead Letter Queue (DLQ)

```typescript
// queues/dead-letter.ts
import { Queue } from 'bullmq'
import type { Job } from 'bullmq'
import { createRedisConnection } from '../lib/redis'

export const dlqQueue = new Queue('dead-letter', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: false,   // never auto-remove DLQ jobs
    removeOnFail:     false,
  },
})

export async function moveToDLQ(
  sourceQueue: string,
  job: Job,
  error: Error
) {
  await dlqQueue.add('failed-job', {
    originalQueue: sourceQueue,
    originalJobId: job.id,
    jobName:       job.name,
    jobData:       job.data,
    failedAt:      new Date().toISOString(),
    errorMessage:  error.message,
    errorStack:    error.stack,
    attemptsMade:  job.attemptsMade,
  })
}

// Replay a DLQ job (manual intervention)
export async function replayDLQJob(dlqJobId: string, targetQueueName: string) {
  const dlqJob = await dlqQueue.getJob(dlqJobId)
  if (!dlqJob) throw new Error(`DLQ job ${dlqJobId} not found`)

  const targetQueue = new Queue(targetQueueName, { connection: createRedisConnection() })
  await targetQueue.add(dlqJob.data.jobName, dlqJob.data.jobData, {
    attempts: 3,
  })
  await dlqJob.remove()
}
```

### Step 5 — Job Flows (dependent jobs)

```typescript
// For multi-step workflows where step B depends on step A
import { FlowProducer } from 'bullmq'
import { createRedisConnection } from '../lib/redis'

const flowProducer = new FlowProducer({ connection: createRedisConnection() })

// Invoice processing flow: parse → validate → generate PDF → send email
await flowProducer.add({
  name:    'send-invoice-email',
  queueName: 'email-dispatch',
  data: { template: 'invoice', to: user.email },
  children: [
    {
      name:      'generate-invoice-pdf',
      queueName: 'pdf-generation',
      data:      { invoiceId },
      children: [
        {
          name:      'validate-invoice',
          queueName: 'data-validation',
          data:      { invoiceId },
        },
      ],
    },
  ],
})
// BullMQ processes the tree bottom-up: validate → generate → send
```

### Step 6 — Scheduled (Cron) Jobs

```typescript
// Recurring job: every day at 3am WAT (UTC+1 = 2:00 UTC)
await emailQueue.add(
  'daily-digest',
  { type: 'daily-digest' },
  {
    repeat: { pattern: '0 2 * * *' },   // cron: minute hour day month weekday
    jobId: 'daily-digest-recurring',     // stable ID prevents duplicate cron jobs
  }
)

// Remove a recurring job
await emailQueue.removeRepeatable('daily-digest', { pattern: '0 2 * * *' })
```

### Step 7 — Graceful Shutdown

```typescript
// In Fastify shutdown handler
export async function shutdownWorkers(workers: Worker[]) {
  logger.info('Shutting down workers...')

  await Promise.all(
    workers.map(async (worker) => {
      // Stop accepting new jobs
      await worker.pause()
      // Wait for active jobs to complete (up to 30 seconds)
      await worker.close()
      logger.info({ queue: worker.name }, 'Worker closed gracefully')
    })
  )
}

// Fastify graceful shutdown integration
fastify.addHook('onClose', async () => {
  await shutdownWorkers([emailWorker, pdfWorker, aiWorker])
  await emailQueue.close()
  await dlqQueue.close()
})
```

### Step 8 — Bull Board Monitoring UI

```typescript
// Install: pnpm add @bull-board/fastify @bull-board/api bullmq
import { createBullBoard }        from '@bull-board/api'
import { BullMQAdapter }          from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter }         from '@bull-board/fastify'

const serverAdapter = new FastifyAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(pdfQueue),
    new BullMQAdapter(aiQueue),
    new BullMQAdapter(dlqQueue),
  ],
  serverAdapter,
})

// Register with Fastify (protect with auth middleware)
await fastify.register(serverAdapter.registerPlugin(), {
  prefix: '/admin/queues',
  basePath: '/admin/queues',
})
// Visit http://localhost:3000/admin/queues
```

### Step 9 — VS Code Tasks Integration

```jsonc
// .vscode/tasks.json additions
{
  "label": "BullMQ: Start Workers",
  "type": "shell",
  "command": "tsx watch src/workers/index.ts",
  "group": "none",
  "presentation": { "reveal": "always", "panel": "dedicated" },
  "isBackground": true
},
{
  "label": "Redis: Start (Docker)",
  "type": "shell",
  "command": "docker run -p 6379:6379 redis:7-alpine",
  "group": "none",
  "presentation": { "reveal": "silent", "panel": "shared" }
}
```

## Quality Gates

- [ ] Each queue has its own `ioredis` connection (not shared)
- [ ] Workers have `maxRetriesPerRequest: null` and `enableReadyCheck: false` in Redis config
- [ ] `removeOnComplete` and `removeOnFail` configured (Redis memory bounded)
- [ ] DLQ receives all jobs that exhaust retries
- [ ] Workers are paused and closed in graceful shutdown handler
- [ ] Concurrency sized correctly per job type (not default 1)
- [ ] Cron jobs use stable `jobId` to prevent duplicate registration
- [ ] Bull Board protected by authentication middleware

## Activation Triggers

- "Set up BullMQ for [task]"
- "Background job architecture / design"
- "How do I handle failed jobs in BullMQ?"
- "Configure worker concurrency"
- "Set up a dead letter queue"
- "Schedule recurring jobs with BullMQ"
- "Rate limit BullMQ for [external API]"
- "Bull Board setup / monitoring"

## Skill Chain

**Feeds into**: `opentelemetry-observability-architect` (BullMQ job tracing requires trace context propagation — covered there) → `backend-systems-auditor` (graceful worker shutdown is an audit criterion).

**Creative combination**: Design a job queue with `bullmq-job-architect`, make every job emit spans with `opentelemetry-observability-architect`, and expose the Bull Board behind auth designed with `security-hardening-auditor`. Operational visibility from day one.
