---
name: real-time-systems-architect
description: >
  Designs and implements production-grade real-time systems: WebSocket and SSE architectures,
  presence/collaboration patterns, optimistic UI with rollback, BullMQ job progress streaming,
  SwarmX agent status feeds, and race condition handling. Use this skill when adding live data
  to a dashboard, streaming agent progress to a UI, implementing presence indicators, building
  collaborative features, or connecting BullMQ job events to a frontend. Triggers: "real-time",
  "WebSocket", "SSE", "server-sent events", "live updates", "presence indicator", "optimistic UI",
  "job progress streaming", "agent status live", "collaborative editing", "live dashboard",
  "BullMQ progress events", "connection lifecycle". Always use this skill before implementing
  any live data feature — connection lifecycle management and back-pressure are the hardest
  problems to retrofit.
---

# Real-Time Systems Architect

Build real-time systems that are bounded, observable, and safe to reconnect. The hardest
problems are connection lifecycle, back-pressure, and state reconciliation after disconnect —
solve them architecturally before the first `socket.on()` is written.

## Core Principles

- Choose SSE over WebSocket when the data flow is server → client only.
- WebSocket only when the client also sends events (collaborative, bidirectional).
- All connections must have a bounded maximum — reject when at capacity.
- Design for reconnect from the start — assume any connection will drop.
- Never trust the client's local state after a reconnect — always reconcile with server.
- Back-pressure is a feature, not an afterthought — slow consumers must not block producers.

---

## Step 1 — Choose the Right Transport

| Scenario | Transport | Why |
|---|---|---|
| Job progress (BullMQ → UI) | SSE | Server → client only; HTTP/2 multiplexed |
| Agent status (SwarmX → dashboard) | SSE | Unidirectional, works through reverse proxies |
| Presence / who's online | WebSocket | Bidirectional heartbeat required |
| Collaborative text editing | WebSocket | Low-latency bidirectional |
| Live dashboard metrics | SSE | Server → client; simpler auth via cookie |
| Chat (with optimistic UI) | WebSocket | Client sends messages |

---

## Step 2 — SSE Implementation (Next.js Route Handler)

```typescript
// app/api/jobs/[jobId]/progress/route.ts
// BullMQ job progress → SSE stream

import { NextRequest } from 'next/server'
import { QueueEvents }  from 'bullmq'

// Connection registry — bounded maximum
const MAX_SSE_CONNECTIONS = 500
let activeConnections = 0

export async function GET(
  req:     NextRequest,
  { params }: { params: { jobId: string } }
) {
  // Capacity check before accepting connection
  if (activeConnections >= MAX_SSE_CONNECTIONS) {
    return new Response('Service at capacity', { status: 503 })
  }

  const { jobId } = params
  const encoder   = new TextEncoder()
  let closed      = false

  const stream = new ReadableStream({
    async start(controller) {
      activeConnections++

      // Helper: send SSE event
      function send(event: string, data: unknown) {
        if (closed) return
        controller.enqueue(encoder.encode(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        ))
      }

      // Keep-alive ping every 15s (prevents proxy timeouts)
      const heartbeat = setInterval(() => {
        if (!closed) send('ping', { t: Date.now() })
      }, 15_000)

      // BullMQ QueueEvents — listen for job progress
      const queueEvents = new QueueEvents('swarmx:agents', {
        connection: new IORedis({ maxRetriesPerRequest: null }),
      })

      queueEvents.on('progress', ({ jobId: id, data }) => {
        if (id !== jobId) return
        send('progress', data)
      })

      queueEvents.on('completed', ({ jobId: id, returnvalue }) => {
        if (id !== jobId) return
        send('completed', { result: returnvalue })
        cleanup()
      })

      queueEvents.on('failed', ({ jobId: id, failedReason }) => {
        if (id !== jobId) return
        send('failed', { error: failedReason })
        cleanup()
      })

      function cleanup() {
        closed = true
        clearInterval(heartbeat)
        queueEvents.close()
        activeConnections--
        controller.close()
      }

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',  // nginx: disable proxy buffering
    },
  })
}
```

