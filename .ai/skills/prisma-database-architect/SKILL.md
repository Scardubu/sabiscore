---
name: prisma-database-architect
description: >
  Designs, audits, and optimizes Prisma schemas, migrations, queries, and connection pooling
  for production PostgreSQL deployments. Use this skill whenever a user asks to design a
  Prisma schema, optimize slow queries, write a migration, set up connection pooling,
  add database indexes, debug N+1 query problems, configure Prisma Accelerate, or says
  "design a schema for X", "my Prisma query is slow", "how do I add an index", "set up
  PgBouncer / Prisma Accelerate", "how do I write a safe migration", "N+1 query fix",
  "Prisma connection pool setup", "audit my schema", or "how do I use Prisma with Fastify".
  Always use this skill for Prisma schema and query work — indexing decisions, migration
  safety, and connection pool sizing have non-obvious production consequences.
---

# Prisma Database Architect

Design, audit, and optimize Prisma schemas, migrations, and queries for production
PostgreSQL. Every schema decision is justified. Every query is analyzed for N+1 risk.
Every migration is safe to run on a live database.

## Schema Design Principles

- **Model names**: PascalCase singular (`User`, `Invoice`, not `users`, `Invoices`)
- **Field naming**: camelCase in Prisma, `@map` to snake_case in PostgreSQL
- **IDs**: use `cuid()` or `uuid()` — never auto-increment Int for public-facing IDs
- **Timestamps**: every model has `createdAt` and `updatedAt`
- **Soft deletes**: add `deletedAt DateTime?` + filter in queries; never hard-delete user data
- **Enums**: define in Prisma schema, not as raw strings in the application
- **Relations**: explicit `@relation` with named fields on both sides
- **Indexes**: add `@@index` on every foreign key and every field used in `where` clauses

## Protocol

### Step 1 — Schema Design

**Production schema template:**
```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres", "tracing"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // for Prisma Accelerate: direct connection for migrations
}

model User {
  id          String    @id @default(cuid())
  email       String    @unique
  name        String?
  role        UserRole  @default(MEMBER)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")  // soft delete

  // Relations
  invoices    Invoice[]
  sessions    Session[]

  @@index([email])
  @@index([deletedAt])    // filter active users efficiently
  @@map("users")
}

enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}

model Invoice {
  id          String        @id @default(cuid())
  number      String        @unique
  amount      Decimal       @db.Decimal(12, 2)  // never Float for money
  currency    String        @default("NGN")
  status      InvoiceStatus @default(DRAFT)
  issuedAt    DateTime?     @map("issued_at")
  dueAt       DateTime?     @map("due_at")
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  // Foreign keys
  userId      String        @map("user_id")
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  lineItems   LineItem[]

  @@index([userId])              // FK index — always index FKs
  @@index([status, dueAt])       // composite: filter by status + sort by due date
  @@index([number])
  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}
```

**Money rule**: Always use `Decimal @db.Decimal(precision, scale)`, never `Float`.
Float arithmetic loses cents. `Decimal` is exact.

### Step 2 — Migration Safety (Expand-Migrate-Contract)

**Safe migration checklist before running:**

| Operation | Safe? | How to do it safely |
|---|---|---|
| Add nullable column | ✅ Yes | `ALTER TABLE ADD COLUMN col TYPE NULL` |
| Add NOT NULL column | ❌ No | Add nullable → backfill → add constraint |
| Add column with DEFAULT | ✅ Yes (PostgreSQL 11+) | Single migration with default |
| Rename column | ❌ No | Add new → dual-write → backfill → drop old |
| Drop column | ❌ No | Deprecate in code first → remove reads → drop |
| Add index | ✅ Yes (use CONCURRENTLY) | `CREATE INDEX CONCURRENTLY` |
| Add unique constraint | ⚠️ Careful | Verify no duplicates first; long lock |

**Adding a NOT NULL column in three deployments:**
```sql
-- Migration 1 (Deploy 1): Add nullable
ALTER TABLE users ADD COLUMN phone TEXT NULL;

-- Migration 2 (Deploy 2): Backfill existing rows
UPDATE users SET phone = '' WHERE phone IS NULL;
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- OR: use DEFAULT to make it one migration on Postgres 11+
ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
```

**Adding an index without locking the table:**
```sql
-- In Prisma, this is NOT automatic — write raw SQL in migration
CREATE INDEX CONCURRENTLY idx_invoices_user_id ON invoices(user_id);
-- The CONCURRENTLY keyword builds index without blocking reads/writes
```

**Prisma migration with raw SQL:**
```bash
# Generate empty migration (don't auto-generate for complex ops)
pnpm prisma migrate dev --create-only --name add_phone_index

# Edit the generated SQL file to use CONCURRENTLY
# Then apply:
pnpm prisma migrate dev
```

### Step 3 — Query Optimization

**Diagnose N+1 queries:**
```typescript
// ❌ N+1: fetches user, then 1 query per invoice
const users = await prisma.user.findMany()
for (const user of users) {
  const invoices = await prisma.invoice.findMany({ where: { userId: user.id } })
}

// ✅ Eager load with include — 2 queries total
const users = await prisma.user.findMany({
  include: { invoices: true },
})

// ✅ Select only what you need (don't over-fetch)
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    invoices: {
      select: { id: true, amount: true, status: true },
      where: { status: 'SENT' },
      orderBy: { dueAt: 'asc' },
      take: 10,
    },
  },
})
```

