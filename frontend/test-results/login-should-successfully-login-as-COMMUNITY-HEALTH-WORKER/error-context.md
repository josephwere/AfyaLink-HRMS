# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> should successfully login as COMMUNITY_HEALTH_WORKER
- Location: tests/e2e/login.spec.ts:11:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/login
Call log:
  - navigating to "http://127.0.0.1:5173/login", waiting until "domcontentloaded"

```

# Test source

```ts
  39  |   const state = await readPersistedAuthState();
  40  |   const entry = state[role];
  41  |   if (entry && entry.apiURL === apiURL && Date.now() < entry.expiresAt) {
  42  |     return { ...entry.headers };
  43  |   }
  44  |   return null;
  45  | }
  46  | 
  47  | async function persistAuthState(role: string, apiURL: string, headers: Record<string, string>, expiresAt: number) {
  48  |   const state = await readPersistedAuthState();
  49  |   state[role] = { headers: { ...headers }, expiresAt, apiURL };
  50  |   await writePersistedAuthState(state);
  51  | }
  52  | 
  53  | export async function warmAuthState(role = 'SUPER_ADMIN') {
  54  |   const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  55  |   const headers = await loadCachedAuthState(role, apiURL);
  56  |   if (headers) {
  57  |     return headers;
  58  |   }
  59  |   return null;
  60  | }
  61  | 
  62  | export const ROLE_CREDENTIALS: Record<string, { email: string; pass: string }> = {
  63  |   SUPER_ADMIN: {
  64  |     email: process.env.E2E_EMAIL || 'josephogwe8@gmail.com',
  65  |     pass: process.env.E2E_PASSWORD || 'Josboy@254',
  66  |   },
  67  |   SYSTEM_ADMIN: {
  68  |     email: 'system.admin@afyalink.demo',
  69  |     pass: 'AfyaDemo@2026!',
  70  |   },
  71  |   HOSPITAL_ADMIN: {
  72  |     email: 'hospital.admin@afyalink.demo',
  73  |     pass: 'AfyaDemo@2026!',
  74  |   },
  75  |   DOCTOR: {
  76  |     email: 'doctor@afyalink.demo',
  77  |     pass: 'AfyaDemo@2026!',
  78  |   },
  79  |   NURSE: {
  80  |     email: 'nurse@afyalink.demo',
  81  |     pass: 'AfyaDemo@2026!',
  82  |   },
  83  |   PHARMACIST: {
  84  |     email: 'pharmacist@afyalink.demo',
  85  |     pass: 'AfyaDemo@2026!',
  86  |   },
  87  |   LAB_TECHNICIAN: {
  88  |     email: 'lab.tech@afyalink.demo',
  89  |     pass: 'AfyaDemo@2026!',
  90  |   },
  91  |   RECEPTIONIST: {
  92  |     email: 'receptionist@afyalink.demo',
  93  |     pass: 'AfyaDemo@2026!',
  94  |   },
  95  |   PATIENT: {
  96  |     email: 'patient.demo@afyalink.demo',
  97  |     pass: 'AfyaDemo@2026!',
  98  |   },
  99  |   DRIVER: {
  100 |     email: 'driver@afyalink.demo',
  101 |     pass: 'AfyaDemo@2026!',
  102 |   },
  103 |   AMBULANCE_DRIVER: {
  104 |     email: 'ambulance.driver@afyalink.demo',
  105 |     pass: 'AfyaDemo@2026!',
  106 |   },
  107 |   MORTUARY_STAFF: {
  108 |     email: 'mortuary.staff@afyalink.demo',
  109 |     pass: 'AfyaDemo@2026!',
  110 |   },
  111 |   MORTUARY_MANAGER: {
  112 |     email: 'mortuary.manager@afyalink.demo',
  113 |     pass: 'AfyaDemo@2026!',
  114 |   },
  115 |   SECURITY_OFFICER: {
  116 |     email: 'security.officer@afyalink.demo',
  117 |     pass: 'AfyaDemo@2026!',
  118 |   },
  119 |   COMMUNITY_HEALTH_WORKER: {
  120 |     email: 'community.health.worker@afyalink.demo',
  121 |     pass: 'AfyaDemo@2026!',
  122 |   },
  123 | };
  124 | 
  125 | export function expectApiStatus(response: APIResponse, allowedStatuses: number[], label = 'API request') {
  126 |   const status = response.status();
  127 |   expect(allowedStatuses, `${label} returned unexpected status ${status}`).toContain(status);
  128 | }
  129 | 
  130 | export async function loginAsSuperAdmin(page: Page) {
  131 |   await loginAsRole(page, 'SUPER_ADMIN');
  132 | }
  133 | 
  134 | export async function loginAsRole(page: Page, role: string) {
  135 |   const creds = ROLE_CREDENTIALS[role];
  136 |   if (!creds) {
  137 |     throw new Error(`Unknown role in test harness: ${role}`);
  138 |   }
> 139 |   await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/login
  140 |   await page.locator('input[type="text"], input[type="email"]').first().fill(creds.email);
  141 |   await page.locator('input[type="password"]').first().fill(creds.pass);
  142 |   await page.locator('button[type="submit"]').click();
  143 |   await page.waitForURL(/\/app\//, { timeout: 30000 });
  144 |   await expect(page).toHaveURL(/\/app\//);
  145 | }
  146 | 
  147 | export async function openAuthenticatedRoute(page: Page, route: string) {
  148 |   const normalized = route.startsWith('/') ? route : `/${route}`;
  149 |   await page.goto(`${baseURL}${normalized}`, { waitUntil: 'domcontentloaded' });
  150 |   await page.waitForTimeout(1000);
  151 | }
  152 | 
  153 | export function setupErrorListeners(page: Page, errorsArray: string[]) {
  154 |   page.on('console', (msg) => {
  155 |     if (msg.type() === 'error') {
  156 |       errorsArray.push(`console_error [${page.url()}]: ${msg.text()}`);
  157 |     }
  158 |   });
  159 |   page.on('pageerror', (err) => {
  160 |     errorsArray.push(`page_error [${page.url()}]: ${err.message}`);
  161 |   });
  162 |   page.on('requestfailed', (req) => {
  163 |     errorsArray.push(`network_fail [${page.url()}]: ${req.url()} (${req.failure()?.errorText || 'failed'})`);
  164 |   });
  165 | }
  166 | 
  167 | export async function getAuthHeader(request: APIRequestContext, role: string) {
  168 |   const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  169 |   const cacheKey = `${role}:${apiURL}`;
  170 |   const cached = authCache.get(cacheKey);
  171 |   if (cached && Date.now() < cached.expiresAt) {
  172 |     return { ...cached.headers };
  173 |   }
  174 | 
  175 |   const persistedHeaders = await loadCachedAuthState(role, apiURL);
  176 |   if (persistedHeaders) {
  177 |     authCache.set(cacheKey, { headers: { ...persistedHeaders }, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  178 |     return { ...persistedHeaders };
  179 |   }
  180 | 
  181 |   const creds = ROLE_CREDENTIALS[role];
  182 |   const response = await request.post(`${apiURL}/api/auth/login`, {
  183 |     data: { identifier: creds.email, password: creds.pass },
  184 |     timeout: 30_000,
  185 |   });
  186 |   const body = await response.json().catch(() => ({}));
  187 |   let token = body?.accessToken || body?.token;
  188 |   if (!token && (response.status() === 429 || body?.code === 'AUTH_SENSITIVE_RATE_LIMITED')) {
  189 |     const fallbackHeaders = await loadCachedAuthState(role, apiURL);
  190 |     if (fallbackHeaders) {
  191 |       authCache.set(cacheKey, { headers: { ...fallbackHeaders }, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  192 |       return { ...fallbackHeaders };
  193 |     }
  194 |     throw new Error(`Unable to obtain auth token for ${role}: ${JSON.stringify(body)}`);
  195 |   }
  196 |   if (!token) {
  197 |     throw new Error(`Unable to obtain auth token for ${role}: ${JSON.stringify(body)}`);
  198 |   }
  199 |   const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  200 | 
  201 |   const configuredHospitalId = process.env.E2E_HOSPITAL_ID || process.env.HOSPITAL_ID;
  202 |   const fallbackHospitalId = configuredHospitalId || '6a3c5f256891eaf54c0514e9';
  203 | 
  204 |   if (configuredHospitalId) {
  205 |     headers['X-Hospital'] = configuredHospitalId;
  206 |     headers['X-Hospital-Id'] = configuredHospitalId;
  207 |     const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
  208 |     authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
  209 |     await persistAuthState(role, apiURL, headers, expiresAt);
  210 |     return { ...headers };
  211 |   }
  212 | 
  213 |   try {
  214 |     const hospitalRes = await request.get(`${apiURL}/api/hospitals`, { headers });
  215 |     if (hospitalRes.ok()) {
  216 |       const hospitalPayload = await hospitalRes.json();
  217 |       const hospitals = Array.isArray(hospitalPayload)
  218 |         ? hospitalPayload
  219 |         : Array.isArray(hospitalPayload?.hospitals)
  220 |           ? hospitalPayload.hospitals
  221 |           : Array.isArray(hospitalPayload?.items)
  222 |             ? hospitalPayload.items
  223 |             : Array.isArray(hospitalPayload?.data)
  224 |               ? hospitalPayload.data
  225 |               : [];
  226 |       const firstHospital = hospitals[0];
  227 |       const scopedHospitalId = firstHospital?._id || firstHospital?.id || firstHospital?.hospitalId;
  228 |       if (scopedHospitalId) {
  229 |         headers['X-Hospital'] = String(scopedHospitalId);
  230 |         headers['X-Hospital-Id'] = String(scopedHospitalId);
  231 |         const expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
  232 |         authCache.set(cacheKey, { headers: { ...headers }, expiresAt });
  233 |         await persistAuthState(role, apiURL, headers, expiresAt);
  234 |         return { ...headers };
  235 |       }
  236 |     }
  237 |   } catch {
  238 |     // Fall back to the known seeded hospital for local workflow certification.
  239 |   }
```