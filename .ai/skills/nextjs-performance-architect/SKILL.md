---
name: nextjs-performance-architect
description: >
  Audits and optimizes Next.js applications for maximum performance: RSC-first architecture,
  Partial Prerendering (PPR), caching strategy, Turbopack migration, bundle analysis, and
  Core Web Vitals. Use this skill whenever a user asks to speed up a Next.js app, optimize
  caching, fix Core Web Vitals, reduce bundle size, understand RSC vs client components,
  set up Turbopack, improve LCP/CLS/INP scores, configure Partial Prerendering, or says
  "my Next.js app is slow", "how do I cache correctly in App Router", "reduce my bundle size",
  "PPR setup", "when should I use RSC vs use client", "fix my Core Web Vitals",
  "configure ISR", or "migrate to Turbopack". Always use this skill for Next.js
  performance work — RSC caching semantics and PPR are counterintuitive without it.
---

# Next.js Performance Architect

Design and audit Next.js 15/16 App Router applications for maximum speed, minimum JS
payload, and production-grade caching. Every recommendation is specific, measurable, and
grounded in the current App Router mental model.

## The Four Cache Layers (must understand all four)

```
1. Request Memoization  — deduplicates identical fetch() calls within a single render
                          Scope: one request. Automatic. No config.

2. Data Cache           — persistent across requests; controlled per fetch() call
                          { cache: 'force-cache' }  — cache indefinitely
                          { next: { revalidate: 60 } }  — ISR: revalidate every 60s
                          { cache: 'no-store' }  — always fresh (dynamic)
                          revalidateTag('tag-name')  — on-demand invalidation

3. Full Route Cache     — static HTML+RSC payload cached at build time (SSG)
                          Disabled by: cookies(), headers(), searchParams, no-store fetch

4. Router Cache         — client-side cache of visited RSC payloads
                          Next.js 15+: default duration is 0s for dynamic, 5m for static
                          Invalidated by: router.refresh(), revalidatePath(), revalidateTag()
```

**The golden rule**: Next.js 15 changed the default — `fetch()` is now `no-store` by default.
Add `cache: 'force-cache'` or `revalidate` explicitly when you want caching.

## Rendering Decision Tree

```
Is the component interactive? (useState, useEffect, onClick, browser APIs)
  YES → 'use client'  (client component — keep leaf-level, not at root)
  NO  → Server Component (default — no directive needed)
       ↓
Does it fetch frequently-changing, per-user data?
  YES → dynamic = 'force-dynamic' or no-store fetch
  NO  → Does it change on a schedule?
    YES → ISR: { next: { revalidate: N } }
    NO  → Static: force-cache or generateStaticParams
```

## Protocol

### Step 1 — Audit Input

Accept: Next.js app directory structure, specific page/component code, build output, bundle
analysis report, or Lighthouse/PageSpeed scores.

Ask if needed: **"What's the main performance complaint — slow LCP, large bundle, slow API
response, or stale data?"** This targets the diagnosis.

### Step 2 — RSC Architecture Audit

Check for these anti-patterns:

| Anti-pattern | Impact | Fix |
|---|---|---|
| `'use client'` on a layout or page root | Entire subtree loses RSC benefits | Move to leaf interactive components only |
| `cookies()`/`headers()` in a shared layout | Forces entire route tree to dynamic | Read only in the specific page that needs it |
| Fetching in a client component | Data exposed in JS bundle, no deduplication | Lift fetch to RSC, pass as prop |
| Sequential `await` fetches in one RSC | Waterfall: each waits for prior | `Promise.all([fetchA(), fetchB()])` |
| `useEffect` fetching on mount | Shows loading spinner after hydration | Move to RSC or use React `use()` hook |
| `import * from 'heavy-lib'` in client component | Bundles entire library | Named imports only; consider server-side |

**Corrected RSC pattern:**
```tsx
// ✅ app/dashboard/page.tsx — RSC, fetches in parallel
import { Suspense } from 'react'
import { UserSummary } from './UserSummary'     // RSC: reads DB
import { AnalyticsChart } from './AnalyticsChart' // Client: needs interactivity

export default async function DashboardPage() {
  // Parallel fetches — no waterfall
  const [user, stats] = await Promise.all([
    getUser(),    // cached: { cache: 'force-cache' }
    getStats(),   // ISR: { next: { revalidate: 300 } }
  ])
  return (
    <>
      <UserSummary user={user} />
      <Suspense fallback={<ChartSkeleton />}>
        <SlowDataLoader />   {/* streams independently */}
      </Suspense>
      <AnalyticsChart stats={stats} />
    </>
  )
}
```

### Step 3 — Caching Strategy

Generate the correct caching config per data type:

