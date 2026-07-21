import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test('super admin can switch roles to DOCTOR and switch back', async ({ page }) => {
  // 1. Login as Super Admin
  await loginAsRole(page, 'SUPER_ADMIN');

  // 2. Navigate to Profile page with roleSwitcher section active
  await page.goto(`${baseURL}/app/platform/account/profile?section=roleSwitcher`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 3. Locate the role switcher select dropdown and choose "DOCTOR"
  const select = page.locator('select').first();
  await expect(select).toBeVisible();
  await select.selectOption('DOCTOR');

  // 4. Switching roles redirects to the role's home workspace. Doctor goes to /app/care/home/index
  await page.waitForURL(/\/app\/care\/home\/index/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/app\/care\/home\/index/);

  // 5. Navigate back to Profile page and reset role view
  await page.goto(`${baseURL}/app/platform/account/profile?section=roleSwitcher`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 6. Click the reset button to return to SUPER_ADMIN view
  const resetButton = page.getByRole('button', { name: /reset/i });
  await expect(resetButton).toBeVisible();
  await resetButton.click();

  // 7. Verify redirection back to the Super Admin's platform home workspace
  await page.waitForURL(/\/app\/platform\/home\/index/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/app\/platform\/home\/index/);
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during role switch tests:', errors);
  }
});
