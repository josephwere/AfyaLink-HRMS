import { promises as fs } from 'fs';
import path from 'path';
import { expect, type APIResponse, type Page, type APIRequestContext } from '@playwright/test';

export const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';

const authCache = new Map<string, { headers: Record<string, string>; expiresAt: number }>();
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTH_STATE_FILE = path.resolve(
  process.cwd(),
  process.env.PLAYWRIGHT_AUTH_STATE_FILE || 'test-results/.auth/api-auth.json'
);

type StoredAuthState = Record<string, { headers: Record<string, string>; expiresAt: number; apiURL: string }>;

async function readPersistedAuthState(): Promise<StoredAuthState> {
  try {
    const raw = await fs.readFile(AUTH_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredAuthState;
    }
  } catch {
    // No persisted state yet; continue with live login.
  }
  return {};
}

async function writePersistedAuthState(state: StoredAuthState) {
  try {
    await fs.mkdir(path.dirname(AUTH_STATE_FILE), { recursive: true });
    await fs.writeFile(AUTH_STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // File persistence is best-effort for local e2e stability.
  }
}

async function loadCachedAuthState(role: string, apiURL: string) {
  const state = await readPersistedAuthState();
  const entry = state[role];
  if (entry && entry.apiURL === apiURL && Date.now() < entry.expiresAt) {
    return { ...entry.headers };
  }
  return null;
}

async function persistAuthState(role: string, apiURL: string, headers: Record<string, string>, expiresAt: number) {
  const state = await readPersistedAuthState();
  state[role] = { headers: { ...headers }, expiresAt, apiURL };
  await writePersistedAuthState(state);
}

export async function warmAuthState(role = 'SUPER_ADMIN') {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  const headers = await loadCachedAuthState(role, apiURL);
  if (headers) {
    return headers;
  }
  return null;
}

export const ROLE_CREDENTIALS: Record<string, { email: string; pass: string }> = {
  SUPER_ADMIN: {
    email: process.env.E2E_EMAIL || 'josephogwe8@gmail.com',
    pass: process.env.E2E_PASSWORD || 'Josboy@254',
  },
  SYSTEM_ADMIN: {
    email: 'system.admin@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  HOSPITAL_ADMIN: {
    email: 'hospital.admin@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  DOCTOR: {
    email: 'doctor@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  NURSE: {
    email: 'nurse@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  PHARMACIST: {
    email: 'pharmacist@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  LAB_TECHNICIAN: {
    email: 'lab.tech@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  RECEPTIONIST: {
    email: 'receptionist@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  PATIENT: {
    email: 'patient.demo@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  DRIVER: {
    email: 'driver@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  AMBULANCE_DRIVER: {
    email: 'ambulance.driver@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  MORTUARY_STAFF: {
    email: 'mortuary.staff@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  MORTUARY_MANAGER: {
    email: 'mortuary.manager@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  SECURITY_OFFICER: {
    email: 'security.officer@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
  COMMUNITY_HEALTH_WORKER: {
    email: 'community.health.worker@afyalink.demo',
    pass: 'AfyaDemo@2026!',
  },
};

export function expectApiStatus(response: APIResponse, allowedStatuses: number[], label = 'API request') {
  const status = response.status();
  expect(allowedStatuses, `${label} returned unexpected status ${status}`).toContain(status);
}

export async function loginAsSuperAdmin(page: Page) {
  await loginAsRole(page, 'SUPER_ADMIN');
}

export async function loginAsRole(page: Page, role: string) {
  const creds = ROLE_CREDENTIALS[role];
  if (!creds) {
    throw new Error(`Unknown role in test harness: ${role}`);
  }
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"], input[type="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.pass);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app\//, { timeout: 30000 });
  await expect(page).toHaveURL(/\/app\//);
}

export async function openAuthenticatedRoute(page: Page, route: string) {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  await page.goto(`${baseURL}${normalized}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
}

export function setupErrorListeners(page: Page, errorsArray: string[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errorsArray.push(`console_error [${page.url()}]: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errorsArray.push(`page_error [${page.url()}]: ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    errorsArray.push(`network_fail [${page.url()}]: ${req.url()} (${req.failure()?.errorText || 'failed'})`);
  });
}

export async function getAuthHeader(request: APIRequestContext, role: string) {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  const cacheKey = `${role}:${apiURL}`;
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.headers };
  }

  const persistedHeaders = await loadCachedAuthState(role, apiURL);
  if (persistedHeaders) {
    authCache.set(cacheKey, { headers: { ...persistedHeaders }, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return { ...persistedHeaders };
  }

  const creds = ROLE_CREDENTIALS[role];
  const response = await request.post(`${apiURL}/api/auth/login`, {
    data: { identifier: creds.email, password: creds.pass },
    timeout: 30_000,
  });
  const body = await response.json().catch(() => ({}));
  let token = body?.accessToken || body?.token;
  if (!token && (response.status() === 429 || body?.code === 'AUTH_SENSITIVE_RATE_LIMITED')) {
    const fallbackHeaders = await loadCachedAuthState(role, apiURL);
    if (fallbackHeaders) {
      authCache.set(cacheKey, { headers: { ...fallbackHeaders }, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
      return { ...fallbackHeaders };
    }
    throw new Error(`Unable to obtain auth token for ${role}: ${JSON.stringify(body)}`);
  }
  if (!token) {
    throw new Error(`Unable to obtain auth token for ${role}: ${JSON.stringify(body)}`);
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const configuredHospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID;
  const fallbackHospitalId = configuredHospitalId || '6a3c5f256891eaf54c0514e9';

  if (configuredHospitalId) {
    headers['X-Hospital'] = configuredHospitalId;
    headers['X-Hospital-Id'] = configuredHospitalId;
    const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
    authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
    await persistAuthState(role, apiURL, headers, expiresAt);
    return { ...headers };
  }

  try {
    const hospitalRes = await request.get(`${apiURL}/api/hospitals`, { headers });
    if (hospitalRes.ok()) {
      const hospitalPayload = await hospitalRes.json();
      const hospitals = Array.isArray(hospitalPayload)
        ? hospitalPayload
        : Array.isArray(hospitalPayload?.hospitals)
          ? hospitalPayload.hospitals
          : Array.isArray(hospitalPayload?.items)
            ? hospitalPayload.items
            : Array.isArray(hospitalPayload?.data)
              ? hospitalPayload.data
              : [];
      const firstHospital = hospitals[0];
      const scopedHospitalId = firstHospital?._id || firstHospital?.id || firstHospital?.hospitalId;
      if (scopedHospitalId) {
        headers['X-Hospital'] = String(scopedHospitalId);
        headers['X-Hospital-Id'] = String(scopedHospitalId);
        const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
        authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
        await persistAuthState(role, apiURL, headers, expiresAt);
        return { ...headers };
      }
    }
  } catch {
    // Fall back to the known seeded hospital for local workflow certification.
  }

  headers['X-Hospital'] = fallbackHospitalId;
  headers['X-Hospital-Id'] = fallbackHospitalId;
  const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
  authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
  await persistAuthState(role, apiURL, headers, expiresAt);
  return { ...headers };
}
