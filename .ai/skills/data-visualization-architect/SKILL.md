---
name: data-visualization-architect
description: >
  Designs and implements production-grade data visualizations for dashboards, analytics surfaces,
  and reporting UIs. Covers Recharts patterns, D3 custom visualizations, chart accessibility
  (screen reader equivalents, color-blind safe palettes), responsive chart design, SabiScore
  sports ML intelligence display, TaxBridge financial reporting charts, and dashboard data
  architecture. Use this skill when building any chart, graph, or analytics UI. Triggers:
  "chart", "data visualization", "recharts", "D3", "dashboard data", "SabiScore display",
  "analytics UI", "time series chart", "tax reporting chart", "financial chart", "heatmap",
  "bar chart", "accessible chart", "chart accessibility", "responsive chart",
  "chart color palette". Always use this skill for charts — accessibility and performance
  patterns are not obvious and easy to get wrong.
---

# Data Visualization Architect

Design charts that are accurate, accessible, and fast. Every chart communicates a specific
claim — design for that claim, not for chart variety.

## Core Principles

- Lead with the insight, not the chart type. The insight determines the right chart.
- One chart = one question answered. Never combine three chart types into a single view.
- Color palettes must be color-blind safe. Use shape, pattern, or label as the primary differentiator.
- Every chart must have a text equivalent accessible to screen readers.
- Responsive charts adapt behavior, not just size — a bar chart becomes a horizontal bar at mobile.
- Performance: charts with > 1,000 points must use canvas rendering, not SVG.

---

## Step 1 — Choose the Right Chart Type

| Analytical Question | Chart Type | When to avoid |
|---|---|---|
| How does X change over time? | Line chart | If time series has many gaps |
| How do categories compare? | Bar chart (vertical) | More than 8–10 categories |
| How do many categories compare? | Bar chart (horizontal) | Fewer than 5 categories |
| What proportion of the whole? | Donut / pie (≤ 5 segments only) | More than 5 segments → use bar |
| How do two variables correlate? | Scatter plot | Obvious linear relationship → line |
| How does composition change over time? | Stacked area | More than 5 stacks = illegible |
| Geographic distribution? | Choropleth / map | No geographic pattern → use bar |
| Distribution shape? | Histogram or box plot | Ordinal data → bar |
| SabiScore match predictions | Horizontal bar (team vs team) | Never pie — comparison, not proportion |
| TaxBridge monthly VAT trend | Line chart | Never bar for continuous trend |

---

## Step 2 — Recharts Setup and Core Patterns

```tsx
// lib/charts/base.tsx — shared chart primitives

'use client'
import {
  ResponsiveContainer, LineChart, BarChart, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Line, Bar, Area, ReferenceLine,
} from 'recharts'

// Design token integration — never hardcode chart colors
export const CHART_COLORS = {
  primary:   'var(--color-accent)',
  secondary: 'var(--color-muted)',
  success:   'var(--color-success)',
  warning:   'var(--color-warning)',
  danger:    'var(--color-danger)',
  // Color-blind safe palette (Okabe-Ito)
  series: [
    '#0072B2',  // blue
    '#E69F00',  // orange
    '#009E73',  // green
    '#CC79A7',  // purple/pink
    '#D55E00',  // vermilion
    '#56B4E9',  // sky blue
    '#F0E442',  // yellow (use sparingly — low contrast)
  ],
} as const

// Standard chart wrapper — always responsive
export function ChartContainer({
  children,
  title,
  description,
  height = 320,
}: ChartContainerProps) {
  const chartId = useId()

  return (
    <figure role="figure" aria-labelledby={`${chartId}-title`} aria-describedby={`${chartId}-desc`}>
      <figcaption className="sr-only">
        <h3 id={`${chartId}-title`}>{title}</h3>
        <p id={`${chartId}-desc`}>{description}</p>
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </figure>
  )
}
```

