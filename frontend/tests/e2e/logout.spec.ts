import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test('should log out successfully and redirect to login page', async ({ page }) => {
  // 1. Log in
  await loginAsRole(page, 'SUPER_ADMIN');

  // 2. Click the Sign Out button in the sidebar
  const logoutButton = page.getByRole('button', { name: /sign out/i }).first();
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  // 3. Verify redirection to /login
  await page.waitForURL(/\/login/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/login/);
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during logout tests:', errors);
  }
});
