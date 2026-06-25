---
name: motion-performance-architect
description: >
  Defines motion strategy, performance budgets, compositor rules, and anti-pattern detection
  for animation-heavy frontends. Use this skill BEFORE writing any animation code to establish
  the motion contract: which properties to animate, what frame budgets are acceptable, how to
  measure jank, and what reduced-motion equivalents look like at the system level. Triggers:
  "set up the motion strategy", "my animations are janky", "layout thrash", "animation
  performance audit", "60fps animations", "motion budget", "compositor-only animations",
  "profile my animation", "why is my page jank". Always use this skill before
  motion-interaction-architect — strategy sets the constraints; implementation follows.
---

# Motion Performance Architect

Define and enforce the motion contract before a single animation is written. Motion that
feels premium is motion that is fast, intentional, and invisible in its cost.

> **Role split with `motion-interaction-architect`:**
> This skill handles **strategy, measurement, and constraint-setting**.
> `motion-interaction-architect` handles **implementation, APIs, and code patterns**.
> Run this skill first; hand off constraints to implementation.

---

## Core Principles

- Animate only compositor-promoted properties: `transform`, `opacity`, `filter`.
- Never animate `width`, `height`, `top`, `left`, `margin`, `padding` — they cause layout.
- Keep motion off the main thread wherever the platform allows.
- Performance budget is non-negotiable: 60fps on mid-range mobile.
- Reduced motion is a contract, not an afterthought — design the no-motion path first.
- Measure before optimizing; never guess where jank lives.

---

## Step 1 — Classify Motion by Intent

Before any implementation decision, classify every animation:

| Intent | Definition | Budget |
|---|---|---|
| **Feedback** | Confirms user action (button press, toggle, select) | ≤ 100ms |
| **Transition** | Moves the user between states or surfaces | 200–350ms |
| **Reveal** | Introduces new content into the page | 250–400ms |
| **Decoration** | Visual interest with no informational purpose | Eliminate or gate behind `prefers-reduced-motion: no-preference` |
| **Loading** | Communicates wait time and system activity | Duration-matched to actual wait |

**Budget rule**: If the animation exceeds its budget category, it is too slow. Cut it.

---

## Step 2 — Property Selection Rules

### Compositor-Safe (always prefer)
```
transform: translate(), scale(), rotate(), skew()
opacity: 0–1
filter: blur(), brightness() — GPU-composited in modern browsers
```

### Layout-Triggering (never animate in production)
```
width, height, min-height, max-height
top, right, bottom, left (use transform: translate() instead)
margin, padding
border-width
font-size
```

### Reflow Risk Table
```
Property         | Layout | Paint | Composite
-----------------|--------|-------|----------
transform        |  No    |  No   |  Yes ✅
opacity          |  No    |  No   |  Yes ✅
filter           |  No    | Yes*  |  Yes ✅ (*often GPU)
background-color |  No    |  Yes  |  No  ⚠️
width/height     |  Yes   |  Yes  |  No  ❌
top/left         |  Yes   |  Yes  |  No  ❌
```

---

## Step 3 — Performance Measurement Protocol

### In-Browser Profiling
```javascript
// Detect long animation frames (LoAF API — Chrome 123+)
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16.67) {  // > 1 frame at 60fps
      console.warn('[Motion] Long frame detected:', {
        duration: `${entry.duration.toFixed(1)}ms`,
        script:   entry.scripts?.map(s => s.name),
        route:    window.location.pathname,
      })
    }
  }
})
observer.observe({ type: 'long-animation-frame', buffered: true })
```

### FPS Monitor (development only)
```typescript
// lib/fps-monitor.ts
export function startFpsMonitor() {
  if (process.env.NODE_ENV !== 'development') return

  let frames = 0
  let lastTime = performance.now()

  function tick(now: number) {
    frames++
    if (now - lastTime >= 1000) {
      const fps = Math.round((frames * 1000) / (now - lastTime))
      if (fps < 55) {
        console.warn(`[Motion] FPS dropped to ${fps}fps — check compositor properties`)
      }
      frames = 0
      lastTime = now
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
```

### Chrome DevTools Protocol (CI integration)
```bash
# Capture animation frame data during Playwright test
page.on('metrics', metrics => {
  const fps = metrics['Frames'] / (metrics['Timestamp'] / 1000)
  expect(fps).toBeGreaterThan(55)  // fail if animations drop below 55fps
})
```

