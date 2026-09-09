#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const FRONTEND_HOST = process.env.PLAYWRIGHT_FRONTEND_HOST || '127.0.0.1';
const FRONTEND_PORT = Number(process.env.PLAYWRIGHT_FRONTEND_PORT || 5173);
const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || `http://${FRONTEND_HOST}:${FRONTEND_PORT}`;
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 5000);
const BACKEND_URL = process.env.BACKEND_BASE_URL || `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const DEFAULT_START_TIMEOUT_MS = 180_000;
const requestedStartTimeout = Number(process.env.E2E_START_TIMEOUT_MS);
const START_TIMEOUT_MS = Number.isFinite(requestedStartTimeout) && requestedStartTimeout > 0
  ? requestedStartTimeout
  : DEFAULT_START_TIMEOUT_MS;

console.log(`[E2E START] using startup timeout ${START_TIMEOUT_MS}ms`);

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function isReachable(url) {
  try {
    const resp = await fetch(url, { method: 'GET' });
    return resp.ok || resp.status === 200 || resp.status === 204;
  } catch (e) {
    return false;
  }
}

async function fetchOk(url) {
  try {
    const resp = await fetch(url, { method: 'GET' });
    return resp;
  } catch (e) {
    return null;
  }
}

async function checkFrontendAsset() {
  // Try index.html first, then favicon
  try {
    const indexResp = await fetchOk(`${FRONTEND_URL}/index.html`);
    if (indexResp && indexResp.status === 200) {
      const text = await indexResp.text().catch(() => '');
      if (text && text.includes('<div') ) return true;
    }
    const fav = await fetchOk(`${FRONTEND_URL}/favicon.ico`);
    if (fav && fav.status === 200) return true;
  } catch (e) {}
  return false;
}

async function tryAuthLogin(timeoutMs = 5000) {
  const email = process.env.E2E_AUTH_TEST_EMAIL || process.env.AFYALINK_PRESENTATION_EMAIL || 'receptionist@afyalink.demo';
  const pass = process.env.E2E_AUTH_TEST_PASSWORD || process.env.AFYALINK_PRESENTATION_PASSWORD || process.env.E2E_PASSWORD || 'AfyaDemo@2026!';
  const apiUrl = BACKEND_URL;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: pass }),
      }).catch(() => null);
      if (resp && resp.ok) {
        // verify capabilities endpoint works for this session
        const body = await resp.json().catch(() => ({}));
        const token = body?.accessToken || body?.token;
        if (token) {
          const cap = await fetch(`${apiUrl}/api/auth/capabilities`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
          if (cap && (cap.status === 200 || cap.status === 204)) return true;
        }
      }
    } catch (e) {
      // ignore transient
    }
    await sleep(500);
  }
  return false;
}

async function waitForUrl(url, timeoutMs = START_TIMEOUT_MS) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(url)) return true;
    await sleep(500);
  }
  return false;
}

function spawnChild(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  child.on('error', (err) => {
    console.error(`[E2E START] child process error for ${cmd}:`, err);
  });
  return child;
}

async function main() {
  console.log(`[E2E START] startup url=frontend=${FRONTEND_URL} backend=${BACKEND_URL}`);
  const frontendReady = await waitForUrl(FRONTEND_URL, 2000).catch(() => false);
  const backendReady = await waitForUrl(`${BACKEND_URL}/api/health`, 2000).catch(() => false);
  console.log(`[E2E START] existing server check: frontend=${frontendReady} backend=${backendReady}`);

  if (frontendReady && backendReady) {
    console.log('[E2E START] Detected existing frontend and backend. Reusing existing servers.');
    process.exit(0);
  }

  const children = [];

  // Ensure ports are free to avoid accidental port fallback
  function ensurePortFree(port) {
    try {
      const out = execSync(`lsof -ti :${port} 2>/dev/null || true`).toString().trim();
      if (out) {
        const pids = out.split(/\s+/).filter(Boolean);
        for (const pid of pids) {
          try {
            process.kill(Number(pid), 'SIGKILL');
            console.log(`[E2E START] killed pid ${pid} listening on port ${port}`);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // best-effort
    }
  }

  ensurePortFree(FRONTEND_PORT);
  ensurePortFree(BACKEND_PORT);

  // Start backend
  if (!backendReady) {
    console.log('[E2E START] Starting backend (test mode, in-memory Mongo)...');
    const backendCwd = path.resolve(process.cwd(), '../backend');
    const backendEnv = {
      ...process.env,
      NODE_ENV: 'test',
      USE_MEMORY_MONGO: '1',
      DISABLE_CRON: '1',
      AFYALINK_PRESENTATION_SEED_ON_BOOT: 'YES',
      AFYALINK_PRESENTATION_PASSWORD: process.env.AFYALINK_PRESENTATION_PASSWORD || 'AfyaDemo@2026!',
      AFYALINK_PRESENTATION_RESET_PASSWORDS: 'true',
      JWT_SECRET: process.env.JWT_SECRET || 'afyalink-e2e-jwt-secret',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'afyalink-e2e-access-secret',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'afyalink-e2e-refresh-secret',
      REFRESH_SECRET: process.env.REFRESH_SECRET || 'afyalink-e2e-refresh-secret',
      PORT: String(BACKEND_PORT),
    };

    // Best-effort: load JWT secrets from backend/.env so tokens validate during E2E runs
    try {
      const envPath = path.resolve(backendCwd, '.env');
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, 'utf8');
        raw.split(/\n/).forEach((line) => {
          const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
          if (!m) return;
          const k = m[1];
          let v = m[2] || '';
          // strip inline comments and surrounding quotes
          v = v.replace(/\s*#.*/g, '').replace(/^\"|\"$/g, '').replace(/^'|'$/g, '').trim();
          if (['JWT_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'REFRESH_SECRET'].includes(k) && v) {
            backendEnv[k] = backendEnv[k] || v;
            console.log(`[E2E START] Injecting ${k} from backend/.env`);
          }
        });
      }
    } catch (e) {
      // non-fatal
    }
    const backend = spawnChild('node', ['server.js'], { cwd: backendCwd, env: backendEnv });
    children.push(backend);
  }

  // Start frontend
  if (!frontendReady) {
    console.log('[E2E START] Starting frontend (vite)...');
    const frontendCwd = process.cwd();
    const frontendEnv = { ...process.env };
    const frontend = spawnChild(
      'pnpm',
      ['exec', 'vite', '--', '--host', FRONTEND_HOST, '--port', String(FRONTEND_PORT), '--strictPort'],
      { cwd: frontendCwd, env: frontendEnv }
    );
    children.push(frontend);
  }

  // Wait for readiness
  console.log('[E2E START] Waiting for backend and frontend readiness...');
  const start = Date.now();
  const timeoutAt = start + START_TIMEOUT_MS;

  while (Date.now() < timeoutAt) {
    const fReach = await isReachable(FRONTEND_URL);
    const fAsset = fReach ? await checkFrontendAsset() : false;
    let bReady = false;
    try {
      const health = await fetch(`${BACKEND_URL}/api/health`, { method: 'GET' }).then((r) => r.json()).catch(() => null);
      bReady = Boolean(health && health.ok && health.dbReady && health.seedReady);
    } catch (e) {
      bReady = false;
    }
    // Try a quick auth login if backend reports seedReady to ensure credentials work
    let authOk = false;
    if (bReady) {
      try {
        authOk = await tryAuthLogin(3000);
      } catch (e) {
        authOk = false;
      }
    }
    console.log(`[E2E START] readiness loop: frontendReach=${fReach} frontendAsset=${fAsset} backend=${bReady} authOk=${authOk} elapsed=${Date.now() - start}ms`);
    if (fReach && fAsset && bReady && authOk) {
      console.log('[E2E START] All readiness checks passed (frontend, assets, backend, auth).');
      break;
    }
    await sleep(500);
  }

  const finalFrontendReady = await isReachable(FRONTEND_URL);
  let finalBackendReady = false;
  try {
    const health = await fetch(`${BACKEND_URL}/api/health`, { method: 'GET' }).then((r) => r.json()).catch(() => null);
    finalBackendReady = Boolean(health && health.ok && health.dbReady && health.seedReady);
  } catch (e) {
    finalBackendReady = false;
  }
  if (!finalFrontendReady || !finalBackendReady) {
    console.error('[E2E START] Timeout waiting for services to become ready.');
    // Print a short status and exit non-zero to fail fast for Playwright.
    try {
      console.error('[E2E START] Frontend reachable:', await isReachable(FRONTEND_URL));
      console.error('[E2E START] Backend health:', await fetch(`${BACKEND_URL}/api/health`).then((r)=>r.text()).catch(()=>'<unavailable>'));
    } catch (e) {}
    // Kill children
    children.forEach((c) => c.kill());
    process.exit(1);
  }

  // Forward signals to children and keep running until killed.
  const forwardSignal = (sig) => {
    console.log(`[E2E START] Received ${sig}, forwarding to children...`);
    children.forEach((c) => c.kill(sig));
    setTimeout(() => process.exit(0), 5000);
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  // If any child exits early, shutdown everything.
  children.forEach((c) => {
    c.on('exit', (code, signal) => {
      console.log(`[E2E START] child exited code=${code} signal=${signal}`);
      // if exit with non-zero, exit
      if (code !== 0) process.exit(code || 1);
    });
  });

  // Keep the script alive until killed by Playwright.
  // eslint-disable-next-line no-await-in-loop
  while (true) await sleep(1000);
}

main().catch((err) => {
  console.error('[E2E START] unexpected error', err);
  process.exit(1);
});
