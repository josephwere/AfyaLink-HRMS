import { chromium } from '@playwright/test';

const FRONTEND_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const BACKEND_BASE = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
const creds = { email: process.env.E2E_EMAIL || 'cfo@afyalink.demo', pass: process.env.E2E_PASSWORD || 'AfyaDemo@2026!' };

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const summary = {
    requestUrl: null,
    apiBaseOrigin: BACKEND_BASE,
    authorization: { tokenPresent: false, tokenLength: 0 },
    login: { status: null },
    executive: { requestUrl: null, responseStatus: null, payloadKeys: [] },
    consoleErrors: [],
    networkFailures: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') summary.consoleErrors.push(String(msg.text()).slice(0, 200));
  });
  page.on('requestfailed', (req) => {
    summary.networkFailures.push({ url: req.url(), text: req.failure()?.errorText || 'failed' });
  });

  page.on('request', (req) => {
    try {
      const url = req.url();
      if (url.includes('/api/auth/login')) summary.login.requestUrl = url;
      if (url.includes('/api/dashboard/executive')) {
        summary.executive.requestUrl = url;
        summary.executive.requestHeaders = req.headers();
      }
    } catch (e) {
      // ignore
    }
  });

  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('/api/auth/login')) {
        summary.login.status = res.status();
      }
      if (url.includes('/api/dashboard/executive')) {
        summary.executive.responseStatus = res.status();
        let body = null;
        try {
          body = await res.json();
        } catch {
          // non-json
        }
        if (body && typeof body === 'object') summary.executive.payloadKeys = Object.keys(body).slice(0, 30);
      }
    } catch (e) {
      // ignore
    }
  });

  try {
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    console.error('Unable to reach frontend login page', err.message || String(err));
    await browser.close();
    process.exit(2);
  }

  // perform UI login
  try {
    await page.fill('input[type="text"], input[type="email"]', creds.email);
    await page.fill('input[type="password"]', creds.pass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\//, { timeout: 30000 });
  } catch (err) {
    console.error('Login flow failed', err.message || String(err));
  }

  // inspect sessionStorage for access token
  try {
    const token = await page.evaluate(() => sessionStorage.getItem('afyalink_access_token'));
    summary.authorization.tokenPresent = Boolean(token);
    summary.authorization.tokenLength = token ? token.length : 0;
  } catch (e) {
    // ignore
  }

  // navigate to CFO executive route and wait for UI
  try {
    const route = '/app/finance/executive/index';
    await page.goto(`${FRONTEND_BASE}${route}`, { waitUntil: 'domcontentloaded' });
    summary.requestUrl = `${BACKEND_BASE}/api/dashboard/executive`;
    // wait for the CFO dashboard title to appear
    await page.waitForSelector('h1.premium-shell-title:has-text("CFO Dashboard")', { timeout: 15000 });
    // give some time for api to settle
    await page.waitForTimeout(1500);
  } catch (err) {
    // continue, we'll capture network/console info
  }

  // Read Authorization header from last captured executive request (if present)
  try {
    if (summary.executive.requestHeaders) {
      const authHeader = summary.executive.requestHeaders.authorization || summary.executive.requestHeaders.Authorization;
      summary.authorization.headerPresent = Boolean(authHeader);
      if (authHeader) summary.authorization.headerSnippetLength = String(authHeader).length;
    }
  } catch (e) {}

  // Capture a few DOM presence checks to confirm render
  try {
    const titleExists = await page.locator('h1.premium-shell-title:has-text("CFO Dashboard")').count();
    summary.ui = { titleVisible: titleExists > 0 };
  } catch (e) {
    summary.ui = { titleVisible: false };
  }

  await browser.close();

  // prune sensitive fields
  if (summary.authorization.headerSnippetLength) delete summary.executive.requestHeaders;

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

run().catch((err) => {
  console.error('Script error', err);
  process.exit(1);
});