```tsx
// ─── User-specific, always fresh ─────────────────────────
const userData = await fetch('/api/user', {
  cache: 'no-store',
  headers: { Authorization: `Bearer ${token}` },
})

// ─── Shared content, revalidate every 5 minutes ──────────
const content = await fetch('/api/content', {
  next: { revalidate: 300, tags: ['content'] },
})

// ─── Static reference data, revalidate on deploy ─────────
const config = await fetch('/api/config', {
  cache: 'force-cache',
  next: { tags: ['config'] },
})

// ─── On-demand invalidation (Server Action or Route Handler)
import { revalidateTag, revalidatePath } from 'next/cache'
export async function updateContent() {
  'use server'
  await db.content.update(...)
  revalidateTag('content')           // targeted: only content pages
  // revalidatePath('/dashboard')    // page-level: entire dashboard
}

// ─── Deduplicate within a request (react.cache) ──────────
import { cache } from 'react'
export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } })
})
// Calling getUser('abc') 5x in one render → 1 DB query
```

### Step 4 — Partial Prerendering (PPR)

PPR renders a static shell at build time and streams dynamic holes on request.
Result: SSG-fast TTFB + SSR-fresh content, simultaneously.

```tsx
// next.config.ts — enable PPR (stable in Next.js 16)
const nextConfig = {
  experimental: {
    ppr: true,  // or 'incremental' to opt-in per route
  },
}

// app/dashboard/page.tsx — PPR-aware layout
import { Suspense } from 'react'

// Static shell — prerendered at build time
export default function Dashboard() {
  return (
    <div className="dashboard-layout">
      <StaticHeader />    {/* ← prerendered, served instantly */}
      <StaticSidebar />   {/* ← prerendered */}
      <Suspense fallback={<DataSkeleton />}>
        <DynamicFeed />   {/* ← dynamic hole, streamed per-request */}
      </Suspense>
    </div>
  )
}
```

**PPR rules:**
- Wrap ALL dynamic content in `<Suspense>` boundaries
- Static content must not call `cookies()`, `headers()`, or `Math.random()`
- Fallbacks should be pixel-accurate skeletons (no layout shift)

### Step 5 — Turbopack Migration

```ts
// package.json
{
  "scripts": {
    "dev": "next dev --turbopack",    // fast refresh + HMR
    "build": "next build",            // Turbopack builds: Next.js 16+
  }
}

// next.config.ts — Turbopack-specific optimizations
import type { NextConfig } from 'next'
const config: NextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@/': './src/',
      },
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
}
export default config
```

### Step 6 — Bundle Analysis

```bash
# Install analyzer
pnpm add -D @next/bundle-analyzer

# next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
export default withAnalyzer(nextConfig)

# Run
ANALYZE=true pnpm build
```

**What to look for in the bundle:**
- Client components > 50KB — should they be RSC?
- Duplicated modules across chunks — check for multiple React versions
- `node_modules` > 30% of client bundle — move to server
- Icon libraries — use named imports: `import { ArrowRight } from 'lucide-react'`
- Date libraries (`moment`, `date-fns`) — prefer `Temporal` API or `dayjs`

### Step 7 — Core Web Vitals Fixes

**LCP (Largest Contentful Paint) — target: < 2.5s**
```tsx
// Hero image: always use priority
<Image src="/hero.webp" alt="Hero" width={1200} height={600} priority />
// Preload critical font
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
// Eliminate render-blocking: use next/font
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap' })
```

**CLS (Cumulative Layout Shift) — target: < 0.1**
```tsx
// Always specify width + height on images (prevents layout shift)
<Image src="..." alt="..." width={800} height={400} />
// Reserve space for dynamic content
<div className="min-h-[200px]"><DynamicComponent /></div>
// Avoid inserting content above existing content
```

**INP (Interaction to Next Paint) — target: < 200ms**
```tsx
// Offload heavy computation from click handlers
import { startTransition } from 'react'
const handleClick = () => {
  startTransition(() => {
    setExpensiveState(computeExpensiveValue())
  })
}
// Debounce frequent updates
// Use React compiler auto-memoization (Next.js 16 + React 19.2)
```

## Quality Gates

- [ ] No `'use client'` above the leaf component level
- [ ] No sequential `await` chains where `Promise.all` applies
- [ ] All images use `next/image` with explicit `width`/`height`
- [ ] LCP image marked `priority`
- [ ] Each fetch has an explicit cache strategy (no accidental no-store defaults)
- [ ] Lighthouse score: Performance > 90, CLS < 0.1, LCP < 2.5s
- [ ] Bundle: client JS < 150KB gzipped on initial load

## Activation Triggers

- "My Next.js app is slow / feels laggy"
- "How do I cache correctly in App Router?"
- "When should I use RSC vs 'use client'?"
- "Set up PPR / Partial Prerendering"
- "Reduce my Next.js bundle size"
- "Fix my Core Web Vitals / LCP / CLS / INP"
- "Configure ISR / on-demand revalidation"
- "Migrate to Turbopack"

## Skill Chain

**Feeds into**: `design-token-system-architect` (RSC architecture decisions affect where tokens load — server vs client) → `security-hardening-auditor` (PPR and caching affect CSP header strategy) → `testing-strategy-architect` (RSC components need specific test patterns).

**Creative combination**: `nextjs-performance-architect` optimises the rendering strategy, `design-token-system-architect` ensures tokens load server-side without hydration flash, `security-hardening-auditor` locks down the resulting headers. A Next.js app that is fast, beautiful, and secure.
