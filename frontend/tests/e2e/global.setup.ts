import { promises as fs } from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  const creds = {
    email: process.env.E2E_EMAIL || 'josephogwe8@gmail.com',
    pass: process.env.E2E_PASSWORD || 'Josboy@254',
  };
  const authDir = path.resolve(process.cwd(), 'test-results/.auth');
  const storageStatePath = path.join(authDir, 'storage.json');
  const apiAuthPath = path.join(authDir, 'api-auth.json');

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="text"], input[type="email"]').first().fill(creds.email);
    await page.locator('input[type="password"]').first().fill(creds.pass);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/app\//, { timeout: 30000 });
  } catch {
    // Fall back to API-based auth if the UI route is temporarily unavailable.
  }

  await fs.mkdir(authDir, { recursive: true });
  await context.storageState({ path: storageStatePath });

  let cachedAuthState: Record<string, any> = {};
  try {
    const existing = await fs.readFile(apiAuthPath, 'utf8');
    cachedAuthState = JSON.parse(existing);
  } catch {
    cachedAuthState = {};
  }

  const existingEntry = cachedAuthState?.SUPER_ADMIN;
  const hasValidCachedHeaders = Boolean(existingEntry?.headers?.Authorization) && Date.now() < (existingEntry?.expiresAt || 0);
  if (hasValidCachedHeaders) {
    const preservedHeaders = { ...existingEntry.headers };
    const hospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID || '6a3c5f256891eaf54c0514e9';
    preservedHeaders['X-Hospital'] = preservedHeaders['X-Hospital'] || hospitalId;
    preservedHeaders['X-Hospital-Id'] = preservedHeaders['X-Hospital-Id'] || hospitalId;
    await fs.writeFile(apiAuthPath, JSON.stringify({ ...cachedAuthState, SUPER_ADMIN: { ...existingEntry, headers: preservedHeaders, expiresAt: Date.now() + 5 * 60 * 1000, apiURL } }, null, 2));
    await browser.close();
    return;
  }

  let body: any = {};
  try {
    const response = await fetch(`${apiURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: creds.email, password: creds.pass }),
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    body = { error: String(error) };
  }
  const token = body?.accessToken || body?.token;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const hospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID || '6a3c5f256891eaf54c0514e9';
  if (headers.Authorization) {
    headers['X-Hospital'] = hospitalId;
    headers['X-Hospital-Id'] = hospitalId;
  }
  const authState = {
    SUPER_ADMIN: {
      headers,
      expiresAt: Date.now() + 5 * 60 * 1000,
      apiURL,
    },
  };
  if (headers.Authorization) {
    await fs.writeFile(apiAuthPath, JSON.stringify(authState, null, 2));
  } else {
    console.warn('Playwright global setup could not obtain an access token:', JSON.stringify(body));
  }
  await browser.close();
}

export default globalSetup;
