---
name: motion-interaction-architect
description: >
  Designs and implements production-grade motion systems for web using Framer Motion:
  animation tokens, page transitions, gesture interactions, scroll-driven animations,
  layout animations, reduced-motion accessibility, and component choreography. Use this
  skill whenever a user wants to add animations, design a motion system, implement page
  transitions, create micro-interactions, build gesture-driven UI, add scroll animations,
  animate list items, or says "add animations to my React app", "Framer Motion setup",
  "page transitions Next.js", "gesture interaction", "spring animation", "animate on scroll",
  "layout animation", "loading skeleton", "stagger animation", or "reduced motion support".
  Always use this skill for animation work — orchestration, performance, and reduced-motion
  patterns require deliberate design.
---

# Motion & Interaction Architect

Design and implement a coherent motion system for React applications. Every animation
carries semantic meaning. Every interaction confirms user intent. Every motion respects
`prefers-reduced-motion`.

## Motion Philosophy

- **Motion carries information** — every animation must communicate something (state
  change, spatial relationship, hierarchy, causality). Purely decorative motion is waste.
- **Fast UI, slow content** — UI feedback (button press, toggle): 100–200ms.
  Content transitions (page change, modal open): 250–400ms. Never longer.
- **Reduced motion is a first-class target** — every animation has a no-motion fallback.
- **Spring > tween** — springs feel physical and alive. Use tweens only for linear progress.

## Motion Token System

```typescript
// lib/motion.ts — motion design tokens
export const MOTION = {
  duration: {
    instant:  0.08,   // 80ms  — cursor hover, button press
    fast:     0.15,   // 150ms — toggle, chip select
    normal:   0.25,   // 250ms — modal open, card expand
    slow:     0.40,   // 400ms — page transition, drawer open
    entrance: 0.35,   // 350ms — first load, hero reveal
  },
  spring: {
    snappy:  { type: 'spring', stiffness: 500, damping: 40 },   // button press
    bouncy:  { type: 'spring', stiffness: 300, damping: 20 },   // card flip
    gentle:  { type: 'spring', stiffness: 200, damping: 30 },   // modal open
    stiff:   { type: 'spring', stiffness: 700, damping: 50 },   // layout shift
  },
  ease: {
    out:    [0.0, 0.0, 0.2, 1.0],   // elements entering
    in:     [0.4, 0.0, 1.0, 1.0],   // elements leaving
    inout:  [0.4, 0.0, 0.2, 1.0],   // repositioning
    spring: [0.34, 1.56, 0.64, 1.0], // overshoots slightly
  },
} as const
```

## Protocol

### Step 1 — Classify the Animation Need

| Need | Pattern | Framer API |
|---|---|---|
| Button/card press feedback | Scale + shadow | `whileTap`, `whileHover` |
| Modal / dialog open | Fade + scale from center | `AnimatePresence` + `initial/animate/exit` |
| Page transition | Slide or fade | `AnimatePresence` in layout |
| List item appear | Stagger from top | `variants` with `staggerChildren` |
| Scroll-driven parallax | Transform on scroll | `useScroll` + `useTransform` |
| Loading skeleton | Shimmer | CSS `@keyframes` + `animate-pulse` |
| Drag-to-dismiss | Gesture with velocity | `drag`, `dragConstraints`, `onDragEnd` |
| Number counter | Animated number | `useSpring` + `useTransform` |

### Step 2 — Setup

```bash
pnpm add framer-motion
```

```tsx
// lib/motion-provider.tsx — wrap app with LazyMotion for smaller bundle
import { LazyMotion, domAnimation } from 'framer-motion'

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
// Note: with LazyMotion, use `m.div` not `motion.div`
```

### Step 3 — Core Animation Patterns

**Hover + press micro-interactions:**
```tsx
import { m } from 'framer-motion'
import { MOTION } from '@/lib/motion'

export function AnimatedButton({ children, onClick }: ButtonProps) {
  return (
    <m.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={MOTION.spring.snappy}
      onClick={onClick}
    >
      {children}
    </m.button>
  )
}
```

**Modal open/close with AnimatePresence:**
```tsx
import { AnimatePresence, m } from 'framer-motion'

export function Modal({ isOpen, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            className="fixed inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.duration.fast }}
            onClick={onClose}
          />
          {/* Panel */}
          <m.div
            className="fixed inset-x-4 top-[10%] mx-auto max-w-lg rounded-2xl bg-surface-base p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 8 }}
            transition={MOTION.spring.gentle}
          >
            {children}
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

**Staggered list entrance:**
```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,    // 60ms between each child
      delayChildren:   0.1,     // 100ms before first child
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: MOTION.spring.gentle },
}