**Client-side SSE consumer (React):**
```tsx
// hooks/useJobProgress.ts
import { useEffect, useState } from 'react'

interface JobProgress {
  status:   'idle' | 'running' | 'completed' | 'failed'
  progress: number   // 0–100
  message?: string
  result?:  unknown
  error?:   string
}

export function useJobProgress(jobId: string | null) {
  const [state, setState] = useState<JobProgress>({ status: 'idle', progress: 0 })

  useEffect(() => {
    if (!jobId) return

    let retries = 0
    let source: EventSource | null = null

    function connect() {
      source = new EventSource(`/api/jobs/${jobId}/progress`)

      source.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data)
        setState(prev => ({ ...prev, status: 'running', progress: data.pct, message: data.msg }))
        retries = 0  // reset backoff on successful event
      })

      source.addEventListener('completed', (e) => {
        setState({ status: 'completed', progress: 100, result: JSON.parse(e.data).result })
        source?.close()
      })

      source.addEventListener('failed', (e) => {
        setState(prev => ({ ...prev, status: 'failed', error: JSON.parse(e.data).error }))
        source?.close()
      })

      source.onerror = () => {
        source?.close()
        // Exponential backoff reconnect (max 30s)
        const delay = Math.min(1000 * 2 ** retries++, 30_000)
        setTimeout(connect, delay)
      }
    }

    connect()
    return () => source?.close()
  }, [jobId])

  return state
}
```

---

## Step 3 — WebSocket with Fastify (Presence)

```typescript
// server/ws/presence.ts
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage }            from 'http'
import { verifyJWT }                  from '@/lib/auth'

const MAX_WS_CONNECTIONS = 1000

interface PresenceClient {
  ws:       WebSocket
  userId:   string
  roomId:   string
  lastPing: number
}

export class PresenceServer {
  private clients = new Map<string, PresenceClient>()  // connectionId → client
  private rooms   = new Map<string, Set<string>>()      // roomId → connectionIds
  private wss:    WebSocketServer

  constructor(server: import('http').Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/presence' })
    this.wss.on('connection', this.handleConnection.bind(this))

    // Dead connection cleanup every 30s
    setInterval(() => this.reapDeadConnections(), 30_000)
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    if (this.clients.size >= MAX_WS_CONNECTIONS) {
      ws.close(1013, 'Server at capacity')  // 1013 = Try Again Later
      return
    }

    // Auth: extract JWT from cookie or query param
    const token  = extractToken(req)
    const user   = await verifyJWT(token).catch(() => null)
    if (!user) { ws.close(1008, 'Unauthorized'); return }  // 1008 = Policy Violation

    const connectionId = crypto.randomUUID()
    const roomId       = extractRoomId(req.url)

    this.clients.set(connectionId, { ws, userId: user.id, roomId, lastPing: Date.now() })
    this.rooms.get(roomId)?.add(connectionId) ?? this.rooms.set(roomId, new Set([connectionId]))

    // Broadcast join event to room
    this.broadcast(roomId, { type: 'presence.join', userId: user.id }, connectionId)

    ws.on('message', (raw) => {
      const msg = safeParseJSON(raw.toString())
      if (!msg) return
      if (msg.type === 'ping') {
        const client = this.clients.get(connectionId)
        if (client) client.lastPing = Date.now()
        ws.send(JSON.stringify({ type: 'pong' }))
      }
    })

    ws.on('close', () => {
      this.clients.delete(connectionId)
      this.rooms.get(roomId)?.delete(connectionId)
      this.broadcast(roomId, { type: 'presence.leave', userId: user.id }, connectionId)
    })
  }

  private broadcast(roomId: string, msg: unknown, excludeConnectionId?: string) {
    const payload = JSON.stringify(msg)
    this.rooms.get(roomId)?.forEach(connId => {
      if (connId === excludeConnectionId) return
      const client = this.clients.get(connId)
      if (client?.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload)
      }
    })
  }

  private reapDeadConnections() {
    const now      = Date.now()
    const timeout  = 45_000  // 45s without ping = dead

    this.clients.forEach((client, connId) => {
      if (now - client.lastPing > timeout) {
        client.ws.terminate()
        this.clients.delete(connId)
        this.rooms.get(client.roomId)?.delete(connId)
      }
    })
  }
}
```

---

## Step 4 — Optimistic UI with Rollback

```tsx
// hooks/useOptimisticMutation.ts
// Optimistic updates with automatic rollback on server rejection

import { useCallback, useOptimistic } from 'react'

export function useOptimisticList<T extends { id: string }>(
  initial:  T[],
  mutate:   (item: T) => Promise<T>,
) {
  const [optimisticItems, addOptimistic] = useOptimistic(
    initial,
    (state, { action, item }: { action: 'add' | 'remove'; item: T }) => {
      if (action === 'add')    return [...state, { ...item, _optimistic: true }]
      if (action === 'remove') return state.filter(i => i.id !== item.id)
      return state
    }
  )

  const addItem = useCallback(async (item: T) => {
    // Immediately show the item (optimistic)
    addOptimistic({ action: 'add', item })

    try {
      // Server confirmation
      const confirmed = await mutate(item)
      // React's useOptimistic will replace the optimistic state with server response
      return confirmed
    } catch (error) {
      // useOptimistic automatically rolls back on component re-render
      // Show error toast to user
      toast.error(`Failed to save. Changes reverted.`)
      throw error
    }
  }, [addOptimistic, mutate])

  return { items: optimisticItems, addItem }
}
```

