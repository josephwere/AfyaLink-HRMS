#!/usr/bin/env node

/**
 * AuthZ regression checker for protected API endpoints.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 node scripts/authz-regression.mjs
 *
 * Optional tokens for 403 checks:
 *   LOW_PRIV_TOKEN=<patient_or_low_role_jwt>
 *   HIGH_PRIV_TOKEN=<admin_jwt> (for optional sanity checks)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const LOW_PRIV_TOKEN = process.env.LOW_PRIV_TOKEN || "";
const HIGH_PRIV_TOKEN = process.env.HIGH_PRIV_TOKEN || "";

const noAuthMatrix = [
  { method: "GET", path: "/api/system-settings", expected: [401] },
  { method: "GET", path: "/api/audit", expected: [401] },
  { method: "GET", path: "/api/reports", expected: [401] },
  { method: "GET", path: "/api/reports/mine", expected: [401] },
  { method: "GET", path: "/api/reports/medical/000000000000000000000001", expected: [401] },
  { method: "GET", path: "/api/medical-legal/000000000000000000000001/export", expected: [401] },
  { method: "GET", path: "/api/transfers", expected: [401] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/fhir", expected: [401] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/hl7", expected: [401] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/audit", expected: [401] },
  { method: "GET", path: "/api/transactions", expected: [401] },
  { method: "GET", path: "/api/transactions?exportCsv=1", expected: [401] },
  { method: "GET", path: "/api/billing/list", expected: [401] },
  { method: "GET", path: "/api/billing/invoice/000000000000000000000001", expected: [401] },
  { method: "GET", path: "/api/admin/export/unverified-users", expected: [401] },
  { method: "GET", path: "/api/admin/export/unverified-users?days=14&maxRows=100", expected: [401] },
  { method: "GET", path: "/api/workforce/leave", expected: [401] },
  { method: "GET", path: "/api/workforce/overtime", expected: [401] },
  { method: "GET", path: "/api/workforce/shifts", expected: [401] },
  { method: "GET", path: "/api/workforce/pending?kind=LEAVE", expected: [401] },
  { method: "GET", path: "/api/workforce/sla/policies", expected: [401] },
  { method: "GET", path: "/api/workforce/queue-insights", expected: [401] },
  { method: "GET", path: "/api/workforce/automation/policies", expected: [401] },
  { method: "GET", path: "/api/workforce/automation/preview", expected: [401] },
  { method: "POST", path: "/api/workforce/automation/simulate", expected: [401] },
  { method: "POST", path: "/api/workforce/automation/sweep", expected: [401] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/consent", expected: [401] },
  { method: "GET", path: "/api/hospitals", expected: [401] },
  { method: "GET", path: "/api/developer/trust-status", expected: [401] },
  { method: "POST", path: "/api/developer/workflow-sla/run", expected: [401] },
  { method: "GET", path: "/api/system-admin/risk-policy", expected: [401] },
  { method: "PUT", path: "/api/system-admin/risk-policy", expected: [401] },
  { method: "GET", path: "/api/auth/session-risk", expected: [401] },
  { method: "GET", path: "/api/integrations/dlq", expected: [401] },
  { method: "GET", path: "/api/integrations/dlq-inspect", expected: [401] },
  { method: "GET", path: "/api/integrations/dlq-admin", expected: [401] },
  { method: "GET", path: "/api/connectors", expected: [401] },
  { method: "GET", path: "/api/offline/status", expected: [401] },
  { method: "GET", path: "/api/signaling/token", expected: [401] },
  { method: "GET", path: "/api/crdt-api/patients", expected: [401] },
];

const lowPrivMatrix = [
  { method: "GET", path: "/api/system-settings", expected: [403] },
  { method: "GET", path: "/api/audit", expected: [403] },
  { method: "GET", path: "/api/reports", expected: [403] },
  { method: "GET", path: "/api/reports/medical/000000000000000000000001", expected: [403] },
  { method: "GET", path: "/api/medical-legal/000000000000000000000001/export", expected: [403] },
  { method: "GET", path: "/api/transfers", expected: [403] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/fhir", expected: [403] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/hl7", expected: [403] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/audit", expected: [403] },
  { method: "GET", path: "/api/transactions", expected: [403] },
  { method: "GET", path: "/api/transactions?exportCsv=1", expected: [403] },
  { method: "GET", path: "/api/billing/list", expected: [403] },
  { method: "GET", path: "/api/billing/invoice/000000000000000000000001", expected: [403] },
  { method: "GET", path: "/api/admin/export/unverified-users", expected: [403] },
  { method: "GET", path: "/api/admin/export/unverified-users?days=14&maxRows=100", expected: [403] },
  { method: "GET", path: "/api/workforce/leave", expected: [403] },
  { method: "GET", path: "/api/workforce/overtime", expected: [403] },
  { method: "GET", path: "/api/workforce/shifts", expected: [403] },
  { method: "GET", path: "/api/workforce/pending?kind=LEAVE", expected: [403] },
  { method: "GET", path: "/api/workforce/sla/policies", expected: [403] },
  { method: "GET", path: "/api/workforce/queue-insights", expected: [403] },
  { method: "GET", path: "/api/workforce/automation/policies", expected: [403] },
  { method: "GET", path: "/api/workforce/automation/preview", expected: [403] },
  { method: "POST", path: "/api/workforce/automation/simulate", expected: [403] },
  { method: "POST", path: "/api/workforce/automation/sweep", expected: [403] },
  { method: "GET", path: "/api/transfers/000000000000000000000001/consent", expected: [403] },
  { method: "GET", path: "/api/developer/trust-status", expected: [403] },
  { method: "POST", path: "/api/developer/workflow-sla/run", expected: [403] },
  { method: "GET", path: "/api/system-admin/risk-policy", expected: [403] },
  { method: "PUT", path: "/api/system-admin/risk-policy", expected: [403] },
  { method: "GET", path: "/api/integrations/dlq", expected: [403] },
  { method: "GET", path: "/api/integrations/dlq-inspect", expected: [403] },
  { method: "GET", path: "/api/integrations/dlq-admin", expected: [403] },
  { method: "GET", path: "/api/connectors", expected: [403] },
  { method: "GET", path: "/api/offline/status", expected: [403] },
  { method: "GET", path: "/api/crdt-api/patients", expected: [403] },
];

const highPrivSanity = [
  { method: "GET", path: "/api/system-settings", expected: [200] },
  { method: "GET", path: "/api/developer/trust-status", expected: [200] },
  { method: "POST", path: "/api/developer/workflow-sla/run", expected: [200] },
  { method: "GET", path: "/api/workforce/queue-insights", expected: [200] },
];

async function runCase({ method, path, expected, token = "" }) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers });
  const ok = expected.includes(res.status);
  return { ok, status: res.status, method, path, expected };
}

function printResult(r, label) {
  const mark = r.ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${label} ${r.method} ${r.path} -> ${r.status} (expected: ${r.expected.join("/")})`);
}

async function runSuite(cases, label, token = "") {
  const results = [];
  for (const c of cases) {
    try {
      const r = await runCase({ ...c, token });
      printResult(r, label);
      results.push(r);
    } catch (err) {
      const fail = { ok: false, status: "ERR", method: c.method, path: c.path, expected: c.expected };
      printResult(fail, label);
      console.error(`  error: ${err.message}`);
      results.push(fail);
    }
  }
  return results;
}

function summarize(all) {
  const total = all.length;
  const failed = all.filter((r) => !r.ok).length;
  const passed = total - failed;
  console.log(`\nSummary: ${passed}/${total} passed, ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log(`AuthZ regression against ${BASE_URL}`);

  const all = [];
  all.push(...(await runSuite(noAuthMatrix, "NO_AUTH")));

  if (LOW_PRIV_TOKEN) {
    all.push(...(await runSuite(lowPrivMatrix, "LOW_PRIV", LOW_PRIV_TOKEN)));
  } else {
    console.log("\nLOW_PRIV_TOKEN not set; skipping 403 low-priv suite.");
  }

  if (HIGH_PRIV_TOKEN) {
    all.push(...(await runSuite(highPrivSanity, "HIGH_PRIV", HIGH_PRIV_TOKEN)));
  } else {
    console.log("HIGH_PRIV_TOKEN not set; skipping high-priv sanity suite.");
  }

  const ok = summarize(all);
  process.exit(ok ? 0 : 1);
}

main();
