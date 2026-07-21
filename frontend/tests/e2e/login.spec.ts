import { test, expect } from '@playwright/test';
import { loginAsRole, ROLE_CREDENTIALS, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

for (const role of Object.keys(ROLE_CREDENTIALS)) {
  test(`should successfully login as ${role}`, async ({ page }) => {
    await loginAsRole(page, role);
    await expect(page).toHaveURL(/\/app\//);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
}

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during login tests:', errors);
  }
});
