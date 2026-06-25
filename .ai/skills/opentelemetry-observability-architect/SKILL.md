---
name: opentelemetry-observability-architect
description: >
  Designs and implements complete OpenTelemetry observability pipelines for Node.js
  applications: auto-instrumentation for Fastify, Prisma, BullMQ, and HTTP clients;
  custom spans for business logic; RED metrics; structured logging with trace correlation;
  and OTLP export configuration. Use this skill whenever a user wants to add observability,
  set up tracing, configure OpenTelemetry, add custom spans, set up structured logging,
  implement RED metrics, connect to Grafana/Jaeger/SigNoz/Datadog, or says "add tracing
  to my Fastify app", "set up OTel", "instrument my Prisma queries", "trace BullMQ jobs",
  "structured logging setup", "how do I see slow queries in production", or
  "add observability to my Node.js service". Always use this skill — OTel initialization
  order and instrumentation registration are easy to get wrong.
---

# OpenTelemetry Observability Architect

Implement production-grade OpenTelemetry observability: traces, metrics, and logs that
correlate across Fastify → Prisma → Redis → BullMQ. Every span is named. Every error
is recorded. Every slow query is visible.

## Protocol

### Step 1 — Intake

Accept: existing `server.ts` / `instrumentation.ts`, a Fastify app, a Prisma setup,
or a description of the service. Ask only if needed: **"What's your target backend —
SigNoz, Grafana, Datadog, or local Jaeger?"** Default: OTLP over HTTP, backend-agnostic.

### Step 2 — Generate in Order

Always generate in this sequence (order matters — SDK must load before frameworks):
1. `instrumentation.ts` — SDK init, auto-instrumentation, exporters
2. Entry point integration — `import './instrumentation'` as line 1
3. Fastify plugin registration
4. Custom span helpers for business logic
5. BullMQ trace propagation (if queues present)
6. Structured logger with trace correlation
7. RED metrics configuration
8. Docker Compose local dev stack

## The Three Pillars

```
Traces   — distributed request lifecycle (Fastify req → Prisma query → Redis → BullMQ job)
Metrics  — RED: Rate (req/s), Errors (%), Duration (p50/p95/p99)
Logs     — structured JSON, trace-correlated (every log includes traceId + spanId)
```

## Critical Setup Rule

**OTel SDK must be initialized BEFORE all other imports.**
The tracer SDK patches Node.js internals at import time. If Fastify or Prisma load first,
those libraries aren't instrumented.

```typescript
// src/instrumentation.ts ← import this FIRST in server entry point
import { NodeSDK }                from '@opentelemetry/sdk-node'
import { Resource }               from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION }
                                  from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter }      from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter }     from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrismaInstrumentation }  from '@prisma/instrumentation'
import { FastifyOtelPlugin }      from '@fastify/otel'  // official Fastify plugin (2026)

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]:    process.env.SERVICE_NAME    ?? 'api',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? '0.0.0',
    'deployment.environment':      process.env.NODE_ENV        ?? 'development',
  }),

  // ─── Trace exporter ──────────────────────────────────────
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    headers: {
      'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN ?? ''}`,
    },
  }),

  // ─── Metrics exporter ─────────────────────────────────────
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 15_000,   // export every 15 seconds
  }),

  // ─── Auto-instrumentation ─────────────────────────────────
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },  // too noisy
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) =>
          req.url?.includes('/health') ?? false,   // don't trace health checks
      },
    }),
    new PrismaInstrumentation(),    // traces every Prisma query as a span
  ],
})

sdk.start()
process.on('SIGTERM', () => sdk.shutdown())

export { sdk }
```

**Entry point:**
```typescript
// src/server.ts — OTel MUST be first
import './instrumentation'    // ← line 1, before all else
import Fastify from 'fastify'
import { db } from './lib/db'
// ... rest of server setup
```

**Install:**
```bash
pnpm add \
  @opentelemetry/sdk-node \
  @opentelemetry/api \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/sdk-metrics \
  @prisma/instrumentation \
  @fastify/otel
```

### Fastify Plugin Registration

```typescript
// Register the official Fastify OTel plugin
await fastify.register(import('@fastify/otel'), {
  serviceName: 'api',
  // Creates spans for every route, attaches traceId to response headers
})
```

### Custom Spans for Business Logic

```typescript
import { trace, SpanStatusCode, context } from '@opentelemetry/api'

const tracer = trace.getTracer('api', '1.0.0')

// Wrap any business operation in a custom span
export async function processInvoice(invoiceId: string) {
  return tracer.startActiveSpan('invoice.process', async (span) => {
    try {
      span.setAttributes({
        'invoice.id':     invoiceId,
        'invoice.action': 'process',
      })

      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
      span.setAttributes({ 'invoice.amount': invoice?.amount.toString() })

      const result = await computeTax(invoice!)
      span.setAttributes({ 'invoice.tax': result.tax.toString() })

      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
      throw err
    } finally {
      span.end()
    }
  })
}
```

### BullMQ Job Tracing

```typescript
// Propagate trace context from queue producer to worker
import { propagation, context, trace } from '@opentelemetry/api'

