import { chromium } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const email = process.env.E2E_EMAIL || 'josephogwe8@gmail.com';
const password = process.env.E2E_PASSWORD || 'Josboy@254';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(`console:${msg.text()}`);
  }
});

await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
await page.locator('input[type="text"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.getByRole('button', { name: /sign in/i }).click();

await page.waitForURL(/\/app\//, { timeout: 30000 });
console.log('navigated', page.url());

await page.goto(`${baseURL}/app/platform/home/index`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
console.log('platform-page-title', await page.title());
console.log('body-snippet', (await page.locator('body').innerText()).slice(0, 400));
console.log('errors', errors);

await browser.close();
