#!/usr/bin/env node

import fs from "fs";
import path from "path";

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
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || BASE_URL;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "";
const PROBE_LABEL = process.env.PROBE_LABEL || "default";
const PROBE_REGION = process.env.PROBE_REGION || "global-default";
const SUMMARY_PATH = process.env.SMOKE_SUMMARY_PATH || "";
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

const FRONTEND_PUBLIC_CASES = [
  {
    label: "FRONTEND",
    method: "GET",
    path: "/login",
    timeoutMs: 20000,
    latencyBudgetMs: 6000,
    accept: "text/html",
    expectedContentType: "text/html",
  },
  {
    label: "FRONTEND",
    method: "GET",
    path: "/app/platform/home/index",
    timeoutMs: 20000,
    latencyBudgetMs: 6000,
    accept: "text/html",
    expectedContentType: "text/html",
  },
  {
    label: "FRONTEND",
    method: "GET",
    path: "/health",
    timeoutMs: 15000,
    latencyBudgetMs: 4000,
  },
  {
    label: "FRONTEND",
    method: "GET",
    path: "/healthz",
    timeoutMs: 20000,
    latencyBudgetMs: 4000,
  },
  {
    label: "FRONTEND",
    method: "GET",
    path: "/readyz",
    timeoutMs: 25000,
    latencyBudgetMs: 5000,
  },
  {
    label: "FRONTEND",
    method: "GET",
    path: "/api/health",
    timeoutMs: 25000,
    latencyBudgetMs: 5000,
  },
  {
    label: "FRONTEND",
    method: "GET",
    path: "/api/system-settings/public",
    timeoutMs: 25000,
    latencyBudgetMs: 6000,
  },
];

const BACKEND_PUBLIC_CASES = [
  {
    label: "BACKEND",
    method: "GET",
    path: "/health",
    timeoutMs: 15000,
    latencyBudgetMs: 3000,
  },
  {
    label: "BACKEND",
    method: "GET",
    path: "/healthz",
    timeoutMs: 20000,
    latencyBudgetMs: 3000,
  },
  {
    label: "BACKEND",
    method: "GET",
    path: "/readyz",
    timeoutMs: 25000,
    latencyBudgetMs: 4000,
  },
  {
    label: "BACKEND",
    method: "GET",
    path: "/api/health",
    timeoutMs: 25000,
    latencyBudgetMs: 4000,
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

function recordResult(results, result) {
  results.push(result);
  printLine(result);
  return result;
}

function appendNote(existingNote = "", nextNote = "") {
  if (!nextNote) return existingNote;
  return existingNote ? `${existingNote} ${nextNote}` : nextNote;
}

async function login({ label, identifier, password }) {
  const url = joinUrl(FRONTEND_BASE_URL, "/api/auth/login");
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
    return {
      ok: false,
      canContinue: false,
      token: "",
      result: {
        label,
        method: "POST",
        path: "/api/auth/login",
        status: null,
        ms,
        ok: false,
        note: aborted ? "(timeout)" : `(error: ${error?.message || "unknown"})`,
      },
    };
  }

  const data = await readJsonSafe(res);
  const ok = res.ok && Boolean(data?.accessToken || data?.requires2FA);
  const latencyBudgetMs = 10000;
  let note = data?.requires2FA ? "(2fa-required)" : "";
  let finalOk = ok && !data?.requires2FA;
  if (ms > latencyBudgetMs) {
    finalOk = false;
    note = appendNote(note, `(over-budget>${latencyBudgetMs}ms)`);
  }

  if (!res.ok || data?.requires2FA) {
    return {
      ok: false,
      canContinue: false,
      token: "",
      result: {
        label,
        method: "POST",
        path: "/api/auth/login",
        status: res.status,
        ms,
        ok: finalOk,
        note,
      },
    };
  }

  return {
    ok: finalOk,
    canContinue: true,
    token: String(data.accessToken || ""),
    result: {
      label,
      method: "POST",
      path: "/api/auth/login",
      status: res.status,
      ms,
      ok: finalOk,
      note,
    },
  };
}

async function authedCase({ label, token, method, path, timeoutMs, latencyBudgetMs = 0 }) {
  const url = joinUrl(FRONTEND_BASE_URL, path);
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
    return {
      label,
      method,
      path,
      status: null,
      ms,
      ok: false,
      note: aborted ? "(timeout)" : `(error: ${error?.message || "unknown"})`,
    };
  }

  let ok = res.status >= 200 && res.status < 400;
  let note = "";
  if (latencyBudgetMs > 0 && ms > latencyBudgetMs) {
    ok = false;
    note = `(over-budget>${latencyBudgetMs}ms)`;
  }
  return {
    label,
    method,
    path,
    status: res.status,
    ms,
    ok,
    note,
  };
}

