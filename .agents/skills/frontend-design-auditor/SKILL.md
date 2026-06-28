---
name: frontend-design-auditor
description: >
  Audits and elevates web UI designs and frontend components to production-grade quality using
  Gestalt principles, WCAG AA accessibility standards, design token governance, and micro-interaction
  patterns inspired by Linear, Stripe, and Vercel. Use this skill whenever a user shares a
  screenshot, Figma file, component code, or design description and asks for design feedback,
  UI review, accessibility audit, component polish, or visual hierarchy improvements. Also triggers
  for "make this look better", "audit my UI", "improve the design", "is this accessible",
  "apply design tokens", "why does this feel off", "how would Linear design this", or any request
  to improve the visual or interactive quality of a frontend component or page. Always use this
  skill for design critique and frontend polish — don't improvise without it.
---

# Frontend Design Auditor

Audit any frontend component, page, or design against production-grade standards. Every critique
is specific, actionable, and grounded in a named principle. No vague feedback.

## Audit Dimensions

Run every audit across these six dimensions. Skip none.

### 1. Visual Hierarchy
- Is the most important element visually dominant?
- Does type scale follow a ratio (1.25× or 1.333× recommended)?
- Is whitespace proportional and rhythmic (8px base grid minimum)?
- Are visual groupings clear (Gestalt: proximity, similarity, continuity)?

### 2. Typography
- Font size: body ≥ 16px, labels ≥ 12px, minimum contrast ratio 4.5:1 (WCAG AA)
- Line height: 1.4–1.6× for body, 1.1–1.3× for headings
- Line length: 50–75 characters for prose, shorter for UI labels
- Tracking: neutral for body, slight negative for large headings

### 3. Color & Contrast
- Contrast ratios: body text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1
- Semantic color use: destructive, warning, success, info always distinct
- Dark mode parity: if light mode exists, dark mode must be audited separately
- No color as the sole information carrier (WCAG 1.4.1)

### 4. Spacing & Layout
- Consistent spacing scale (4/8/12/16/24/32/48/64px or equivalent token system)
- Alignment: optical alignment preferred over mathematical for small elements
- Grid: 12-column or 8-column with defined gutters and margins
- Component padding: internal padding consistent per component class

### 5. Accessibility
- Keyboard navigability: all interactive elements reachable via Tab
- Focus rings: visible, high-contrast, not suppressed globally
- ARIA: roles, labels, and live regions correct for dynamic content
- Reduced motion: animations respect `prefers-reduced-motion`
- Touch targets: minimum 44×44px for interactive elements

### 6. Motion & Interaction
- Transitions: 150–300ms for UI feedback, 300–500ms for page transitions
- Easing: ease-out for elements entering, ease-in for elements leaving
- No purely decorative animations (every animation must carry information)
- Loading states, error states, and empty states all designed explicitly

## Protocol

### Step 1 — Intake

Accept any of:
- A screenshot or image of the UI
- Pasted component code (JSX, HTML/CSS, Tailwind)
- A written description of the design
- A Figma URL (describe what you can infer from context)

If code is provided, audit both the visual output (inferred) and the implementation quality.

### Step 2 — Audit Report

Produce a structured report:

```
## Design Audit: [Component/Page Name]

### Critical Issues (fix before shipping)
- [Issue]: [What's wrong] → [Specific fix]

### Improvements (meaningfully elevate quality)
- [Issue]: [What's wrong] → [Specific fix]

### Polish (finishing touches)
- [Issue]: [What's wrong] → [Specific fix]

### What's Working
- [Element]: [Why it works, principle it satisfies]

### Accessibility Score
- WCAG AA compliance: [Pass / Partial / Fail]
- Blockers: [list or "none"]
```

### Step 3 — Corrected Code (if code was provided)

Produce the corrected component with:
- All critical issues resolved
- Design token variables used (not raw hex/px values)
- Inline comments marking every changed line with `// ← [reason]`

### Step 4 — Design Token Recommendations (if no system exists)

If the component uses raw values, propose a minimal token set:
```css
:root {
  /* spacing */
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;

  /* type scale */
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px;
  --text-lg: 18px; --text-xl: 20px; --text-2xl: 24px;

  /* semantic color */
  --color-text-primary: ...; --color-text-secondary: ...;
  --color-surface: ...; --color-border: ...;
  --color-accent: ...; --color-destructive: ...;
}
```

## Quality Reference: Linear Design Principles

When evaluating design quality, apply these benchmarks from Linear's design philosophy:
- Ruthless noise reduction: if removing it loses nothing, remove it
- Optical alignment over mathematical: trust the eye
- Purposeful whitespace: space creates hierarchy, not just padding
- Keyboard velocity: power users should never need a mouse
- Instant responsiveness: no action should feel laggy or unconfirmed

## Quality Gates

Every audit output must satisfy:
- [ ] Critical issues separated from improvements — never mixed
- [ ] Every finding cites the specific Gestalt principle, WCAG criterion, or design rule violated
- [ ] Every fix is a concrete code change or CSS property — never "improve the spacing"
- [ ] Contrast ratios checked with actual numbers, not subjective impression
- [ ] Corrected code uses only design token variables, never raw hex/px values
- [ ] Accessibility score includes specific WCAG criterion IDs (e.g. 1.4.3, 2.4.7)
- [ ] "What's Working" section always present — never only negative findings

## Activation Triggers

- "Audit my UI / design / component"
- "Make this look better / more polished"
- "Is this accessible / WCAG compliant?"
- "Apply design tokens to this component"
- "Why does this feel off visually?"
- "Review this for spacing / typography / contrast issues"
- "How would Linear / Stripe / Vercel design this?"
- "Give me design feedback on [screenshot/code]"

## Skill Chain

**Feeds into**: `component-quality-gate` (design audit findings become the component audit checklist) → `design-token-system-architect` (raw values found during audit become candidates for tokenization).

**Creative combination**: After a frontend audit, pass the corrected component directly to `component-quality-gate` for accessibility and test coverage. Then `motion-interaction-architect` to add the micro-interactions the audit identified as missing. Three skills, one polished component.