**Time Series — TaxBridge VAT trend:**
```tsx
export function VATTrendChart({ data }: { data: MonthlyVAT[] }) {
  return (
    <ChartContainer
      title="Monthly VAT Output vs Input Credit"
      description={`Line chart showing VAT output tax and input credit from ${data[0]?.period} to ${data.at(-1)?.period}. Net VAT is the difference.`}
      height={320}
    >
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatNairaCompact(v)}
          tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value: number, name: string) => [formatNaira(value), name]}
          contentStyle={{
            background:   'var(--color-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: '8px',
            fontSize:     '13px',
          }}
        />
        <Legend />
        <Line
          dataKey="outputVAT"
          name="Output VAT (charged)"
          stroke={CHART_COLORS.series[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="inputVAT"
          name="Input VAT (credit)"
          stroke={CHART_COLORS.series[1]}
          strokeWidth={2}
          strokeDasharray="4 2"  // visual differentiator beyond color
          dot={false}
        />
        <ReferenceLine y={0} stroke="var(--color-border)" />
      </LineChart>
    </ChartContainer>
  )
}
```

**Comparison Bar — SabiScore team prediction:**
```tsx
export function MatchPredictionChart({ match }: { match: MatchPrediction }) {
  const data = [
    {
      metric: 'Win Probability',
      home:   match.homeWinProbability * 100,
      away:   match.awayWinProbability * 100,
      draw:   match.drawProbability    * 100,
    },
    {
      metric: 'xGoals',
      home:   match.homeXG,
      away:   match.awayXG,
      draw:   0,
    },
  ]

  return (
    <ChartContainer
      title={`${match.homeTeam} vs ${match.awayTeam} Prediction`}
      description={`${match.homeTeam} has ${(match.homeWinProbability * 100).toFixed(0)}% win probability, ${match.awayTeam} has ${(match.awayWinProbability * 100).toFixed(0)}%, with ${(match.drawProbability * 100).toFixed(0)}% chance of a draw.`}
      height={240}
    >
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <YAxis type="category" dataKey="metric" width={100} />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Legend />
        <Bar dataKey="home" name={match.homeTeam} fill={CHART_COLORS.series[0]} radius={[0, 4, 4, 0]} />
        <Bar dataKey="away" name={match.awayTeam} fill={CHART_COLORS.series[1]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
```

---

## Step 3 — Chart Accessibility (Non-Negotiable)

```tsx
// Every chart must have:
// 1. <figure> with aria-labelledby + aria-describedby
// 2. A sr-only text summary of the key insight
// 3. A data table fallback for screen readers

export function AccessibleChart<T extends Record<string, unknown>>({
  title,
  insight,
  data,
  columns,
  children,
}: AccessibleChartProps<T>) {
  const [showTable, setShowTable] = useState(false)

  return (
    <div>
      {/* Visual chart */}
      <figure aria-hidden={showTable}>
        {children}
      </figure>

      {/* Text insight — always visible to screen readers */}
      <p className="sr-only">{insight}</p>

      {/* Toggle for data table (screen reader and power user) */}
      <button
        type="button"
        className="text-xs text-muted underline mt-2"
        onClick={() => setShowTable(v => !v)}
        aria-expanded={showTable}
      >
        {showTable ? 'Hide data table' : 'View data as table'}
      </button>

      {showTable && (
        <table className="mt-4 w-full text-sm border-collapse" aria-label={`Data table: ${title}`}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key as string} scope="col" className="text-left p-2 border-b">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col.key as string} className="p-2 border-b">
                    {col.format ? col.format(row[col.key]) : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

---

## Step 4 — High-Volume Data (Canvas Rendering)

For > 1,000 data points, SVG charts stall. Switch to canvas:

```tsx
// For SabiScore: real-time match event stream (100s of events per match)
// Use a canvas-based library for large datasets

import { Chart as ChartJS, registerables } from 'chart.js'
ChartJS.register(...registerables)

export function MatchEventTimeline({ events }: { events: MatchEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || events.length === 0) return

    const ctx = canvasRef.current.getContext('2d')!
    const chart = new ChartJS(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Match Events',
          data:  events.map(e => ({ x: e.minute, y: e.xGValue })),
          backgroundColor: events.map(e => getEventColor(e.type)),
        }],
      },
      options: {
        animation: false,        // disable animation for large datasets
        parsing:   false,        // disable data parsing (already formatted)
        normalized: true,        // hint that data is normalized
        responsive: true,
        maintainAspectRatio: false,
      },
    })

    return () => chart.destroy()
  }, [events])

  return (
    <div style={{ position: 'relative', height: '300px' }}>
      <canvas
        ref={canvasRef}
        aria-label={`Match event timeline: ${events.length} events plotted by minute and xG value`}
        role="img"
      />
    </div>
  )
}
```

---

## Step 5 — Responsive Chart Strategy

```tsx
// Charts change behavior at breakpoints, not just size

