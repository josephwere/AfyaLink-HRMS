import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, getAuthHeader, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('AfyaLink Permission and Auth Access Control tests', () => {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

  test('Nurse should be blocked from Super Admin System Settings', async ({ page }) => {
    // 1. Login as Nurse
    await loginAsRole(page, 'NURSE');

    // 2. Attempt to navigate directly to Super Admin System Settings
    await page.goto(`${baseURL}/app/platform/settings/system`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1500);

    // 3. Verify they are redirected or blocked instead of reaching the system settings page.
    const currentURL = page.url();
    const bodyText = await page.innerText('body');
    const isBlocked = currentURL.includes('/unauthorized') || bodyText.includes('Unauthorized') || bodyText.includes('Access Denied');
    const isRedirectedAway = currentURL.includes('/app/') && !currentURL.includes('/app/platform/settings/system');
    expect(isBlocked || isRedirectedAway).toBe(true);
  });

  test('Super Admin should be allowed access to System Settings', async ({ page }) => {
    // 1. Login as Super Admin
    await loginAsRole(page, 'SUPER_ADMIN');

    // 2. Navigate to System Settings
    await page.goto(`${baseURL}/app/platform/settings/system`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1500);

    // 3. Verify they have access
    const currentURL = page.url();
    expect(currentURL).toContain('/app/platform/settings/system');
    const heading = page.locator('h2, h3').first();
    await expect(heading).toBeVisible();
  });

  test('Nurse token should fail to access super admin APIs (Privilege Escalation block)', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    // 1. Get Nurse authorization header
    const headers = await getAuthHeader(context, 'NURSE');

    // 2. Attempt to query system settings or rotate secrets
    const res = await context.get(`${apiURL}/api/system-settings`, { headers });
    
    // 3. Assert access is forbidden (403) or unauthorized (401)
    const status = res.status();
    expect([401, 403]).toContain(status);
  });
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during permission tests:', errors);
  }
});
