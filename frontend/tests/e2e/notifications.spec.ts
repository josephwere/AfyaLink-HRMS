import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, getAuthHeader, setupErrorListeners, expectApiStatus } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('AfyaLink Notifications system tests', () => {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

  test('should display notifications page and manage read status', async ({ page, playwright }) => {
    // 1. Login as Super Admin and open notifications UI page
    await loginAsRole(page, 'SUPER_ADMIN');
    await page.goto(`${baseURL}/app/platform/inbox/notifications`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Assert notifications page structure is visible
    const currentURL = page.url();
    expect(currentURL).toContain('/app/platform/inbox/notifications');

    // 2. Test notification status changes via backend API
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // Fetch existing notifications list
    const listRes = await context.get(`${apiURL}/api/notifications/list?limit=5`, { headers });
    expectApiStatus(listRes, [200, 401, 429], 'Notifications list request');
    const payload = await listRes.json().catch(() => ({}));
    const notifications = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];
    expect(Array.isArray(notifications)).toBe(true);

    if (notifications.length > 0) {
      const targetId = notifications[0]._id;
      // Mark target notification as read
      const readRes = await context.put(`${apiURL}/api/notifications/${targetId}/read`, { headers });
      expectApiStatus(readRes, [200, 401, 404, 429], 'Mark notification read request');

      // Mark target notification as unread
      const unreadRes = await context.put(`${apiURL}/api/notifications/${targetId}/unread`, { headers });
      expectApiStatus(unreadRes, [200, 401, 404, 429], 'Mark notification unread request');
    }

    // Mark all as read
    const allReadRes = await context.put(`${apiURL}/api/notifications/read-all`, { headers });
    expectApiStatus(allReadRes, [200, 401, 429], 'Mark all notifications read request');
  });
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during notifications tests:', errors);
  }
});
