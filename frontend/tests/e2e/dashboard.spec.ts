import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

const DASHBOARDS = [
  '/app/platform/home/index',
  '/app/care/home/index',
  '/app/operations/home/index',
  '/app/people/home/index',
  '/app/governance/home/index',
  '/app/innovation/home/index',
];

test('should exercise all cards, buttons, and actions on dashboards', async ({ page }) => {
  // Login as Super Admin so we have access to all workspaces
  await loginAsRole(page, 'SUPER_ADMIN');

  for (const route of DASHBOARDS) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify page is loaded
    await expect(page).toHaveURL(new RegExp(route));

    // Find interactive cards, buttons, quick actions
    const clickables = page.locator('button, [role="button"], .dashboard-card, .quick-action-btn, .metric-card');
    const count = await clickables.count();

    // Click up to 15 key elements to avoid infinite navigation loops or test timeouts
    const maxClicks = Math.min(count, 15);
    for (let i = 0; i < maxClicks; i++) {
      try {
        const element = clickables.nth(i);
        if (await element.isVisible() && await element.isEnabled()) {
          const text = await element.innerText();
          // Skip logout or destructive buttons to keep the session alive
          if (/log out|logout|delete|remove|suspend|archive/i.test(text)) {
            continue;
          }
          await element.click();
          await page.waitForTimeout(500);

          // If a modal popped up, close it
          const closeButton = page.locator('button[aria-label*="close" i], button:has-text("Close"), .modal-close').first();
          if (await closeButton.count() > 0 && await closeButton.isVisible()) {
            await closeButton.click();
            await page.waitForTimeout(300);
          }

          // If navigation happened, go back
          if (!page.url().includes(route)) {
            await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
          }
        }
      } catch (clickErr) {
        // Log individual element interaction failure, but continue the crawl
        console.warn(`Click failed for index ${i} on dashboard ${route}:`, clickErr.message);
      }
    }
  }
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during dashboard tests:', errors);
  }
});