// Producer: inject trace context into job data
export async function enqueueWithTrace(queue: Queue, name: string, data: unknown) {
  const carrier: Record<string, string> = {}
  propagation.inject(context.active(), carrier)
  return queue.add(name, { ...data, _otelCarrier: carrier })
}

// Worker: extract and restore trace context
const worker = new Worker('my-queue', async (job) => {
  const carrier = job.data._otelCarrier ?? {}
  const parentContext = propagation.extract(context.active(), carrier)

  return context.with(parentContext, async () => {
    return tracer.startActiveSpan(`job.${job.name}`, async (span) => {
      span.setAttributes({ 'job.id': job.id!, 'job.queue': 'my-queue' })
      try {
        const result = await processJobData(job.data)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (err) {
        span.recordException(err as Error)
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw err
      } finally {
        span.end()
      }
    })
  })
})
```

### Structured Logging with Trace Correlation

```typescript
// lib/logger.ts — Pino logger with OTel trace correlation
import pino from 'pino'
import { trace, context } from '@opentelemetry/api'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    log(object) {
      const span = trace.getActiveSpan()
      if (span) {
        const ctx = span.spanContext()
        return {
          ...object,
          traceId: ctx.traceId,
          spanId:  ctx.spanId,
          // ↑ Links every log line to its trace in Grafana/SigNoz
        }
      }
      return object
    },
  },
})
// Usage: logger.info({ userId, invoiceId }, 'Invoice processed')
// Every log now shows the trace it belongs to
```

### RED Metrics (Rate, Errors, Duration)

```typescript
// lib/metrics.ts — custom application metrics
import { metrics, ValueType } from '@opentelemetry/api'

const meter = metrics.getMeter('api', '1.0.0')

export const httpRequestDuration = meter.createHistogram('http.request.duration', {
  description: 'HTTP request duration in milliseconds',
  unit: 'ms',
  valueType: ValueType.DOUBLE,
})

export const jobProcessingDuration = meter.createHistogram('job.processing.duration', {
  description: 'BullMQ job processing duration',
  unit: 'ms',
})

export const activeJobsGauge = meter.createObservableGauge('job.active.count', {
  description: 'Number of active BullMQ jobs',
})

// Register async observer (polled on export interval)
activeJobsGauge.addCallback(async (observableResult) => {
  const counts = await getActiveJobCounts()
  observableResult.observe(counts.email, { queue: 'email-dispatch' })
  observableResult.observe(counts.pdf, { queue: 'pdf-generation' })
})

// Record in Fastify hook
fastify.addHook('onResponse', (request, reply, done) => {
  httpRequestDuration.record(reply.elapsedTime, {
    method: request.method,
    route:  request.routeOptions.url,
    status: String(reply.statusCode),
  })
  done()
})
```

### Environment Configuration

```env
# .env — standard OTel env vars (works with any OTLP backend)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=api
OTEL_SERVICE_VERSION=1.0.0

# For SigNoz (self-hosted, recommended)
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-signoz-host:4318
OTEL_AUTH_TOKEN=your-signoz-ingestion-key

# For Grafana Cloud
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-eu-west-0.grafana.net/otlp
OTEL_AUTH_TOKEN=your-grafana-token

# For Datadog
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.datadoghq.com
OTEL_AUTH_TOKEN=your-dd-api-key
```

### Local Development Stack (Docker)

```yaml
# docker-compose.yml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    ports: ["4317:4317", "4318:4318"]  # gRPC + HTTP
    volumes: ["./otel-collector-config.yaml:/etc/otelcol/config.yaml"]

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports: ["16686:16686"]   # Jaeger UI
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml"]
```

## Quality Gates

- [ ] `instrumentation.ts` imported as the very first line of `server.ts`
- [ ] Health check routes excluded from tracing
- [ ] Every Fastify route has a trace span (via `@fastify/otel` plugin)
- [ ] Every Prisma query visible as a span (via `PrismaInstrumentation`)
- [ ] Every BullMQ job carries trace context from producer to worker
- [ ] All logs include `traceId` and `spanId`
- [ ] RED metrics (rate, errors, duration) recorded per route
- [ ] `sdk.shutdown()` called on `SIGTERM`

## Activation Triggers

- "Add tracing / observability to my Fastify app"
- "Set up OpenTelemetry for Node.js"
- "Instrument my Prisma queries with OTel"
- "Trace BullMQ jobs"
- "Structured logging with trace correlation"
- "How do I see slow queries in production?"
- "Set up Grafana / Jaeger / SigNoz / Datadog with OTel"
- "Add RED metrics to my API"

## Skill Chain

**Feeds into**: `backend-systems-auditor` (OTel data reveals idempotency failures and slow shutdown paths in production).

**Creative combination**: `opentelemetry-observability-architect` is the capstone for every backend skill. Run it last: after `effect-ts-layer-architect` models the service, `prisma-database-architect` designs the schema, `bullmq-job-architect` wires the queues, and `api-automation-architect` hardens the integrations — OTel makes the whole system visible. One skill that multiplies the value of five others.
