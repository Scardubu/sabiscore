---
name: accessibility-system-architect
description: >
  Designs accessibility as a system rather than a final audit. Use this skill when building
  or reviewing navigation, forms, dialogs, menus, tables, charts, focus management, screen
  reader flows, reduced-motion behavior, localization-sensitive UI, or any component that
  should meet WCAG 2.2 AA expectations by construction. Also use when adding ARIA patterns
  to custom widgets, implementing keyboard-trapped modals, auditing color contrast, or
  writing accessible chart descriptions. Triggers: "make this accessible", "keyboard navigation",
  "screen reader", "ARIA pattern", "WCAG", "focus management", "is this accessible", "add
  aria-label", "reduced motion". Always load this skill for any public-facing UI — accessibility
  is not a patch, it is architecture.
---

# Accessibility System Architect

Build accessibility into the architecture, component API, and interaction model from the start.
The best accessible interface is the one that never needs a rescue patch.

## Non-Negotiables

- Use semantic HTML first. ARIA supplements semantics; it never replaces them.
- Keyboard parity: every mouse interaction has a keyboard equivalent.
- Visible, high-contrast focus indicator — never suppress `outline` without replacing it.
- Programmatic name, role, and state for every interactive control.
- Never rely on color alone to communicate meaning.
- Respect `prefers-reduced-motion` — always.
- Touch targets ≥ 44×44px (WCAG 2.5.8 is 24×24 minimum; 44×44 is the practical floor).
- Errors are recoverable, not merely visible.

---

## Protocol

### Step 1 — Map the Keyboard Journey
Before touching ARIA, walk the page using only Tab, Shift+Tab, Enter, Space, Escape, and Arrow keys.

Verify:
- [ ] Focus order matches visual and reading order
- [ ] No focus traps outside intentional dialogs
- [ ] Skip-nav link present and functional
- [ ] Every interactive element is reachable
- [ ] Focus never disappears into a void (dialog close → focus returns to trigger)

### Step 2 — Semantic Structure Audit
```tsx
// ✅ Document landmarks — one per role
<header role="banner">           {/* site header */}
<nav aria-label="Main">          {/* primary navigation */}
<main>                            {/* page content */}
<aside aria-label="Filters">     {/* complementary content */}
<footer role="contentinfo">      {/* site footer */}

// ✅ Heading hierarchy — never skip levels
<h1>Page title</h1>              {/* exactly one per page */}
  <h2>Section</h2>
    <h3>Subsection</h3>

// ❌ Never: <div role="heading" aria-level="1"> when <h1> works
// ❌ Never: <h3> immediately after <h1> — skip creates a broken outline
```

### Step 3 — Component Patterns

**Buttons and Links:**
```tsx
// Actions → <button>. Navigation → <a>. Never a <div> for either.
<button
  type="button"                    // explicit type — never assume "submit"
  aria-label="Delete invoice #1042"  // icon-only: always aria-label
  onClick={handleDelete}
>
  <TrashIcon aria-hidden="true" />  // hide decorative icons from screen readers
</button>

// Loading state
<button aria-disabled={isLoading} aria-busy={isLoading} onClick={handleSubmit}>
  {isLoading ? 'Submitting…' : 'Submit Return'}
</button>
// Note: aria-disabled keeps the element focusable; HTML disabled removes it from tab order
```

**Modal / Dialog — focus trap:**
```tsx
'use client'
import { useEffect, useRef } from 'react'

// Focus trap: lock focus inside dialog while open, return on close
function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Trap focus inside the dialog
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable?.[0]
    const last  = focusable?.[focusable.length - 1]

    first?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()  // return focus to trigger on close
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 rounded-xl bg-white p-6 shadow-xl max-w-lg w-full"
      >
        <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
        {children}
        <button
          type="button"
          className="absolute top-4 right-4"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
```

