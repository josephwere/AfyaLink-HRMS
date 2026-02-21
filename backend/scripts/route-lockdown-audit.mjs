#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ROUTES_DIR = path.join(ROOT, "routes");
const CONTROLLERS_DIR = path.join(ROOT, "controllers");

const authTokens = [
  "protect",
  "requireAuth",
  "externalAccessGuard",
  "authorize(",
  "permit(",
];

const publicAllowlist = new Set([
  // auth public flows
  "authRoutes.js:POST:/google",
  "authRoutes.js:POST:/register",
  "authRoutes.js:POST:/login",
  "authRoutes.js:POST:/refresh",
  "authRoutes.js:GET:/verify-email",
  "authRoutes.js:POST:/resend-verification",
  "authRoutes.js:POST:/2fa/verify",
  "authRoutes.js:POST:/2fa/resend",

  // payment/webhook callbacks
  "paymentRoutes.js:POST:/mpesa/callback",
  "paymentRoutes.js:POST:/stripe/webhook",
  "paymentRoutes.js:POST:/flutter/webhook",
  "mpesa.routes.js:POST:/callback",
  "flutterwaveRoutes.js:POST:/callback",
  "webhookReceiverRoutes.js:POST:/:source",
  "webhookReceiverRoutes.js:GET:/ping",
  "integrationWebhookRoutes.js:POST:/:connectorId",

  // AI public triage endpoints
  "aiRoutes.js:GET:/slot",
  "aiRoutes.js:POST:/risk",
  "triageRoutes.js:POST:/classify",
  "triageRoutes.js:POST:/transcribe",
]);

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listRouteFiles() {
  return fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(ROUTES_DIR, f))
    .sort();
}

function hasGlobalProtect(content) {
  return /router\.use\([\s\S]*?\bprotect\b[\s\S]*?\)/m.test(content);
}

function parseRouteCalls(content) {
  const calls = [];
  const re = /router\.(get|post|put|patch|delete)\(([\s\S]*?)\);/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const method = m[1].toUpperCase();
    const block = m[2];
    const pathMatch = block.match(/^\s*["'`]([^"'`]+)["'`]\s*,?/);
    const routePath = pathMatch ? pathMatch[1] : "<unknown>";
    calls.push({ method, routePath, block });
  }
  return calls;
}

function blockHasAuth(block) {
  return authTokens.some((t) => block.includes(t));
}

function validateRouteAuth() {
  const errors = [];
  const files = listRouteFiles();

  for (const filePath of files) {
    const file = path.basename(filePath);
    const content = readFile(filePath);
    const globalProtect = hasGlobalProtect(content);
    const calls = parseRouteCalls(content);

    for (const c of calls) {
      const key = `${file}:${c.method}:${c.routePath}`;
      if (publicAllowlist.has(key)) continue;

      const hasAuth = globalProtect || blockHasAuth(c.block);
      if (!hasAuth) {
        errors.push(
          `[ROUTE_AUTH] Missing auth middleware: ${file} ${c.method} ${c.routePath}`
        );
      }
    }
  }

  return errors;
}

function validateExportGuards() {
  const errors = [];

  const adminVerification = readFile(
    path.join(CONTROLLERS_DIR, "adminVerificationController.js")
  );
  if (!adminVerification.includes("recordExportEvent")) {
    errors.push("[EXPORT_AUDIT] adminVerificationController missing recordExportEvent");
  }
  if (!/maxRows\s*=\s*Math\.min\(/.test(adminVerification)) {
    errors.push("[EXPORT_GUARD] adminVerificationController missing maxRows cap");
  }

  const transactionsRoutes = readFile(path.join(ROUTES_DIR, "transactionsRoutes.js"));
  if (!transactionsRoutes.includes("recordExportEvent")) {
    errors.push("[EXPORT_AUDIT] transactionsRoutes missing recordExportEvent");
  }
  if (!transactionsRoutes.includes("Export date range too large")) {
    errors.push("[EXPORT_GUARD] transactionsRoutes missing export date range guard");
  }

  const reportsController = readFile(path.join(CONTROLLERS_DIR, "reportsController.js"));
  if (!reportsController.includes("EXPORT_MEDICAL_REPORT_PDF")) {
    errors.push("[EXPORT_AUDIT] reportsController missing medical PDF export audit");
  }

  const billingController = readFile(path.join(CONTROLLERS_DIR, "billingController.js"));
  if (!billingController.includes("EXPORT_INVOICE_PDF")) {
    errors.push("[EXPORT_AUDIT] billingController missing invoice PDF export audit");
  }

  const transferController = readFile(path.join(CONTROLLERS_DIR, "transferController.js"));
  if (!transferController.includes("TRANSFER_FHIR_EXPORTED")) {
    errors.push("[EXPORT_AUDIT] transferController missing FHIR export audit");
  }
  if (!transferController.includes("TRANSFER_HL7_EXPORTED")) {
    errors.push("[EXPORT_AUDIT] transferController missing HL7 export audit");
  }
  if (!transferController.includes("No allowed FHIR fields for current consent scopes")) {
    errors.push("[CONSENT_SCOPE] transferController missing FHIR consent-scope enforcement");
  }
  if (!transferController.includes("No allowed HL7 fields for current consent scopes")) {
    errors.push("[CONSENT_SCOPE] transferController missing HL7 consent-scope enforcement");
  }

  return errors;
}

function main() {
  const routeErrors = validateRouteAuth();
  const exportErrors = validateExportGuards();
  const all = [...routeErrors, ...exportErrors];

  if (all.length === 0) {
    console.log("PASS route-lockdown-audit: auth + export guardrails are consistent.");
    process.exit(0);
  }

  console.error("FAIL route-lockdown-audit");
  for (const err of all) {
    console.error(` - ${err}`);
  }
  process.exit(1);
}

main();
