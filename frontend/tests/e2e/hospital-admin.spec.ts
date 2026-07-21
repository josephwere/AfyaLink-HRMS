import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, getAuthHeader, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Hospital Admin configuration workflows', () => {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

  test('should load facility customization page and update config via API', async ({ page, playwright }) => {
    // 1. Log in as Hospital Admin
    await loginAsRole(page, 'HOSPITAL_ADMIN');

    // 2. Open Customization page in UI
    await page.goto(`${baseURL}/app/platform/facility/customization`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const currentURL = page.url();
    expect(currentURL).toContain('/app/platform/facility/customization');

    // 3. Perform backend config updates using API
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'HOSPITAL_ADMIN');

    // Fetch config
    const configRes = await context.get(`${apiURL}/api/hospital-admin/config`, { headers });
    expect(configRes.status()).toBe(200);

    // Update customization options
    const updateCustomRes = await context.put(`${apiURL}/api/hospital-admin/customization`, {
      headers,
      data: {
        branding: {
          themeColor: '#0c4a6e',
          logo: '/logo.png',
        },
        modules: {
          showAI: true,
          showAnalytics: true,
        }
      }
    });
    expect(updateCustomRes.status()).toBe(200);

    // Fetch history
    const historyRes = await context.get(`${apiURL}/api/hospital-admin/customization/history`, { headers });
    expect(historyRes.status()).toBe(200);
  });
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during hospital admin tests:', errors);
  }
});
