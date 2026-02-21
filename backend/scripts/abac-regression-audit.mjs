#!/usr/bin/env node

import dotenv from "dotenv";
import mongoose from "mongoose";
import AbacPolicyTestCase from "../models/AbacPolicyTestCase.js";
import { evaluateAbac } from "../utils/abacEngine.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/afyalink";
const FAIL_ON_EMPTY = process.env.ABAC_FAIL_ON_EMPTY === "1";

function formatExpected(expected = {}) {
  if (typeof expected.allowed !== "boolean") return "ANY";
  return `${expected.allowed ? "ALLOW" : "DENY"}${expected.reason ? `/${expected.reason}` : ""}`;
}

async function runCase(row) {
  const input = row.input || {};
  const result = await evaluateAbac({
    domain: String(input.domain || "").toUpperCase(),
    resource: String(input.resource || ""),
    action: String(input.action || ""),
    includeTrace: false,
    fallbackAllow: false,
    req: {
      user: { role: String(input.role || "").toUpperCase() },
      resource: {
        sameHospital: input.sameHospital === true,
        hasActiveConsent: input.hasActiveConsent === true,
        sourceHospitalBypass: input.sourceHospitalBypass === true,
        allowedScopes: Array.isArray(input.allowedScopes)
          ? input.allowedScopes.map((s) => String(s).toLowerCase())
          : [],
      },
    },
  });

  const expectedAllowed = row.expected?.allowed;
  const expectedReason = String(row.expected?.reason || "");
  const passed =
    typeof expectedAllowed !== "boolean"
      ? true
      : result.allowed === expectedAllowed &&
        (!expectedReason || expectedReason === String(result.reason || ""));

  row.lastRunAt = new Date();
  row.lastRun = {
    passed,
    allowed: result.allowed,
    reason: result.reason || "",
    matchedPolicyId: result?.matchedPolicy?._id || null,
  };
  await row.save();

  return {
    id: row._id,
    name: row.name,
    passed,
    expected: formatExpected(row.expected),
    actual: `${result.allowed ? "ALLOW" : "DENY"}${result.reason ? `/${result.reason}` : ""}`,
  };
}

async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    const rows = await AbacPolicyTestCase.find({ active: true }).sort({ updatedAt: -1 });
    if (rows.length === 0) {
      const msg = "No active ABAC test cases found.";
      if (FAIL_ON_EMPTY) {
        console.error(`FAIL abac-regression-audit: ${msg}`);
        process.exit(1);
      }
      console.log(`PASS abac-regression-audit: ${msg}`);
      return;
    }

    let passed = 0;
    let failed = 0;

    for (const row of rows) {
      const outcome = await runCase(row);
      if (outcome.passed) passed += 1;
      else failed += 1;
      console.log(
        `[${outcome.passed ? "PASS" : "FAIL"}] ${outcome.name} expected=${outcome.expected} actual=${outcome.actual}`
      );
    }

    if (failed > 0) {
      console.error(`FAIL abac-regression-audit: ${passed} passed, ${failed} failed`);
      process.exit(1);
    }

    console.log(`PASS abac-regression-audit: ${passed} passed, ${failed} failed`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("FAIL abac-regression-audit:", err?.message || err);
  process.exit(1);
});

