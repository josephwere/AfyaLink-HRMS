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
const DEMO_HOSPITAL_CODE = 'AFYA-DEMO-001';
const API_HOSPITAL_CONTEXT_ROLES = new Set([
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
  'DEVELOPER',
  'HOSPITAL_ADMIN',
  'HOSPITAL_ADMIN_ASSISTANT',
]);

function getBearerToken(headers: Record<string, string> = {}) {
  const authHeader = headers.Authorization || headers.authorization;
  return typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
}

function tokenRoleMatches(token: string | null, expectedRole: string) {
  if (!token || typeof token !== 'string') return false;
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    const actualRole = String(payload?.role || payload?.userRole || '').toUpperCase();
    return actualRole === String(expectedRole).toUpperCase();
  } catch {
    return false;
  }
}

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
  if (!entry || entry.apiURL !== apiURL || Date.now() >= entry.expiresAt) {
    return null;
  }

  const token = getBearerToken(entry.headers);
  if (!tokenRoleMatches(token, role)) {
    delete state[role];
    await writePersistedAuthState(state);
    return null;
  }

  return { ...entry.headers };
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
    email: process.env.E2E_SUPER_ADMIN_EMAIL || process.env.E2E_EMAIL || 'josephogwe8@gmail.com',
    pass: process.env.E2E_SUPER_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'Josboy@254',
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
  FINANCE_MANAGER: {
    email: 'finance.manager@afyalink.demo',
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

function extractCollection(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.hospitals)) return payload.hospitals;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function resolveActiveHospitalId(
  request: APIRequestContext,
  apiURL: string,
  headers: Record<string, string>
) {
  const configuredHospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID;
  if (configuredHospitalId) return configuredHospitalId;

  try {
    const hospitalRes = await request.get(`${apiURL}/api/hospitals?active=true&limit=100`, {
      headers: { Authorization: headers.Authorization },
    });
    if (!hospitalRes.ok()) return null;
    const hospitalPayload = await hospitalRes.json();
    const hospitals = extractCollection(hospitalPayload);
    const selected =
      hospitals.find((hospital) => String(hospital?.code || '').toUpperCase() === DEMO_HOSPITAL_CODE) ||
      hospitals.find((hospital) => hospital?.active !== false);
    return selected?._id || selected?.id || selected?.hospitalId || null;
  } catch {
    return null;
  }
}

async function withHospitalContext(
  request: APIRequestContext,
  apiURL: string,
  role: string,
  headers: Record<string, string>
) {
  if (!API_HOSPITAL_CONTEXT_ROLES.has(role)) return { ...headers };
  const hospitalId = await resolveActiveHospitalId(request, apiURL, headers);
  if (!hospitalId) return { ...headers };
  return {
    ...headers,
    'X-Hospital': String(hospitalId),
    'X-Hospital-Id': String(hospitalId),
  };
}

export async function createHospitalViaApi(
  requestContext: APIRequestContext,
  apiURL: string,
  headers: Record<string, string>,
  overrides: Record<string, unknown> = {}
) {
  const timestamp = Date.now();
  const registryRes = await requestContext.get(`${apiURL}/api/hospitals/registry/search?q=`, { headers });
  const registryPayload = registryRes.ok() ? await registryRes.json().catch(() => ({})) : {};
  const registryHospital = extractCollection(registryPayload)[0] || {};
  const registrationNumber = String(
    overrides.registrationNumber || registryHospital.registrationNumber || 'MOH-AFYA-DEMO-001'
  );
  const registryLocation = registryHospital.location || {};
  const payload = {
    name: String(overrides.name || registryHospital.officialName || `Automated Test Hospital ${timestamp}`),
    code: String(overrides.code || `ATH-${timestamp.toString().slice(-4)}`),
    registrationNumber,
    type: String(overrides.type || registryHospital.hospitalType || 'PRIVATE'),
    country: String(overrides.country || registryLocation.country || 'KE'),
    region: String(overrides.region || registryLocation.region || 'Nairobi'),
    city: String(overrides.city || registryLocation.city || 'Nairobi'),
    address: String(overrides.address || registryLocation.address || 'Test Road, Nairobi'),
    contact: String(overrides.contact || registryHospital.contact?.phone || '+254700123456'),
    lat: overrides.lat ?? registryLocation.lat ?? -1.28,
    lng: overrides.lng ?? registryLocation.lng ?? 36.82,
  };

  const documentBuffer = Buffer.from(`%PDF-1.4\nTest verification document ${timestamp}\n%%EOF`);
  return requestContext.post(`${apiURL}/api/hospitals`, {
    headers,
    multipart: {
      ...payload,
      registrationCertificate: {
        name: `${registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-registration.pdf`,
        mimeType: 'application/pdf',
        buffer: documentBuffer,
      },
      taxRegistration: {
        name: `${registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tax.pdf`,
        mimeType: 'application/pdf',
        buffer: documentBuffer,
      },
      proofOfAddress: {
        name: `${registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-address.pdf`,
        mimeType: 'application/pdf',
        buffer: documentBuffer,
      },
      representativeId: {
        name: `${registrationNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-representative.pdf`,
        mimeType: 'application/pdf',
        buffer: documentBuffer,
      },
    },
  });
}

