import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, setupErrorListeners, dismissOnboardingTour } from '../shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.afterEach(async () => {
  if (errors.length) {
    console.error('Finance approval workflow errors:', errors.join('\n'));
  }
});

test.describe('Finance approval workflow', () => {
  test('cashier closes shift and finance manager approves it with proper access controls', async ({ page, browser }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await page.goto(`${baseURL}/app/finance/cashier/index`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    let sawShiftClosedAlert = false;
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('1000');
        return;
      }
      if (dialog.type() === 'confirm') {
        await dialog.accept();
        return;
      }
      // capture success or already-submitted alerts so the test can proceed
      if (dialog.type() === 'alert' && (dialog.message().includes('Shift closed') || dialog.message().includes('already submitted'))) {
        sawShiftClosedAlert = true;
      }
      await dialog.accept();
    });

    const openShiftButton = page.getByRole('button', { name: /Open Shift/i });
    const closeShiftButton = page.getByRole('button', { name: /Close Shift/i });

    if (await openShiftButton.count() && await openShiftButton.isVisible()) {
      await dismissOnboardingTour(page);
      await openShiftButton.click();
      await page.waitForLoadState('networkidle');
      await dismissOnboardingTour(page);
      await expect(closeShiftButton).toBeVisible({ timeout: 15000 });
    }

    await dismissOnboardingTour(page);
    await expect(closeShiftButton).toBeVisible({ timeout: 15000 });
    await closeShiftButton.click();
    await page.waitForSelector('button:has-text("Confirm Close Shift")', { timeout: 15000 });
    await page.fill('input[name="expected"]', '16500');
    await page.fill('input[name="cash"]', '12000');
    await page.fill('input[name="mpesa"]', '3000');
    await page.fill('input[name="card"]', '1500');
    await page.fill('input[name="bank"]', '0');
    await page.fill('input[name="insurance"]', '0');
    await page.fill('input[name="refunds"]', '0');
    await page.locator('label:has-text("Reason") input').fill('End of day reconciliation');
    await page.locator('label:has-text("Notes") textarea').fill('Shift closed and sent for approval.');

    const confirmCloseButton = page.getByRole('button', { name: /Confirm Close Shift/i });
    await expect(confirmCloseButton).toBeVisible({ timeout: 15000 });
    await confirmCloseButton.scrollIntoViewIfNeeded();
    // Query the backend-visible current shift to avoid duplicate submissions
    const currentShift = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/finance/shifts/current');
        if (!r.ok) return null;
        return await r.json();
      } catch (e) {
        return null;
      }
    });
    if (currentShift && String(currentShift.status || '').toUpperCase() === 'UNDER_REVIEW') {
      // already submitted for review — cancel the dialog and proceed
      await page.getByRole('button', { name: /Cancel/i }).click();
      await page.waitForSelector('.modal', { state: 'detached', timeout: 30000 });
    } else {
      await confirmCloseButton.click({ force: true });
      await expect(confirmCloseButton).toBeHidden({ timeout: 30000 });
      await page.waitForSelector('.modal', { state: 'detached', timeout: 30000 });
    }
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);

    if (!sawShiftClosedAlert) {
      await page.waitForTimeout(1000);
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await dismissOnboardingTour(page);
    // After closing, shift should be submitted for review (UNDER_REVIEW)
    await expect(page.getByText(/UNDER_REVIEW/i)).toBeVisible({ timeout: 30000 });
    // Cashier should not see an Open Shift option while their shift is under review
    await expect(page.getByRole('button', { name: /Open Shift/i })).toBeHidden({ timeout: 30000 });

    await page.goto(`${baseURL}/app/finance/approvals/index`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/unauthorized/);

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    setupErrorListeners(managerPage, errors);
    await loginAsRole(managerPage, 'FINANCE_MANAGER');
    await managerPage.goto(`${baseURL}/app/finance/approvals/index`, { waitUntil: 'domcontentloaded' });
    await managerPage.waitForLoadState('networkidle');
    await dismissOnboardingTour(managerPage);
    await managerPage.waitForTimeout(500);

    await expect(managerPage.getByText(/Pending cashier shift closures/i)).toBeVisible({ timeout: 20000 });
    const row = managerPage.locator('table tbody tr').filter({ hasText: 'End of day reconciliation' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(/UNDER_REVIEW/i);

    await row.getByRole('button', { name: /Approve/i }).click();
    await expect(managerPage.getByText(/Shift approved successfully/i)).toBeVisible({ timeout: 15000 });
    await expect(row).toHaveCount(0, { timeout: 15000 });

    await managerContext.close();
  });
});