---

## Step 4 — will-change Discipline

`will-change` promotes elements to GPU layers — powerful but expensive.

```css
/* ✅ Only during animation, removed immediately after */
.animating {
  will-change: transform;
}

/* ❌ Never globally — causes memory bloat */
* { will-change: transform; }

/* ✅ Correct pattern: apply via JS only for active animation */
element.addEventListener('animationstart', () => {
  element.style.willChange = 'transform'
})
element.addEventListener('animationend', () => {
  element.style.willChange = 'auto'  // release the layer
})
```

---

## Step 5 — Reduced Motion System Contract

This is the motion architect's primary output: the contract document that `motion-interaction-architect`
must implement.

```typescript
// Motion Contract — exported from lib/motion-contract.ts
// motion-interaction-architect implements against this

export const MotionContract = {
  // Duration budget per motion intent (in seconds)
  budget: {
    feedback:   0.10,
    transition: 0.25,
    reveal:     0.35,
    loading:    'match-wait-time',
  },

  // Permitted animated properties
  compositorOnly: ['transform', 'opacity', 'filter'] as const,

  // Never animate these
  forbidden: ['width', 'height', 'top', 'left', 'margin', 'padding'] as const,

  // Reduced motion contract
  reducedMotion: {
    // All spatial transforms → opacity fade only
    spatial:    { opacity: [0, 1] },
    // Duration collapses to near-zero — state still communicates
    duration:   0.001,
    // Stagger → simultaneous
    stagger:    0,
  },
} as const
```

---

## Step 6 — Anti-Pattern Audit

Run this checklist against any animation-heavy PR:

| Anti-Pattern | Signal | Fix |
|---|---|---|
| Layout animation | Animating `height`, `width`, `top` | Use `transform: scaleY()` or CSS `@starting-style` |
| Forced synchronous layout | Reading `offsetWidth` inside animation loop | Batch reads outside rAF |
| Unbounded scroll listeners | Scroll → JS → DOM write without debounce | Use `useScroll` from Framer Motion |
| Over-promoted layers | `will-change: transform` on all cards | Apply only during active animation |
| Missing `contain` | Large animated element forces full-page reflow | Add `contain: layout paint` |
| Stagger that never ends | Stagger on 100+ items = 10s entrance | Cap stagger at 8–10 items; batch the rest |
| Transform-origin surprise | Scale animation jumps to wrong position | Set explicit `transform-origin` |
| Hydration animation flash | Server renders static; client mounts and immediately animates | Guard animation with `useEffect` / `isClient` |

---

## Step 7 — Route-Level Motion Budget

Define the motion budget before implementing any page transition:

| Route Type | Max transition duration | Permitted properties |
|---|---|---|
| Page navigation | 250ms | opacity, transform (Y axis only) |
| Modal / drawer open | 300ms | opacity, transform (scale + Y) |
| Panel slide | 250ms | transform (X axis) |
| Toast / notification | 200ms enter, 150ms exit | opacity, transform (Y) |
| Skeleton → content | 0ms (no transition — instant swap) | — |
| Data table row add/remove | 250ms | opacity, transform (Y), layout (Framer) |

---

## Quality Gates

- [ ] No layout-triggering property is animated in any hot path
- [ ] `will-change` is applied per-animation, not globally
- [ ] All durations respect the intent budget table
- [ ] Long Animation Frame (LoAF) observer confirms no frames > 50ms
- [ ] Reduced motion renders correctly with `duration: 0.001` — no broken states
- [ ] Staggered lists cap at 8–10 items before batching
- [ ] All animation decisions are documented in the motion contract

---

## Pair This Skill With

- `motion-interaction-architect` — always: this skill sets constraints; that skill implements them
- `nextjs-performance-architect` — route transitions interact with RSC render timing
- `accessibility-system-architect` — reduced motion is an accessibility requirement, not a preference
- `component-quality-gate` — animated components must pass the performance and a11y gate

---

## Activation Triggers

- "My animations are janky / slow / causing layout shift"
- "Set up the motion strategy / motion budget"
- "Animation performance audit"
- "How do I animate without causing reflow?"
- "Profile my Framer Motion animations"
- "60fps animations on mobile"
- "Compositor-only property guidance"
- "Reduced motion system design"
- "will-change optimization"
- "Route transition performance"