export async function loginAsSuperAdmin(page: Page) {
  await loginAsRole(page, 'SUPER_ADMIN');
}

export async function loginAsRole(page: Page, role: string) {
  const creds = ROLE_CREDENTIALS[role];
  if (!creds) {
    throw new Error(`Unknown role in test harness: ${role}`);
  }

  const loginURL = `${baseURL}/login`;
  try {
    await page.goto(loginURL, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    throw new Error(`Unable to reach frontend login page at ${loginURL}: ${error instanceof Error ? error.message : String(error)}`);
  }

  await page.locator('#login-identifier').fill(creds.email);
  await page.locator('#login-password').fill(creds.pass);
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

export async function dismissOnboardingTour(page: Page) {
  const closeButtons = page.locator(
    'button:has-text("Skip Tour"), button:has-text("Close Tour"), button:has-text("Close"), button:has-text("Finish"), button[aria-label="Close"]'
  );
  const overlay = page.locator('.tour-backdrop, .tour-modal, [role="dialog"][aria-modal="true"]');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const isVisible = await overlay.first().isVisible().catch(() => false);
    if (!isVisible) {
      return;
    }

    if (await closeButtons.first().isVisible().catch(() => false)) {
      await closeButtons.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }

    await page.evaluate(() => {
      document.querySelectorAll('.tour-backdrop, .tour-modal, [role="dialog"][aria-modal="true"]').forEach((modal) => {
        if (modal instanceof HTMLElement) {
          modal.style.pointerEvents = 'none';
          modal.remove();
        }
      });
    });

    await page.waitForTimeout(500);
  }
}

export async function getAuthHeader(request: APIRequestContext, role: string) {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  const cacheKey = `${role}:${apiURL}`;
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    const token = getBearerToken(cached.headers);
    if (tokenRoleMatches(token, role)) {
      return withHospitalContext(request, apiURL, role, cached.headers);
    }
    authCache.delete(cacheKey);
  }

  const persistedHeaders = await loadCachedAuthState(role, apiURL);
  if (persistedHeaders) {
    const scopedHeaders = await withHospitalContext(request, apiURL, role, persistedHeaders);
    authCache.set(cacheKey, { headers: { ...scopedHeaders }, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return { ...scopedHeaders };
  }

  const creds = ROLE_CREDENTIALS[role];
  const loginURL = `${apiURL}/api/auth/login`;
  const response = await request.post(loginURL, {
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

  if (configuredHospitalId) {
    headers['X-Hospital'] = configuredHospitalId;
    headers['X-Hospital-Id'] = configuredHospitalId;
    const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
    authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
    await persistAuthState(role, apiURL, headers, expiresAt);
    return { ...headers };
  }

  const scopedHospitalId = await resolveActiveHospitalId(request, apiURL, headers);
  if (scopedHospitalId) {
    headers['X-Hospital'] = String(scopedHospitalId);
    headers['X-Hospital-Id'] = String(scopedHospitalId);
    const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
    authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
    await persistAuthState(role, apiURL, headers, expiresAt);
    return { ...headers };
  }

  const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
  authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
  await persistAuthState(role, apiURL, headers, expiresAt);
  return { ...headers };
}
