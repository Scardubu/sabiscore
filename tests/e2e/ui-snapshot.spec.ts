import { test, expect } from '@playwright/test';

const BASE = process.env.DEPLOY_URL ?? 'https://sabiscore.vercel.app';

test.describe('SabiScore UI snapshots', () => {
  test('homepage renders and capture full-page screenshot', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'test-results/playwright/homepage.png', fullPage: true });
  });

  test('health endpoint reachable via frontend proxy', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/v1/health`);
    expect(resp.status()).toBeGreaterThanOrEqual(200);
    expect(resp.status()).toBeLessThan(300);
    const json = await resp.json();
    expect(json).toHaveProperty('status');
  });
});
