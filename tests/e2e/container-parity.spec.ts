import { test, expect } from '@playwright/test';

// Fitness function for the container-parity defect class documented
// repeatedly in CLAUDE.md (vΩ.14, vΩ.20, vΩ.25, vΩ.31 on the match/loading
// route alone, plus homepage/docs/admin/team-page instances fixed alongside
// this test): a page-level wrapper re-declaring min-h-screen, its own
// horizontal padding, or a second <main> landmark inside the root shell
// (app/layout.tsx supplies px-4 py-5 sm:px-6 lg:px-8 and the sole <main>
// landmark for every route). Runs under both Playwright projects (chromium
// desktop + mobile-chrome), backend-independent by design — every route below
// renders its shell via Suspense/skeleton fallbacks before any fetch settles,
// so this doesn't require a live FastAPI backend.
//
// If this test fails, the fix is almost always to delete the offending
// page-level min-h-screen/background/padding — not to touch the assertion.
const ROUTES = ['/', '/docs', '/performance', '/monitoring', '/match', '/intelligence'];

test.describe('container parity — no page re-wraps the root shell', () => {
  for (const route of ROUTES) {
    test(`${route} has exactly one <main> landmark and no horizontal overflow`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('main')).toHaveCount(1);

      // expect.poll, not a one-shot evaluate: under parallel test workers a
      // transient mid-hydration paint can momentarily read wider than the
      // viewport (observed empirically — passes 100% single-worker, flaked
      // under concurrency). Polling gives a real reflow a chance to settle
      // before failing, the same tolerance toHaveCount already gets above.
      await expect
        .poll(() =>
          page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          })).then(({ scrollWidth, clientWidth }) => scrollWidth - clientWidth)
        )
        // 1px tolerance for scrollbar/subpixel rounding across browsers.
        .toBeLessThanOrEqual(1);
    });
  }
});
