#!/usr/bin/env node

/**
 * Live smoke suite for the deployed app/backend.
 *
 * Usage:
 *   BASE_URL=https://afya-link-hrms-4.vercel.app \
 *   SUPER_ADMIN_IDENTIFIER=... SUPER_ADMIN_PASSWORD=... \
 *   HOSPITAL_ADMIN_IDENTIFIER=... HOSPITAL_ADMIN_PASSWORD=... \
 *   PATIENT_IDENTIFIER=... PATIENT_PASSWORD=... \
 *   node scripts/live-smoke-suite.mjs
 *
 * Notes:
 * - Prints timings + status codes only (never prints credentials/tokens).
 * - Designed to catch hanging/slow endpoints quickly after deploy.
 */

const BASE_URL = process.env.BASE_URL || "https://afya-link-hrms-4.vercel.app";
const PROBE_LABEL = process.env.PROBE_LABEL || "default";
const REQUIRED_ROLE_SUITES = new Set(
  String(process.env.REQUIRED_ROLE_SUITES || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
);
const ROLE_FILTER = new Set(
  String(process.env.ROLE_FILTER || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
);

const ROLE_SUITES = [
  {
    label: "SUPER_ADMIN",
    identifierEnv: "SUPER_ADMIN_IDENTIFIER",
    passwordEnv: "SUPER_ADMIN_PASSWORD",
    endpoints: [
      { method: "GET", path: "/api/profile", timeoutMs: 20000 },
      { method: "GET", path: "/api/menu", timeoutMs: 20000 },
      { method: "GET", path: "/api/system-settings", timeoutMs: 30000 },
      { method: "GET", path: "/api/dashboard/super-admin", timeoutMs: 35000 },
      { method: "GET", path: "/api/system-admin/metrics", timeoutMs: 35000 },
      { method: "GET", path: "/api/system-admin/integration-hub", timeoutMs: 45000 },
    ],
  },
  {
    label: "HOSPITAL_ADMIN",
    identifierEnv: "HOSPITAL_ADMIN_IDENTIFIER",
    passwordEnv: "HOSPITAL_ADMIN_PASSWORD",
    endpoints: [
      { method: "GET", path: "/api/profile", timeoutMs: 20000 },
      { method: "GET", path: "/api/menu", timeoutMs: 20000 },
      { method: "GET", path: "/api/hospital-admin/config", timeoutMs: 25000 },
      { method: "GET", path: "/api/dashboard/hospital-admin", timeoutMs: 35000 },
      { method: "GET", path: "/api/appointments?limit=6", timeoutMs: 30000 },
    ],
  },
  {
    label: "PATIENT",
    identifierEnv: "PATIENT_IDENTIFIER",
    passwordEnv: "PATIENT_PASSWORD",
    endpoints: [
      { method: "GET", path: "/api/profile", timeoutMs: 20000 },
      { method: "GET", path: "/api/menu", timeoutMs: 20000 },
      { method: "GET", path: "/api/dashboard/patient", timeoutMs: 35000 },
      { method: "GET", path: "/api/appointments?limit=10", timeoutMs: 35000 },
      { method: "GET", path: "/api/encounters?limit=1", timeoutMs: 35000 },
      { method: "GET", path: "/api/pharmacy/prescriptions", timeoutMs: 35000 },
    ],
  },
  {
    label: "COMMUNITY_HEALTH_WORKER",
    identifierEnv: "CHW_IDENTIFIER",
    passwordEnv: "CHW_PASSWORD",
    endpoints: [
      { method: "GET", path: "/api/profile", timeoutMs: 20000 },
      { method: "GET", path: "/api/dashboard/community-health-worker", timeoutMs: 45000 },
      { method: "GET", path: "/api/chw/households?limit=5", timeoutMs: 45000 },
      { method: "GET", path: "/api/transfers?limit=3", timeoutMs: 45000 },
    ],
  },
];

function joinUrl(base, path) {
  return `${String(base || "").replace(/\/+$/, "")}${String(path || "").startsWith("/") ? "" : "/"}${path}`;
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function timedFetch(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    const ms = Date.now() - startedAt;
    return { res, ms, aborted: false };
  } catch (error) {
    const ms = Date.now() - startedAt;
    return { res: null, ms, aborted: error?.name === "AbortError", error };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function printLine({ label, method, path, status, ms, ok, note = "" }) {
  const mark = ok ? "PASS" : "FAIL";
  const safeStatus = status == null ? "ERR" : String(status);
  console.log(`[${mark}] ${label.padEnd(22)} ${method.padEnd(4)} ${path.padEnd(40)} ${safeStatus.padEnd(4)} ${formatMs(ms)}${note ? ` ${note}` : ""}`);
}

async function login({ label, identifier, password }) {
  const url = joinUrl(BASE_URL, "/api/auth/login");
  const { res, ms, aborted, error } = await timedFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    },
    60000
  );

  if (!res) {
    printLine({
      label,
      method: "POST",
      path: "/api/auth/login",
      status: null,
      ms,
      ok: false,
      note: aborted ? "(timeout)" : `(error: ${error?.message || "unknown"})`,
    });
    return { ok: false, token: "" };
  }

  const data = await readJsonSafe(res);
  const ok = res.ok && Boolean(data?.accessToken || data?.requires2FA);
  printLine({
    label,
    method: "POST",
    path: "/api/auth/login",
    status: res.status,
    ms,
    ok: ok && !data?.requires2FA,
    note: data?.requires2FA ? "(2fa-required)" : "",
  });

  if (!res.ok || data?.requires2FA) {
    return { ok: false, token: "" };
  }

  return { ok: true, token: String(data.accessToken || "") };
}

async function authedCase({ label, token, method, path, timeoutMs }) {
  const url = joinUrl(BASE_URL, path);
  const { res, ms, aborted, error } = await timedFetch(
    url,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    timeoutMs
  );

  if (!res) {
    printLine({
      label,
      method,
      path,
      status: null,
      ms,
      ok: false,
      note: aborted ? "(timeout)" : `(error: ${error?.message || "unknown"})`,
    });
    return false;
  }

  const ok = res.status >= 200 && res.status < 400;
  printLine({
    label,
    method,
    path,
    status: res.status,
    ms,
    ok,
  });
  return ok;
}

async function unauthCase({ method, path, timeoutMs = 15000 }) {
  const url = joinUrl(BASE_URL, path);
  const { res, ms, aborted, error } = await timedFetch(url, { method }, timeoutMs);
  if (!res) {
    printLine({
      label: "PUBLIC",
      method,
      path,
      status: null,
      ms,
      ok: false,
      note: aborted ? "(timeout)" : `(error: ${error?.message || "unknown"})`,
    });
    return false;
  }

  let ok = res.status >= 200 && res.status < 400;
  let note = "";
  let fullMs = ms;

  if (ok && path === "/api/system-settings/public") {
    const bodyStart = Date.now();
    const data = await readJsonSafe(res);
    fullMs = ms + (Date.now() - bodyStart);

    const branding = data?.branding && typeof data.branding === "object" ? data.branding : {};
    const ai = data?.ai && typeof data.ai === "object" ? data.ai : {};
    const sidebarIcons = branding?.sidebarIcons && typeof branding.sidebarIcons === "object" ? branding.sidebarIcons : {};

    const dataUrlFields = [];
    for (const key of ["appIcon", "favicon", "logo", "loginBackground", "homeBackground"]) {
      if (String(branding?.[key] || "").startsWith("data:")) {
        dataUrlFields.push(`branding.${key}`);
      }
    }
    if (Object.values(sidebarIcons).some((value) => String(value || "").startsWith("data:"))) {
      dataUrlFields.push("branding.sidebarIcons");
    }
    if (String(ai?.icon || "").startsWith("data:")) {
      dataUrlFields.push("ai.icon");
    }

    const approxBytes = (() => {
      try {
        return Buffer.byteLength(JSON.stringify(data || {}), "utf8");
      } catch {
        return null;
      }
    })();

    if (dataUrlFields.length) {
      ok = false;
      note = `(data-url-assets: ${dataUrlFields.join(", ")})`;
    } else if (approxBytes != null) {
      note = `(bytes=${approxBytes})`;
    }
  }

  printLine({ label: "PUBLIC", method, path, status: res.status, ms: fullMs, ok, note });
  return ok;
}

async function run() {
  console.log(`Live smoke suite [${PROBE_LABEL}] against ${BASE_URL}\n`);

  await unauthCase({ method: "GET", path: "/healthz", timeoutMs: 20000 });
  await unauthCase({ method: "GET", path: "/readyz", timeoutMs: 25000 });
  await unauthCase({ method: "GET", path: "/api/health", timeoutMs: 25000 });
  await unauthCase({ method: "GET", path: "/api/system-settings/public", timeoutMs: 25000 });
  console.log("");

  let failures = 0;
  let executedRoleSuites = 0;

  for (const suite of ROLE_SUITES) {
    if (ROLE_FILTER.size && !ROLE_FILTER.has(suite.label)) continue;
    const identifier = process.env[suite.identifierEnv] || "";
    const password = process.env[suite.passwordEnv] || "";
    if (!identifier || !password) {
      if (REQUIRED_ROLE_SUITES.has(suite.label)) {
        failures += 1;
      }
      console.log(`[SKIP] ${suite.label}: missing ${suite.identifierEnv}/${suite.passwordEnv}`);
      console.log("");
      continue;
    }

    executedRoleSuites += 1;
    const loginRes = await login({ label: suite.label, identifier, password });
    if (!loginRes.ok) {
      failures += 1;
      console.log("");
      continue;
    }

    for (const c of suite.endpoints) {
      const ok = await authedCase({
        label: suite.label,
        token: loginRes.token,
        method: c.method,
        path: c.path,
        timeoutMs: c.timeoutMs || 20000,
      });
      if (!ok) failures += 1;
    }
    console.log("");
  }

  if (REQUIRED_ROLE_SUITES.size) {
    for (const label of REQUIRED_ROLE_SUITES) {
      if (!ROLE_SUITES.some((suite) => suite.label === label)) {
        failures += 1;
        console.error(`Missing configured role suite: ${label}`);
      }
    }
  }

  if (ROLE_FILTER.size && executedRoleSuites === 0) {
    failures += 1;
    console.error("No role suites were executed. Check ROLE_FILTER and credential secrets.");
  }

  if (failures > 0) {
    console.error(`FAIL live-smoke-suite: ${failures} failing checks`);
    process.exit(1);
  }
  console.log("PASS live-smoke-suite");
}

run().catch((err) => {
  console.error("FAIL live-smoke-suite:", err?.message || err);
  process.exit(1);
});
