---
name: security-hardening-auditor
description: >
  Audits and hardens full-stack Next.js and Node.js applications against OWASP Top 10:
  authentication with Auth.js v5, authorization patterns, Content Security Policy headers,
  API rate limiting, CORS configuration, input validation, SQL injection prevention,
  XSS protection, CSRF defense, and secrets management. Use this skill whenever a user
  asks to secure their app, add authentication, set up Auth.js, configure CSP headers,
  add rate limiting, audit for security vulnerabilities, set up CORS, validate inputs,
  or says "is my app secure", "set up Auth.js / NextAuth", "add rate limiting",
  "configure CSP headers", "prevent XSS / SQL injection / CSRF", "secure my API",
  "authentication setup", or "secrets management". Always use this skill for security
  work — authentication and header configuration have production-breaking gotchas.
---

# Security Hardening Auditor

Audit and harden full-stack applications against OWASP Top 10. Every finding has a
severity rating, root cause, and concrete remediation. Every config is production-ready.

## OWASP Top 10 Checklist (2025)

| # | Category | Priority |
|---|---|---|
| A01 | Broken Access Control | 🔴 Critical |
| A02 | Cryptographic Failures | 🔴 Critical |
| A03 | Injection (SQL, NoSQL, Command) | 🔴 Critical |
| A04 | Insecure Design | 🟡 High |
| A05 | Security Misconfiguration (headers, CORS) | 🟡 High |
| A06 | Vulnerable Components | 🟡 High |
| A07 | Authentication Failures | 🔴 Critical |
| A08 | Software Integrity Failures | 🟡 High |
| A09 | Logging & Monitoring Failures | 🟠 Medium |
| A10 | SSRF | 🟠 Medium |

## Protocol

### Step 1 — Classify Request

Is this a new security setup, or an audit of existing code?

- **New setup**: generate auth, headers, rate limiting, and validation configs
- **Audit**: run through all 10 categories, produce finding report

### Step 2 — Authentication (Auth.js v5 / NextAuth v5)

```bash
pnpm add next-auth@beta
```

```typescript
// auth.ts (root of project)
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import Google      from 'next-auth/providers/google'
import { db }      from './lib/db'
import { z }       from 'zod'
import bcrypt      from 'bcryptjs'

const CredentialsSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8).max(72),   // bcrypt max 72 chars
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },          // 'database' for server-heavy apps
  pages: {
    signIn: '/sign-in',
    error:  '/sign-in',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role          // ← embed role in JWT
      }
      return token
    },
    session({ session, token }) {
      session.user.id   = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      async authorize(credentials) {
        // Validate input shape first
        const parsed = CredentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, passwordHash: true, role: true },
        })
        if (!user?.passwordHash) return null

        // Constant-time comparison (prevents timing attacks)
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
})

// app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/auth'
```

**Password hashing:**
```typescript
// Never store plaintext passwords
import bcrypt from 'bcryptjs'
const SALT_ROUNDS = 12   // ~250ms on modern hardware — adjust for your server

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}
```

### Step 3 — Authorization (Route + Resource)

```typescript
// middleware.ts — protect routes at the edge
import { auth } from './auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Unauthenticated → redirect to sign-in
  if (!session && !pathname.startsWith('/sign-in') && !pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // Admin-only routes
  if (pathname.startsWith('/admin') && session?.user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}

// Resource-level authorization in Server Actions / Route Handlers
export async function getInvoice(invoiceId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, userId: true, amount: true },
  })
  if (!invoice) throw new Error('Not found')

  // ← Ownership check: user can only access their own invoices
  if (invoice.userId !== session.user.id && session.user.role !== 'ADMIN') {
    throw new Error('Forbidden')
  }

  return invoice
}
```

### Step 4 — Security Headers

```typescript
// next.config.ts — security headers
const securityHeaders = [
  // Prevent iframe embedding (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // HTTPS only (1 year, include subdomains)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Referrer policy
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy — adjust for your CDN/fonts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",   // adjust: remove unsafe-* in production
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

export default {
  headers: async () => [
    { source: '/(.*)', headers: securityHeaders },
  ],
} satisfies NextConfig
```

### Step 5 — Rate Limiting

```typescript
// Using Upstash Redis (serverless-compatible)
// pnpm add @upstash/ratelimit @upstash/redis
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

// Different limits per endpoint sensitivity
export const ratelimits = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15m'),   // 5 attempts per 15 min (brute force)
    analytics: true,
  }),
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1m'),  // 100 req/min standard API
    analytics: true,
  }),
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1m'),   // 10 AI calls/min (cost protection)
    analytics: true,
  }),
}

// Fastify plugin (for Node.js API)
// pnpm add @fastify/rate-limit
await fastify.register(import('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['x-forwarded-for']?.toString() ?? req.ip,
})
```

