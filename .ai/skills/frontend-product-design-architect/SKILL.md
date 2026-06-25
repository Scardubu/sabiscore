---
name: frontend-product-design-architect
description: >
  Shapes premium frontend experiences through information architecture, content hierarchy,
  responsive layout, brand expression, and conversion-aware interaction design. Use this skill
  when a user asks to design or refine a landing page, dashboard, onboarding flow, form,
  marketing section, empty state, or any frontend surface that must feel world-class rather
  than merely functional. Also use for TaxBridge tax UX patterns, SabiScore analytics
  dashboards, SwarmX agent UI, or portfolio conviction design. Triggers: "design this page",
  "shape the IA", "improve the layout", "design my dashboard", "make this feel premium",
  "conversion design", "visual hierarchy", "product narrative". Always use this skill before
  any component is written — structure before code.
---

# Frontend Product Design Architect

Design frontend experiences as product narratives, not just screens. The goal is to make the
user's next action feel inevitable through structure, rhythm, hierarchy, and restraint.

## Core Principles

- Start from the user outcome, not the component list.
- Make one action dominant per screen or section.
- Treat content order as a design primitive — the first word a user reads shapes everything after.
- Use whitespace to separate meaning, not just to decorate.
- Keep the interface calm under stress: loading, empty, error, and disabled states must still
  look intentional.
- Design for both scanning (headline + label readers) and deep reading (form fillers, analysts).
- The reference bar is Stripe clarity, Linear precision, Vercel restraint. Earn every pixel.

## Workflow

### Step 1 — Clarify the Job of the Surface
Before any layout choice, answer:
- What decision is the user making on this screen?
- What does success look like for the user AND the product?
- What is the user's biggest source of doubt or anxiety here?
- Who is the primary persona (technical, decision-maker, data analyst, Nigerian SME owner)?

### Step 2 — Information Architecture
Define the reading path before the visual style:

```
Primary content  → establishes what this is and why it matters
Supporting proof → evidence, numbers, social proof, or data
Primary CTA      → one clear action — what to do next
Secondary action → less committed path (learn more, save, dismiss)
Trust signals    → compliance badge, testimonial, security indicator
```

Never put two equally weighted actions at the same level. Hierarchy is not decoration — it is
the core product decision.

### Step 3 — Responsive Breakpoints
Design three explicitly, not as an afterthought:

| Breakpoint | Width | Design intent |
|---|---|---|
| Mobile | 320px–767px | Single column, touch-first, simplified hierarchy |
| Tablet | 768px–1023px | Two-column max, revealed navigation, richer density |
| Desktop | 1024px+ | Full layout expression, persistent nav, data density |
| Ultra-wide | 1440px+ | Max-width container, generous margins, two-panel layouts |

```tsx
// Tailwind responsive pattern — always mobile-first
<section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {items.map(item => <Card key={item.id} {...item} />)}
  </div>
</section>
```

### Step 4 — State Design
Every UI surface has six states. Design all six before implementation:

| State | Design requirement |
|---|---|
| Default | Clean, clear hierarchy |
| Loading / Skeleton | Same spatial footprint, shimmer or pulse |
| Empty | Teach and invite — not "No data found" |
| Error | Explain what failed, how to recover, who to contact |
| Partial / Degraded | Graceful — show what's available, flag what isn't |
| Success | Celebrate briefly, then move forward |

```tsx
// Pattern: universal state wrapper
type PageState = 'idle' | 'loading' | 'error' | 'empty' | 'success'

function DataSection({ state, data, error }: Props) {
  if (state === 'loading') return <SkeletonGrid count={6} />
  if (state === 'error')   return <ErrorState message={error} onRetry={refetch} />
  if (state === 'empty')   return <EmptyState cta="Import your first record" />
  return <DataGrid items={data} />
}
```

### Step 5 — Section Composition Patterns

**Hero Section — one thesis, one proof, one action:**
```tsx
<section className="relative py-24 lg:py-32 overflow-hidden">
  {/* Semantic heading — one H1 per page */}
  <h1 className="text-4xl lg:text-6xl font-semibold tracking-tight text-balance max-w-4xl">
    {headline}
  </h1>
  {/* Proof point — concrete, not vague */}
  <p className="mt-6 text-lg text-muted max-w-2xl text-pretty">
    {supportingCopy}
  </p>
  {/* Single dominant CTA */}
  <div className="mt-10 flex items-center gap-4">
    <Button size="lg" variant="primary">{primaryCta}</Button>
    <Button size="lg" variant="ghost">{secondaryCta}</Button>
  </div>
</section>
```