export function ResponsiveBarChart({ data, breakpoint = 640 }: Props) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => setWindowWidth(entry.contentRect.width))
    obs.observe(document.documentElement)
    return () => obs.disconnect()
  }, [])

  const isMobile = windowWidth < breakpoint

  return (
    <ChartContainer height={isMobile ? 240 : 320}>
      {isMobile ? (
        // Mobile: horizontal bar (labels readable, no x-axis crowding)
        <BarChart data={data} layout="vertical">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
          <Bar dataKey="value" fill={CHART_COLORS.primary} />
        </BarChart>
      ) : (
        // Desktop: vertical bar (standard orientation)
        <BarChart data={data}>
          <XAxis dataKey="label" />
          <YAxis />
          <Bar dataKey="value" fill={CHART_COLORS.primary} />
        </BarChart>
      )}
    </ChartContainer>
  )
}
```

---

## Step 6 — Dashboard Data Architecture

```typescript
// Dashboard data should be fetched as a single aggregated query, not N separate calls
// Pattern: server-side aggregation → one payload → client renders from memory

// ❌ Anti-pattern: waterfall chart loading
const vatData    = useSWR('/api/vat-trend')
const invoices   = useSWR('/api/invoices')
const compliance = useSWR('/api/compliance-score')
// Three network round-trips; charts pop in staggered

// ✅ Pattern: aggregated dashboard payload
interface TaxBridgeDashboard {
  vatTrend:        MonthlyVAT[]         // last 12 months
  invoiceSummary:  InvoiceSummary       // current quarter
  complianceScore: number               // 0–100
  nextDeadlines:   TaxDeadline[]        // upcoming filing dates
  refreshedAt:     string               // ISO timestamp
}

// Single RSC fetch — parallelized on the server
export default async function DashboardPage() {
  const dashboard = await fetchDashboardAggregate()  // one DB call, all joins server-side

  return (
    <>
      <KpiRow data={dashboard} />
      <Suspense fallback={<ChartSkeleton />}>
        <VATTrendChart   data={dashboard.vatTrend} />
        <ComplianceGauge score={dashboard.complianceScore} />
      </Suspense>
    </>
  )
}
```

---

## Quality Gates

- [ ] Every chart has a text description that conveys the key insight to a screen reader
- [ ] All chart palettes pass WCAG contrast at 3:1 (UI components)
- [ ] Color-blind mode: color is never the only differentiator (shape/dash pattern/label)
- [ ] Charts with > 1,000 data points use canvas rendering, not SVG
- [ ] Mobile layout uses horizontal bars or simplified views, not shrunken vertical bars
- [ ] Dashboard data loads as a single aggregated fetch, not N parallel calls
- [ ] Empty state and loading skeleton have identical spatial footprint (no layout shift)
- [ ] Tooltips are keyboard-accessible (hover alone is not sufficient)

---

## Pair This Skill With

- `design-token-system-architect` — chart colors derived from semantic tokens, not hardcoded
- `accessibility-system-architect` — screen reader equivalents, keyboard tooltip access
- `frontend-product-design-architect` — chart placement, density, and dashboard IA
- `nextjs-performance-architect` — chart component code-splitting, SSR vs client rendering
- `real-time-systems-architect` — live chart updates from SSE / WebSocket feeds

---

## Activation Triggers

- "Build a chart / graph / data visualization"
- "Recharts setup / pattern"
- "D3 custom visualization"
- "Dashboard data architecture"
- "SabiScore match prediction display"
- "TaxBridge VAT trend chart"
- "Accessible chart / screen reader"
- "Color-blind safe chart palette"
- "Responsive chart design"
- "High-volume data chart (canvas)"
- "Chart loading skeleton"
- "Time series chart in Next.js"