### Step 6 — Input Validation

```typescript
// ALL external inputs MUST be validated with Zod
import { z } from 'zod'

// Server Action validation
const CreateInvoiceSchema = z.object({
  vendorName: z.string().min(1).max(200).trim(),
  amount:     z.number().positive().max(1_000_000),
  currency:   z.enum(['NGN', 'USD', 'EUR', 'GBP']),
  dueDate:    z.string().datetime(),
  lineItems:  z.array(z.object({
    description: z.string().min(1).max(500),
    quantity:    z.number().int().positive().max(10_000),
    unitPrice:   z.number().positive(),
  })).min(1).max(100),
})

export async function createInvoice(formData: unknown) {
  'use server'
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  // ← Validate BEFORE any DB operation
  const parsed = CreateInvoiceSchema.safeParse(formData)
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`)
  }

  return db.invoice.create({ data: { ...parsed.data, userId: session.user.id } })
}
```

### Step 7 — SQL Injection Prevention

```typescript
// Prisma parameterizes all queries automatically — safe by default
const user = await db.user.findUnique({ where: { email } }) // ✅ safe

// Raw queries MUST use tagged template literals (parameterized)
const result = await db.$queryRaw`
  SELECT * FROM users WHERE email = ${email}   -- ✅ parameterized
`

// ❌ NEVER concatenate user input into raw SQL
const result = await db.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)
```

### Step 8 — Secrets Management

```bash
# Never commit secrets — use .env.local for development
echo ".env.local" >> .gitignore
echo ".env*.local" >> .gitignore

# Required env vars validation at startup
# pnpm add @t3-oss/env-nextjs zod
```

```typescript
// env.ts — fail fast if secrets missing
import { createEnv } from '@t3-oss/env-nextjs'
import { z }         from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL:        z.string().url(),
    AUTH_SECRET:         z.string().min(32),
    GOOGLE_CLIENT_ID:    z.string().optional(),
    GOOGLE_CLIENT_SECRET:z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL:         process.env.DATABASE_URL,
    AUTH_SECRET:          process.env.AUTH_SECRET,
    NEXT_PUBLIC_APP_URL:  process.env.NEXT_PUBLIC_APP_URL,
    // ...
  },
})
// Import env instead of process.env — throws on startup if any required var is missing
```

## Security Audit Report Format

```
## Security Audit: [Service/App Name]

### 🔴 Critical (fix before any deployment)
- [A0X] [Finding]: [Location] → [Risk] → [Remediation]

### 🟡 High (fix within 1 week)
- [A0X] [Finding]: [Location] → [Risk] → [Remediation]

### 🟠 Medium (fix within sprint)
- [A0X] [Finding]: [Location] → [Risk] → [Remediation]

### ✅ Passing
- [Category]: [Why it passes]

### Summary
- Critical: N | High: N | Medium: N | Low: N
```

## Quality Gates

- [ ] All passwords hashed with bcrypt (12+ rounds), never stored plaintext
- [ ] JWT secret is ≥ 32 random characters (not a word, not a UUID)
- [ ] Ownership check on every resource fetch (user can't read other users' data)
- [ ] All route handlers validate session before processing
- [ ] All external inputs validated with Zod before DB operations
- [ ] No `$queryRawUnsafe` with user-controlled input
- [ ] Security headers present and tested with securityheaders.com
- [ ] Rate limiting on auth endpoints (≤ 5 attempts per 15 min)
- [ ] Secrets validated at startup via `@t3-oss/env-nextjs`

## Activation Triggers

- "Is my app secure / audit for security issues"
- "Set up Auth.js / NextAuth v5"
- "Add rate limiting to my API"
- "Configure CSP / security headers"
- "Prevent SQL injection / XSS / CSRF"
- "Authentication setup for Next.js"
- "Secure my Fastify / Next.js API"
- "Secrets management for Node.js"

## Skill Chain

**Feeds into**: `backend-systems-auditor` (auth patterns are audited for ownership checks) → `testing-strategy-architect` (security tests belong in the E2E suite — auth redirects, rate limit responses).

**Creative combination**: `security-hardening-auditor` establishes the auth and headers baseline. `opentelemetry-observability-architect` adds suspicious request tracing (high error rates, repeated 401s signal attacks). `testing-strategy-architect` writes Playwright tests that verify auth boundaries hold after every deploy. Defence in depth across all three layers.