**Pagination — cursor-based (preferred for large datasets):**
```typescript
// ❌ Offset pagination — slow at high offsets (full scan)
const page2 = await prisma.invoice.findMany({ skip: 1000, take: 20 })

// ✅ Cursor-based — O(1) regardless of page depth
const page2 = await prisma.invoice.findMany({
  take: 20,
  skip: 1,                       // skip the cursor itself
  cursor: { id: lastSeenId },    // from previous page's last item
  orderBy: { createdAt: 'desc' },
})
```

**Upsert for idempotent writes:**
```typescript
// ✅ Safe to retry — won't create duplicates
await prisma.user.upsert({
  where: { email: 'user@example.com' },
  update: { name: 'Updated Name' },
  create: { email: 'user@example.com', name: 'New User' },
})
```

**Transactions for multi-table writes:**
```typescript
// ✅ Interactive transaction — all-or-nothing
const [invoice, activity] = await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: invoiceData })
  const activity = await tx.activityLog.create({
    data: { type: 'INVOICE_CREATED', resourceId: invoice.id },
  })
  return [invoice, activity]
})

// ✅ Batch transaction — performant for bulk operations
await prisma.$transaction([
  prisma.invoice.updateMany({ where: { status: 'SENT' }, data: { status: 'OVERDUE' } }),
  prisma.notification.createMany({ data: overdueNotifications }),
])
```

**Raw queries for complex operations (explain analyze):**
```typescript
// Run EXPLAIN ANALYZE directly through Prisma
const result = await prisma.$queryRaw`
  EXPLAIN ANALYZE
  SELECT u.id, u.email, COUNT(i.id) AS invoice_count
  FROM users u
  LEFT JOIN invoices i ON i.user_id = u.id
  WHERE u.deleted_at IS NULL
  GROUP BY u.id
  ORDER BY invoice_count DESC
  LIMIT 20
`
```

### Step 4 — Connection Pooling

**For Serverless (Next.js on Vercel) — use Prisma Accelerate:**
```env
# .env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"
DIRECT_URL="postgresql://user:pass@host/db"  # for migrations only
```

```bash
pnpm add @prisma/extension-accelerate
```

```typescript
// lib/db.ts — singleton pattern for long-running servers
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
}).$extends(withAccelerate())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**For long-running servers (Fastify) — configure pool size:**
```env
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=20&pool_timeout=20"
# connection_limit: max connections per Prisma instance
# pool_timeout: wait time before throwing a pool exhaustion error
```

**Connection pool sizing formula:**
```
max_connections = (num_workers × connections_per_worker) + headroom
# Example: 4 Fastify workers × 5 connections + 5 = 25
# PostgreSQL default max_connections = 100
# Rule: never exceed 80% of PostgreSQL max_connections across all instances
```

### Step 5 — OpenTelemetry Integration

```typescript
// Enable Prisma query tracing (requires previewFeature: ["tracing"])
import { PrismaInstrumentation } from '@prisma/instrumentation'
// Add to OTel setup (see opentelemetry-observability-architect skill)
instrumentations: [new PrismaInstrumentation()]
// Now every Prisma query appears as a span in your trace
```

### Step 6 — Soft Delete Pattern

```typescript
// Always filter out deleted records
const activeUsers = await db.user.findMany({
  where: { deletedAt: null },
})

// Soft delete
await db.user.update({
  where: { id },
  data: { deletedAt: new Date() },
})

// Extension for automatic soft-delete filtering (Prisma 5+)
export const db = new PrismaClient().$extends({
  query: {
    user: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null }
        return query(args)
      },
    },
  },
})
```

## Quality Gates

- [ ] No `Float` fields for monetary values (use `Decimal`)
- [ ] Every foreign key has a `@@index`
- [ ] Every `where`-filtered field has an index
- [ ] No N+1 queries (use Prisma query log or `@prisma/instrumentation` to detect)
- [ ] Migrations use `CONCURRENTLY` for index creation on large tables
- [ ] NOT NULL columns added safely (with default or in multiple deploys)
- [ ] Connection pool sized correctly for server configuration
- [ ] `prisma.$disconnect()` called in graceful shutdown handler
- [ ] `db.ts` uses singleton pattern (one PrismaClient instance per process)

## Activation Triggers

- "Design a Prisma schema for [domain]"
- "My Prisma query is slow / timing out"
- "Fix N+1 queries in Prisma"
- "How do I add an index / migration safely?"
- "Set up connection pooling for Prisma"
- "Configure Prisma Accelerate for serverless"
- "How do I use transactions in Prisma?"
- "Audit my Prisma schema"

## Skill Chain

**Feeds into**: `backend-systems-auditor` (schema and migration safety are audit criteria) → `opentelemetry-observability-architect` (Prisma instrumentation exposes slow queries as traces).

**Creative combination**: `prisma-database-architect` designs the schema and safe migrations, `opentelemetry-observability-architect` instruments every query as a span, `vscode-debug-profiler` profiles locally with CPU flamecharts. Three skills that eliminate slow queries from dev to production.
