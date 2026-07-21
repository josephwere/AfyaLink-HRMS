# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.smoke.spec.js >> super-admin login reaches the platform workspace
- Location: tests/e2e/login.smoke.spec.js:7:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/login
Call log:
  - navigating to "http://127.0.0.1:5173/login", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
  4  | const email = process.env.E2E_EMAIL || 'josephogwe8@gmail.com';
  5  | const password = process.env.E2E_PASSWORD || 'Josboy@254';
  6  | 
  7  | test('super-admin login reaches the platform workspace', async ({ page }) => {
  8  |   const errors = [];
  9  |   page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  10 |   page.on('console', (msg) => {
  11 |     if (msg.type() === 'error') {
  12 |       errors.push(`console:${msg.text()}`);
  13 |     }
  14 |   });
  15 | 
> 16 |   await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/login
  17 |   await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  18 | 
  19 |   await page.getByLabel(/email, phone or national id/i).fill(email);
  20 |   await page.getByLabel(/password/i).fill(password);
  21 |   await page.locator('button[type="submit"]').click();
  22 | 
  23 |   await page.waitForURL(/\/app\//, { timeout: 30000 });
  24 |   await expect(page).toHaveURL(new RegExp('/app/'));
  25 | 
  26 |   const heading = page.locator('h1, h2').first();
  27 |   await expect(heading).toBeVisible({ timeout: 15000 });
  28 | 
  29 |   await page.goto(`${baseURL}/app/platform/home/index`, { waitUntil: 'domcontentloaded' });
  30 |   await expect(page.locator('body')).toContainText(/super admin|platform/i, { timeout: 20000 });
  31 | 
  32 |   expect(errors).toEqual([]);
  33 | });
  34 | 
```