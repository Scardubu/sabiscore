---
name: testing-strategy-architect
description: >
  Designs and implements comprehensive testing strategies for full-stack applications:
  Vitest unit tests, React Testing Library component tests, MSW API mocking, Playwright
  e2e tests, test pyramid design, coverage thresholds, and CI integration. Use this skill
  whenever a user wants to set up testing, write tests, configure Vitest, set up Playwright,
  mock APIs with MSW, add coverage reporting, design a test strategy, or says "set up testing
  for my Next.js app", "configure Vitest", "write unit tests", "e2e tests with Playwright",
  "mock my API calls in tests", "MSW setup", "test coverage setup", "how do I test
  Server Actions", "test my Prisma queries", or "testing pyramid for full-stack".
  Always use this skill for testing architecture — tooling config and MSW v2 setup
  have non-obvious integration points.
---

# Testing Strategy Architect

Design and implement a complete testing strategy across the pyramid. Every layer has
clear ownership, the right tools, and the right coverage targets.

## The Testing Pyramid

```
              ╱╲              E2E (Playwright)
             ╱  ╲             — critical user journeys
            ╱    ╲            — 10–20 tests, slow, high confidence
           ╱──────╲
          ╱        ╲          Integration (Vitest + Testing Library)
         ╱          ╲         — component interactions, API routes
        ╱────────────╲        — 50–200 tests, medium speed
       ╱              ╲
      ╱                ╲      Unit (Vitest)
     ╱                  ╲     — pure functions, utilities, hooks
    ╱────────────────────╲    — 200–1000 tests, fast
```

**Coverage targets:**
- Unit: 90%+ for utilities and business logic
- Component: 80%+ for interactive components
- E2E: critical paths only (auth, checkout, core workflow)

## Protocol

### Step 1 — Vitest Setup (Unit + Component)

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom jest-axe \
  msw @mswjs/data
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path  from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment:  'jsdom',
    globals:      true,       // no need to import describe/it/expect
    setupFiles:   ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines:     80,
        functions: 80,
        branches:  70,
      },
      exclude: [
        '**/node_modules/**', '**/dist/**', '**/.next/**',
        '**/*.stories.*',    '**/*.config.*',
        '**/types/**',       '**/__mocks__/**',
      ],
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'
import { server } from './msw-server'  // MSW server (see Step 2)

expect.extend(toHaveNoViolations)

// Start MSW before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// Reset handlers between tests
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
// Stop MSW after all tests
afterAll(() => server.close())
```

### Step 2 — MSW (Mock Service Worker) v2

```typescript
// src/test/handlers.ts — define API mock handlers
import { http, HttpResponse } from 'msw'

export const handlers = [
  // GET /api/invoices
  http.get('/api/invoices', () => {
    return HttpResponse.json({
      invoices: [
        { id: 'inv_1', amount: 50000, status: 'SENT', currency: 'NGN' },
        { id: 'inv_2', amount: 25000, status: 'PAID', currency: 'NGN' },
      ],
      total: 2,
    })
  }),

  // POST /api/invoices
  http.post('/api/invoices', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(
      { id: 'inv_new', ...body, status: 'DRAFT' },
      { status: 201 }
    )
  }),

  // Simulate error
  http.get('/api/invoices/error', () => {
    return HttpResponse.json({ error: 'Internal server error' }, { status: 500 })
  }),
]
```

```typescript
// src/test/msw-server.ts
import { setupServer } from 'msw/node'
import { handlers }    from './handlers'

export const server = setupServer(...handlers)
```

### Step 3 — Unit Tests (Pure Functions + Hooks)

```typescript
// src/lib/__tests__/tax.test.ts
import { describe, it, expect } from 'vitest'
import { computeVAT, computeWHT } from '@/lib/tax'

describe('computeVAT', () => {
  it('applies 7.5% VAT to NGN amounts', () => {
    expect(computeVAT(100_000, 'NGN')).toBe(7_500)
  })

  it('returns 0 for zero amount', () => {
    expect(computeVAT(0, 'NGN')).toBe(0)
  })

  it('throws for negative amount', () => {
    expect(() => computeVAT(-1, 'NGN')).toThrow('Amount must be positive')
  })
})
```

```typescript
// src/hooks/__tests__/useInvoiceForm.test.ts
import { renderHook, act } from '@testing-library/react'
import { useInvoiceForm }  from '@/hooks/useInvoiceForm'

describe('useInvoiceForm', () => {
  it('initializes with empty fields', () => {
    const { result } = renderHook(() => useInvoiceForm())
    expect(result.current.values.amount).toBe('')
    expect(result.current.errors).toEqual({})
  })

  it('validates required fields on submit', async () => {
    const { result } = renderHook(() => useInvoiceForm())
    await act(async () => { result.current.submit() })
    expect(result.current.errors.amount).toBe('Amount is required')
  })
})
```

### Step 4 — Component Tests (React Testing Library)

```typescript
// src/components/__tests__/InvoiceTable.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { server } from '@/test/msw-server'
import { http, HttpResponse } from 'msw'
import { InvoiceTable } from '@/components/InvoiceTable'

