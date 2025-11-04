import { test, expect } from '@playwright/test';

const BACKEND_HEALTH_URL = 'http://127.0.0.1:8000/api/v1/health';

async function assertBackendHealthy(request: typeof test.expect.extend.arguments[0]['request']) {
  const response = await request.get(BACKEND_HEALTH_URL);
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  expect(json).toMatchObject({ status: 'healthy' });
}

test.describe('SabiScore End-to-End', () => {
  test('loads match selector when backend is healthy', async ({ page, request }) => {
    await assertBackendHealthy(request);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Select a Match to Analyze' })).toBeVisible();
    await expect(page.getByLabel('Home Team')).toBeVisible();
    await expect(page.getByLabel('Away Team')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze Match/i })).toBeEnabled();
  });

  test('shows offline banner when backend unavailable', async ({ page }) => {
    await page.route('**/api/v1/health', (route) => route.abort());

    await page.goto('/');

    await expect(page.getByText('Connection Error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