async function publicCase({
  baseUrl,
  label,
  method,
  path,
  timeoutMs = 15000,
  latencyBudgetMs = 0,
  accept = "application/json",
  expectedContentType = "",
}) {
  const url = joinUrl(baseUrl, path);
  const { res, ms, aborted, error } = await timedFetch(
    url,
    {
      method,
      headers: { Accept: accept },
    },
    timeoutMs
  );
  if (!res) {
    return {
      label,
      method,
      path,
      status: null,
      ms,
      ok: false,
      note: aborted ? "(timeout)" : `(error: ${error?.message || "unknown"})`,
    };
  }

  let ok = res.status >= 200 && res.status < 400;
  let note = "";
  let fullMs = ms;

  if (expectedContentType) {
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes(String(expectedContentType).toLowerCase())) {
      ok = false;
      note = appendNote(note, `(content-type=${contentType || "missing"})`);
    }
  }

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

  if (latencyBudgetMs > 0 && fullMs > latencyBudgetMs) {
    ok = false;
    note = appendNote(note, `(over-budget>${latencyBudgetMs}ms)`);
  }

  return { label, method, path, status: res.status, ms: fullMs, ok, note };
}

function writeSummary(results, failures, executedRoleSuites) {
  if (!SUMMARY_PATH) return;
  const payload = {
    ok: failures === 0,
    probeLabel: PROBE_LABEL,
    probeRegion: PROBE_REGION,
    frontendBaseUrl: FRONTEND_BASE_URL,
    backendBaseUrl: BACKEND_BASE_URL || null,
    checkedAt: new Date().toISOString(),
    failures,
    executedRoleSuites,
    results,
  };
  const targetDir = path.dirname(SUMMARY_PATH);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function run() {
  console.log(`Live smoke suite [${PROBE_LABEL}] frontend=${FRONTEND_BASE_URL}${BACKEND_BASE_URL ? ` backend=${BACKEND_BASE_URL}` : ""}\n`);

  const results = [];

  for (const c of FRONTEND_PUBLIC_CASES) {
    const result = await publicCase({ ...c, baseUrl: FRONTEND_BASE_URL });
    recordResult(results, result);
  }

  if (BACKEND_BASE_URL && BACKEND_BASE_URL !== FRONTEND_BASE_URL) {
    for (const c of BACKEND_PUBLIC_CASES) {
      const result = await publicCase({ ...c, baseUrl: BACKEND_BASE_URL });
      recordResult(results, result);
    }
  }
  console.log("");

  let failures = results.filter((item) => !item.ok).length;
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
    recordResult(results, loginRes.result);
    if (!loginRes.result.ok) {
      failures += 1;
    }
    if (!loginRes.canContinue) {
      console.log("");
      continue;
    }

    for (const c of suite.endpoints) {
      const result = await authedCase({
        label: suite.label,
        token: loginRes.token,
        method: c.method,
        path: c.path,
        timeoutMs: c.timeoutMs || 20000,
        latencyBudgetMs: c.latencyBudgetMs || 0,
      });
      recordResult(results, result);
      if (!result.ok) failures += 1;
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

  writeSummary(results, failures, executedRoleSuites);

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