export function AnimatedList({ items }: { items: Item[] }) {
  return (
    <m.ul variants={containerVariants} initial="hidden" animate="show">
      {items.map((item) => (
        <m.li key={item.id} variants={itemVariants} layout>
          <ListItem item={item} />
        </m.li>
      ))}
    </m.ul>
  )
}
```

**Scroll-driven animation:**
```tsx
import { useScroll, useTransform, m } from 'framer-motion'
import { useRef } from 'react'

export function ParallaxHero() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const y      = useTransform(scrollYProgress, [0, 1], ['0%',   '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <div ref={ref} className="relative h-screen overflow-hidden">
      <m.div style={{ y, opacity }} className="absolute inset-0">
        <HeroImage />
      </m.div>
      <m.div style={{ opacity }} className="relative z-10 flex items-center justify-center h-full">
        <HeroContent />
      </m.div>
    </div>
  )
}
```

**Number counter:**
```tsx
import { useSpring, useTransform, m } from 'framer-motion'
import { useEffect } from 'react'

export function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString())

  useEffect(() => { spring.set(value) }, [value, spring])

  return <m.span>{display}</m.span>
}
```

**Drag-to-dismiss:**
```tsx
export function DraggableCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <m.div
      drag="x"
      dragConstraints={{ left: -100, right: 100 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 400) {
          onDismiss()
        }
      }}
      whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
    >
      <Card />
    </m.div>
  )
}
```

### Step 4 — Page Transitions (Next.js App Router)

```tsx
// components/page-transition.tsx
'use client'
import { AnimatePresence, m } from 'framer-motion'
import { usePathname } from 'next/navigation'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: MOTION.duration.normal, ease: MOTION.ease.out } },
  exit:    { opacity: 0, y: -8, transition: { duration: MOTION.duration.fast, ease: MOTION.ease.in } },
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="wait">
      <m.div key={pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        {children}
      </m.div>
    </AnimatePresence>
  )
}

// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MotionProvider>
          <PageTransition>{children}</PageTransition>
        </MotionProvider>
      </body>
    </html>
  )
}
```

### Step 5 — Reduced Motion (Non-Negotiable)

```tsx
// hooks/useReducedMotion.ts
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

// Every animated component should respect this
export function useMotionSafe() {
  const prefersReduced = useFramerReducedMotion()
  return {
    shouldAnimate: !prefersReduced,
    // Return instant/no-op transitions when reduced motion is preferred
    spring: prefersReduced ? { duration: 0 } : MOTION.spring.gentle,
    fade:   prefersReduced ? { duration: 0 } : { duration: MOTION.duration.normal },
  }
}

// Usage in component
export function SafeModal({ isOpen, children }: ModalProps) {
  const { spring, fade } = useMotionSafe()
  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{    opacity: 0, scale: 0.96 }}
          transition={spring}   // ← instant when reduced motion preferred
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}
```

## Quality Gates

- [ ] All animations use `useReducedMotion()` — zero animations play when preference is set
- [ ] No animation exceeds 400ms (interaction feedback < 200ms)
- [ ] `AnimatePresence` wraps every conditionally rendered animated component
- [ ] List animations use `layout` prop on `m.li` to prevent jump cuts on reorder/remove
- [ ] Page transitions use `mode="wait"` (exit before enter, not overlapping)
- [ ] Bundle uses `LazyMotion` with `domAnimation` features (not full `framer-motion` import)
- [ ] Scroll animations use `useScroll` + `useTransform` (not JS scroll listeners)

## Activation Triggers

- "Add animations to my React / Next.js app"
- "Set up Framer Motion"
- "Page transitions in Next.js App Router"
- "Stagger animation for list items"
- "Modal open/close animation"
- "Scroll-driven animations"
- "Reduced motion support"
- "Micro-interactions / hover / press animations"

## Skill Chain

**Feeds into**: `component-quality-gate` (animated components need accessibility audit — reduced-motion, focus management during transitions) → `react-native-expo-architect` (Reanimated v4 mirrors the Framer Motion patterns with worklet equivalents).

**Creative combination**: Design a Framer Motion system for the web app with `motion-interaction-architect`, then port the animation tokens and spring values to Reanimated v4 with `react-native-expo-architect`. Shared motion identity across platforms.
