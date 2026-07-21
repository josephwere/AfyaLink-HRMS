import { test, expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const email = process.env.E2E_EMAIL || 'josephogwe8@gmail.com';
const password = process.env.E2E_PASSWORD || 'Josboy@254';

test('super-admin login reaches the platform workspace', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console:${msg.text()}`);
    }
  });

  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  await page.getByLabel(/email, phone or national id/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/app\//, { timeout: 30000 });
  await expect(page).toHaveURL(new RegExp('/app/'));

  const heading = page.locator('h1, h2').first();
  await expect(heading).toBeVisible({ timeout: 15000 });

  await page.goto(`${baseURL}/app/platform/home/index`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText(/super admin|platform/i, { timeout: 20000 });

  expect(errors).toEqual([]);
});