---

## Step 5 — State Reconciliation After Reconnect

```typescript
// Pattern: version-stamped state — client always syncs from server after reconnect

interface ServerState<T> {
  data:      T
  version:   number    // monotonically increasing
  updatedAt: string
}

async function reconcileAfterReconnect<T>(
  localVersion: number,
  fetchServerState: () => Promise<ServerState<T>>,
  applyServerState: (state: T) => void,
) {
  const server = await fetchServerState()

  if (server.version > localVersion) {
    // Server is ahead — apply server state (client may have missed events)
    applyServerState(server.data)
    return server.version
  }

  // Versions match — no reconciliation needed
  return localVersion
}

// SwarmX dashboard pattern: reconnect to agent status feed
function useAgentStatusFeed(pipelineId: string) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const source = new EventSource(`/api/pipelines/${pipelineId}/status`)

    source.onerror = async () => {
      // On reconnect, reconcile with server state
      const latest = await fetch(`/api/pipelines/${pipelineId}`).then(r => r.json())
      setVersion(v => {
        if (latest.version > v) {
          applyState(latest)
          return latest.version
        }
        return v
      })
    }

    return () => source.close()
  }, [pipelineId])
}
```

---

## Step 6 — Back-Pressure and Fan-Out

```typescript
// lib/realtime/broadcaster.ts
// Bounded fan-out — prevent one slow consumer from blocking all

export class BoundedBroadcaster<T> {
  private subscribers = new Map<string, {
    queue:    T[]
    maxQueue: number
    flush:    (batch: T[]) => void
  }>()

  subscribe(id: string, flush: (batch: T[]) => void, maxQueue = 100) {
    this.subscribers.set(id, { queue: [], maxQueue, flush })
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id)
  }

  emit(event: T) {
    this.subscribers.forEach((sub, id) => {
      if (sub.queue.length >= sub.maxQueue) {
        // Slow consumer: drop oldest event (ring buffer behavior)
        sub.queue.shift()
        logger.warn('realtime.queue.overflow', { subscriberId: id })
      }
      sub.queue.push(event)
    })
  }

  // Flush on each tick
  tick() {
    this.subscribers.forEach((sub) => {
      if (sub.queue.length > 0) {
        sub.flush([...sub.queue])
        sub.queue = []
      }
    })
  }
}
```

---

## Quality Gates

- [ ] Maximum concurrent connections is defined and enforced before accept()
- [ ] All SSE streams send a keep-alive ping every 15s (prevents proxy timeouts)
- [ ] WebSocket dead connection reaper runs every 30s
- [ ] Client reconnect uses exponential backoff (max 30s)
- [ ] State reconciliation runs on every reconnect — never trust local state after disconnect
- [ ] Slow consumers cannot block producers (bounded queue with drop-oldest)
- [ ] Connection counts are tracked as a metric (alert at 80% capacity)
- [ ] All WebSocket auth happens at connection time — not per-message

---

## Pair This Skill With

- `bullmq-job-architect` — job progress events that SSE streams to the UI
- `multi-agent-orchestration-architect` — agent pipeline status → SSE dashboard
- `opentelemetry-observability-architect` — connection count metrics, SSE latency spans
- `backend-systems-auditor` — graceful shutdown with active SSE/WS drain
- `nextjs-performance-architect` — SSE route handler performance and edge compatibility
- `security-hardening-auditor` — WebSocket auth, SSE token validation, rate limiting connections

---

## Activation Triggers

- "Add real-time / live updates to my dashboard"
- "WebSocket or SSE — which should I use?"
- "Stream BullMQ job progress to the frontend"
- "SwarmX agent status live in the UI"
- "Presence indicators / who's online"
- "Optimistic UI with rollback"
- "State reconciliation after disconnect"
- "Back-pressure for real-time events"
- "Live dashboard metrics"
- "Connection lifecycle management"
- "SSE route handler in Next.js"
- "Collaborative feature design"
