import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test('should log out successfully and redirect to login page', async ({ page }) => {
  // 1. Log in
  await loginAsRole(page, 'SUPER_ADMIN');

  // 2. Open the sidebar if it is collapsible, then click the Sign Out button.
  const menuToggle = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i], button[aria-label*="sidebar" i], .sidebar-toggle').first();
  if (await menuToggle.count() && await menuToggle.isVisible().catch(() => false)) {
    await menuToggle.click();
    await page.waitForTimeout(250);
  }

  const logoutButton = page.locator('button.sidebar-action-btn.sidebar-action-logout, button:has-text("Log out")').first();
  await expect(logoutButton).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => {
    const button = document.querySelector('button.sidebar-action-btn.sidebar-action-logout');
    if (button instanceof HTMLElement) {
      button.click();
    }
  });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  // 3. Verify redirection to /login
  await page.waitForURL(/\/login/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/login/);
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during logout tests:', errors);
  }
});