describe('InvoiceTable', () => {
  it('renders invoice list from API', async () => {
    render(<InvoiceTable />)
    // Wait for async data
    const rows = await screen.findAllByRole('row')
    expect(rows).toHaveLength(3)  // 1 header + 2 data rows
  })

  it('shows empty state when no invoices', async () => {
    // Override default handler for this test only
    server.use(
      http.get('/api/invoices', () =>
        HttpResponse.json({ invoices: [], total: 0 })
      )
    )
    render(<InvoiceTable />)
    expect(await screen.findByText(/no invoices/i)).toBeInTheDocument()
  })

  it('shows error state on API failure', async () => {
    server.use(
      http.get('/api/invoices', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    )
    render(<InvoiceTable />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('calls onDelete when delete button clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<InvoiceTable onDelete={onDelete} />)
    await screen.findAllByRole('row')

    await user.click(screen.getAllByRole('button', { name: /delete/i })[0])
    expect(onDelete).toHaveBeenCalledWith('inv_1')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<InvoiceTable />)
    await screen.findAllByRole('row')    // wait for data
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

### Step 5 — Testing Server Actions (Next.js)

```typescript
// src/app/actions/__tests__/createInvoice.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  db: {
    invoice: {
      create: vi.fn().mockResolvedValue({ id: 'inv_new', status: 'DRAFT' }),
    },
  },
}))

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user_1', role: 'MEMBER' } }),
}))

import { createInvoice } from '../createInvoice'
import { db }            from '@/lib/db'

describe('createInvoice Server Action', () => {
  it('creates invoice for authenticated user', async () => {
    const result = await createInvoice({
      vendorName: 'Acme Corp',
      amount: 50000,
      currency: 'NGN',
      dueDate: '2026-12-31T00:00:00Z',
      lineItems: [{ description: 'Service', quantity: 1, unitPrice: 50000 }],
    })

    expect(db.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user_1' }),
      })
    )
    expect(result).toMatchObject({ id: 'inv_new', status: 'DRAFT' })
  })

  it('throws for unauthenticated request', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null)
    await expect(createInvoice({ vendorName: 'X', amount: 1, currency: 'NGN',
      dueDate: '', lineItems: [] })).rejects.toThrow('Unauthorized')
  })
})
```

### Step 6 — Playwright E2E Tests

```bash
pnpm add -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:            './e2e',
  fullyParallel:      true,
  forbidOnly:         !!process.env.CI,
  retries:            process.env.CI ? 2 : 0,
  workers:            process.env.CI ? 1 : undefined,
  reporter:           'html',
  use: {
    baseURL:         'http://localhost:3000',
    trace:           'on-first-retry',
    screenshot:      'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    port:    3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

```typescript
// e2e/auth.spec.ts — critical auth journey
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can sign in and see dashboard', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('Password123!')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByRole('alert')).toContainText(/invalid credentials/i)
  })

  test('redirects unauthenticated users from /dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/sign-in/)
  })
})
```

### Step 7 — CI Integration

```yaml
# .github/workflows/test.yml (add to existing CI)
- name: Unit + Integration Tests
  run: pnpm vitest run --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info

- name: E2E Tests
  run: pnpm playwright test
  env:
    CI: true

- name: Upload Playwright Report
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

## Quality Gates

- [ ] `vitest.config.ts` has coverage thresholds (80% lines, 80% functions)
- [ ] MSW server started in `setupFiles` with `onUnhandledRequest: 'error'`
- [ ] Each component test covers: render, interaction, error state, accessibility
- [ ] Server Actions tested with mocked `db` and `auth`
- [ ] Playwright covers all critical user journeys (auth, core workflow)
- [ ] CI fails if coverage drops below threshold
- [ ] `pnpm test` (unit), `pnpm test:e2e` (Playwright) both defined in `package.json`

## Activation Triggers

- "Set up testing for my Next.js / Node.js app"
- "Configure Vitest for TypeScript"
- "Write tests for my React component"
- "Set up Playwright e2e tests"
- "Mock API calls with MSW"
- "How do I test Server Actions?"
- "Test coverage setup and CI integration"
- "Testing pyramid design for full-stack"

## Skill Chain

**Feeds into**: `git-workflow-architect` (test commands belong in CI — this skill generates the workflow steps) → `backend-systems-auditor` (test coverage gaps surface backend reliability risks).

**Creative combination**: `testing-strategy-architect` + `security-hardening-auditor` + `git-workflow-architect` is the quality pipeline chain. Tests validate security boundaries. CI enforces them on every PR. Three skills that make quality non-negotiable.