**Dashboard — summary first, then progressive disclosure:**
```tsx
// SabiScore / TaxBridge analytics pattern
<main className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-screen">
  {/* Persistent navigation — the user always knows where they are */}
  <Sidebar />

  <div className="flex flex-col gap-6 p-6">
    {/* KPI row — scannable numbers first */}
    <KpiRow metrics={summaryMetrics} />

    {/* Charts — after numbers are understood */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <TrendChart />
      <BreakdownChart />
    </div>

    {/* Detail table — last, for deep readers */}
    <DataTable columns={columns} data={tableData} />
  </div>
</main>
```

**Form — chunked, inline validation, minimal cognitive load:**
```tsx
// Tax filing form pattern (TaxBridge)
<form className="space-y-8">
  {/* Chunk related fields together */}
  <fieldset className="space-y-4">
    <legend className="text-sm font-medium text-muted">Business Information</legend>
    <Input label="CAC Registration Number" required pattern="[A-Z]{2}\d{6}" />
    <Input label="TIN" required hint="11-digit Tax Identification Number" />
  </fieldset>

  <fieldset className="space-y-4">
    <legend className="text-sm font-medium text-muted">VAT Period</legend>
    <Select label="Reporting Period" options={periods} />
    <CurrencyInput label="Gross Revenue (₦)" currency="NGN" />
  </fieldset>

  {/* Primary action at the end, always visible */}
  <div className="flex justify-end gap-3 pt-6 border-t">
    <Button variant="ghost">Save Draft</Button>
    <Button variant="primary" type="submit">Submit Return</Button>
  </div>
</form>
```

**Empty State — teach, not apologize:**
```tsx
function EmptyState({ entity, cta, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Icon name="folder-open" className="w-12 h-12 text-muted/40 mb-4" />
      <h3 className="text-base font-semibold">No {entity} yet</h3>
      <p className="mt-1 text-sm text-muted max-w-xs text-pretty">
        {entity} you create will appear here. Start by adding your first one.
      </p>
      <Button className="mt-6" onClick={onAction}>{cta}</Button>
    </div>
  )
}
```

## Product-Vertical Design Patterns

### TaxBridge (Nigerian SME Tax Compliance)
- Primary language: English with Lagos Pidgin as equal first-class locale
- Currency: always display ₦ (Naira), format with Nigerian number conventions
- Trust signals: FIRS compliance badge, TIN verification status, last-filed date
- Error language: specific and recoverable ("TIN format must be 11 digits. Your entry has 10.")
- Progress indicators for multi-step returns (VAT, CIT filings are multi-step)
- Receipt scanner UI: camera-first, OCR confirmation step, manual override fallback

### SabiScore (Sports ML Intelligence)
- Data density is a feature — users are analysts, not casual readers
- Lead with the key insight (model confidence, anomaly alert, team form)
- Charts before tables; trend before snapshot
- Color-encode with semantic meaning (performance up = accent green, anomaly = warning amber)
- Provide text summary below every chart for accessibility

### SwarmX (Multi-Agent AI Dashboard)
- Agent status is always visible — never leave agents in an ambiguous state
- Real-time progress: streaming output, not batch reveals
- Error attribution: which agent failed, at which step, with what input
- Tool invocation trace: expandable call log for each agent turn

## Production-Grade Checks

Before any component is approved:

- [ ] A user identifies the primary action in under five seconds (scan test)
- [ ] Every section has a reason to exist (remove if in doubt)
- [ ] Reading order is logical with keyboard navigation
- [ ] Text size supports readability at 320px width (no overflow, no truncation)
- [ ] Visual rhythm survives dark mode and reduced motion preference
- [ ] The layout tolerates copy that is 30% longer than written (i18n/Pidgin)
- [ ] Empty, loading, and error states are designed and implemented

## Pair This Skill With

- `design-token-system-architect` — before choosing any colors, spacing, or type scale
- `accessibility-system-architect` — run after layout is set; never skip for public surfaces
- `motion-performance-architect` → `motion-interaction-architect` — motion strategy first, then code
- `nextjs-performance-architect` — for RSC/PPR decisions that must match the design intent
- `data-visualization-architect` — for any dashboard or analytics surface
- `nigerian-fintech-compliance-architect` — for TaxBridge forms, FIRS UI, currency display

## Reference Mindset

Stripe-level clarity. Linear-level precision. Vercel-level restraint. Then adapt the
composition to the product's own voice. Every choice reduces ambiguity, not adds visual noise.

For Nigerian market products: directness is a virtue, progress feedback is essential, and
trust is built through compliance signals, not visual flair.

## Activation Triggers

- "Design this page / screen / section"
- "Shape the information architecture"
- "Make this feel premium / world-class"
- "Improve the visual hierarchy"
- "Design the dashboard / landing page / onboarding"
- "How should I structure this form?"
- "Define the empty state / loading state / error state"
- "What's the right layout for this?"
- "Design TaxBridge / SabiScore / SwarmX UI"
- "Conversion design for my landing page"
