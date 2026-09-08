import { promises as fs } from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // no-op: browser storage may be unavailable in this context
    }
  });
  const page = await context.newPage();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  const creds = {
    email: process.env.E2E_SUPER_ADMIN_EMAIL || process.env.E2E_EMAIL || process.env.E2E_SETUP_EMAIL || 'josephogwe8@gmail.com',
    pass: process.env.E2E_SUPER_ADMIN_PASSWORD || process.env.E2E_PASSWORD || process.env.E2E_SETUP_PASSWORD || 'Josboy@254',
  };
  const authDir = path.resolve(process.cwd(), 'test-results/.auth');
  const storageStatePath = path.join(authDir, 'storage.json');
  const apiAuthPath = path.join(authDir, 'api-auth.json');

  // Try UI login once, but don't fail global setup if it times out.
  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(creds.email);
    await page.locator('input[type="password"]').first().fill(creds.pass);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/app\//, { timeout: 20000 });
  } catch (uiErr) {
    // UI-based login is best-effort; we'll fallback to API login for deterministic auth.
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
    // Validate cached token still maps to an active hospital. If not, discover a seeded hospital.
    const preservedHeaders = { ...existingEntry.headers };
    let hospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID || null;
    try {
      const token = preservedHeaders.Authorization?.split(' ')[1];
      if (token && !hospitalId) {
        const resp = await fetch(`${apiURL}/api/hospitals?limit=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
        if (resp && resp.ok) {
          const body = await resp.json().catch(() => null);
          if (body && Array.isArray(body.items) && body.items.length) hospitalId = body.items[0]._id || body.items[0].id || hospitalId;
          if (!hospitalId && body && body._id) hospitalId = body._id;
        }
      }
    } catch {}
    if (hospitalId) {
      preservedHeaders['X-Hospital'] = preservedHeaders['X-Hospital'] || hospitalId;
      preservedHeaders['X-Hospital-Id'] = preservedHeaders['X-Hospital-Id'] || hospitalId;
    }
    await fs.writeFile(apiAuthPath, JSON.stringify({ ...cachedAuthState, SUPER_ADMIN: { ...existingEntry, headers: preservedHeaders, expiresAt: Date.now() + 5 * 60 * 1000, apiURL } }, null, 2));
    await browser.close();
    return;
  }

  // Attempt API logins for a set of demo roles so tests can reuse cached headers.
  const rolesToSeed = (process.env.E2E_SETUP_ROLES || 'SUPER_ADMIN,SYSTEM_ADMIN,HOSPITAL_ADMIN,DOCTOR,NURSE,PHARMACIST,RECEPTIONIST,FINANCE_MANAGER,PATIENT').split(',').map((r) => r.trim()).filter(Boolean);
  const authState: Record<string, any> = {};

  async function tryApiLogin(roleEmail: string, password: string, attempts = 5, delayMs = 800) {
    for (let i = 0; i < attempts; i += 1) {
      try {
        const res = await fetch(`${apiURL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: roleEmail, password }),
        }).catch(() => null);
        if (res && res.ok) {
          const body = await res.json().catch(() => ({}));
          const token = body?.accessToken || body?.token;
          if (token) return token;
        }
      } catch (e) {
        // ignore and retry
      }
      // small backoff
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }

  // Prepare auth directory and ensure storageState exists
  await fs.mkdir(authDir, { recursive: true });
  await context.storageState({ path: storageStatePath });

  // Seed API auth for requested roles
  const roleDefaults: Record<string, { email: string; pass: string }> = {
    SUPER_ADMIN: { email: process.env.E2E_SUPER_ADMIN_EMAIL || process.env.E2E_EMAIL || 'josephogwe8@gmail.com', pass: process.env.E2E_SUPER_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'Josboy@254' },
    SYSTEM_ADMIN: { email: 'system.admin@afyalink.demo', pass: creds.pass },
    HOSPITAL_ADMIN: { email: 'hospital.admin@afyalink.demo', pass: creds.pass },
    DOCTOR: { email: 'doctor@afyalink.demo', pass: creds.pass },
    NURSE: { email: 'nurse@afyalink.demo', pass: creds.pass },
    PHARMACIST: { email: 'pharmacist@afyalink.demo', pass: creds.pass },
    RECEPTIONIST: { email: 'receptionist@afyalink.demo', pass: creds.pass },
    FINANCE_MANAGER: { email: 'finance.manager@afyalink.demo', pass: creds.pass },
    PATIENT: { email: 'patient.demo@afyalink.demo', pass: creds.pass },
  };

  for (const role of rolesToSeed) {
    const def = roleDefaults[role] || { email: creds.email, pass: creds.pass };
    const token = await tryApiLogin(def.email, def.pass, 6, 1000);
    if (token) {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      // Discover a seeded active hospital id using the just-obtained token
      let hospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID || null;
      try {
        const resp = await fetch(`${apiURL}/api/hospitals?limit=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
        if (resp && resp.ok) {
          const body = await resp.json().catch(() => null);
          if (body && Array.isArray(body.items) && body.items.length) hospitalId = body.items[0]._id || body.items[0].id || hospitalId;
          if (!hospitalId && body && body._id) hospitalId = body._id;
        }
      } catch (e) {
        // ignore and fallback
      }
      hospitalId = hospitalId || process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID || null;
      if (hospitalId) {
        headers['X-Hospital'] = headers['X-Hospital-Id'] = hospitalId;
      }
      authState[role] = { headers, expiresAt: Date.now() + 5 * 60 * 1000, apiURL };
    }
  }

  // Persist api-auth.json if we obtained any tokens. Always keep storage.json written.
  if (Object.keys(authState).length > 0) {
    await fs.writeFile(apiAuthPath, JSON.stringify(authState, null, 2));
  }

  await browser.close();
}

export default globalSetup;