**Disclosure / Accordion:**
```tsx
function Accordion({ items }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          <button
            type="button"
            id={`trigger-${item.id}`}
            aria-expanded={openId === item.id}
            aria-controls={`panel-${item.id}`}
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
            className="w-full text-left py-4 flex justify-between items-center"
          >
            {item.title}
            <ChevronIcon
              aria-hidden="true"
              className={`transition-transform ${openId === item.id ? 'rotate-180' : ''}`}
            />
          </button>
          <div
            id={`panel-${item.id}`}
            role="region"
            aria-labelledby={`trigger-${item.id}`}
            hidden={openId !== item.id}
            className="pb-4"
          >
            {item.content}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Combobox / Search:**
```tsx
function SearchCombobox({ options, onSelect }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [value, setValue] = useState('')

  const filtered = options.filter(o => o.label.toLowerCase().includes(value.toLowerCase()))

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { setActiveIndex(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIndex >= 0) { onSelect(filtered[activeIndex]); setOpen(false) }
    if (e.key === 'Escape') { setOpen(false) }
  }

  const listboxId = useId()

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `option-${filtered[activeIndex]?.id}` : undefined}
        value={value}
        onChange={e => { setValue(e.target.value); setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder="Search…"
        className="w-full rounded-lg border px-3 py-2"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg"
        >
          {filtered.map((option, i) => (
            <li
              key={option.id}
              id={`option-${option.id}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => { onSelect(option); setOpen(false) }}
              className={`px-3 py-2 cursor-default ${i === activeIndex ? 'bg-accent/10' : ''}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Data Tables:**
```tsx
<table aria-label="Invoice history for Q2 2026">
  <caption className="sr-only">Invoice history sorted by date, newest first</caption>
  <thead>
    <tr>
      <th scope="col" aria-sort="descending">Date</th>  {/* aria-sort when sortable */}
      <th scope="col">Vendor</th>
      <th scope="col">Amount (₦)</th>
      <th scope="col">Status</th>
      <th scope="col"><span className="sr-only">Actions</span></th>  {/* hide "Actions" from flow but announce to SR */}
    </tr>
  </thead>
  <tbody>
    {invoices.map(inv => (
      <tr key={inv.id}>
        <td>{inv.date}</td>
        <td>{inv.vendor}</td>
        <td aria-label={`${formatCurrency(inv.amount)} Naira`}>{formatCurrency(inv.amount)}</td>
        <td>
          {/* Status: badge + screen reader text */}
          <span aria-label={`Status: ${inv.status}`} className={statusClass(inv.status)}>
            {inv.status}
          </span>
        </td>
        <td>
          <button aria-label={`View invoice from ${inv.vendor} on ${inv.date}`}>
            View
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Focus Indicator (non-negotiable CSS):**
```css
/* globals.css — never suppress outline without this replacement */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove default only for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Skip Navigation Link:**
```tsx
// Must be the very first focusable element in the DOM
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[100]
                 bg-white px-4 py-2 rounded-lg shadow-lg font-medium focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-accent"
    >
      Skip to main content
    </a>
  )
}

// In layout.tsx
<SkipNav />
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

**Live Regions (toasts, alerts, dynamic updates):**
```tsx
// Polite: announces when user is idle (non-critical updates)
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>

// Assertive: interrupts immediately (errors, warnings)
<div aria-live="assertive" role="alert" aria-atomic="true" className="sr-only">
  {errorMessage}
</div>

// Never: aria-live="assertive" for routine notifications (it's jarring)
```

### Step 4 — Color and Contrast
- Text on background: minimum 4.5:1 ratio (WCAG AA)
- Large text (18pt+ / 14pt+ bold): minimum 3:1 ratio
- UI components and focus indicators: minimum 3:1 ratio against adjacent colors
- Never convey meaning through color alone — always add icon, label, or pattern

```tsx
// ✅ Status uses color AND icon AND text
<Badge className="bg-success/10 text-success">
  <CheckIcon aria-hidden="true" />
  <span>Filed</span>
</Badge>

// ❌ Color-only status
<div className="bg-green-500 w-3 h-3 rounded-full" />
```

### Step 5 — Reduced Motion
```tsx
// hooks/useReducedMotion.ts
import { useReducedMotion } from 'framer-motion'

export function useMotionPreference() {
  const prefersReduced = useReducedMotion()
  return { shouldAnimate: !prefersReduced }
}

// In every animated component
const { shouldAnimate } = useMotionPreference()
<m.div
  initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
  animate={{ opacity: 1, y: 0 }}
  transition={shouldAnimate ? { duration: 0.25 } : { duration: 0 }}
/>
```

```css
/* Also enforce at CSS level as defense-in-depth */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Testing Protocol

### Automated (CI gate)
```bash
# axe-core via @axe-core/react
pnpm add -D @axe-core/react

# In dev: axe runs automatically
if (process.env.NODE_ENV === 'development') {
  const axe = await import('@axe-core/react')
  const React = await import('react')
  const ReactDOM = await import('react-dom')
  axe.default(React, ReactDOM, 1000)
}
```

### Manual Checklist (before every PR)
- [ ] Tab through the entire feature without a mouse
- [ ] Use VoiceOver (macOS) or NVDA (Windows) on every new route
- [ ] Zoom to 200% — layout must not break
- [ ] Enable forced colors mode (Windows High Contrast) — all meaning must survive
- [ ] Test with reduced motion enabled — all state changes still communicate

---

## Quality Gates

- WCAG 2.2 AA is the default bar, not an aspirational extra.
- Focus order matches visual and logical reading order.
- Error messages explain how to fix the issue (not just "Invalid input").
- Interactive targets remain usable on touch and keyboard.
- Screen readers announce the right thing at the right time.
- Motion can be reduced without breaking the interface.
- No heading level is skipped.
- No icon-only interactive element lacks an accessible name.

---

## Pair This Skill With

- `frontend-product-design-architect` — layout and hierarchy decisions affect accessibility
- `design-token-system-architect` — encode contrast ratios and focus tokens into the design system
- `component-quality-gate` — verify a11y as part of component production readiness
- `motion-interaction-architect` — every animation must have a reduced-motion equivalent

---

## Activation Triggers

- "Make this accessible / WCAG compliant"
- "Add keyboard navigation"
- "Screen reader support"
- "Focus management for modal / dialog"
- "ARIA pattern for [widget]"
- "Is this accessible?"
- "Add skip navigation"
- "Reduced motion support"
- "Color contrast audit"
- "Accessible data table / chart"
