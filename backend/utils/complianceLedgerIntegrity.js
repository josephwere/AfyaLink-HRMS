import ComplianceLedger from "../models/ComplianceLedger.js";
import { verifyComplianceLedger } from "./complianceLedger.js";

export async function assertComplianceLedgerIntegrity(options = {}) {
  const result = await verifyComplianceLedger(options);
  if (!result.ok) {
    const error = new Error("Compliance ledger integrity check failed");
    error.code = "COMPLIANCE_LEDGER_INTEGRITY_FAILED";
    error.details = result;
    throw error;
  }
  return result;
}

export async function getLedgerIntegritySummary() {
  const tenants = await ComplianceLedger.distinct("tenantKey");
  const results = await Promise.all(tenants.map((tenantKey) => verifyComplianceLedger({ tenantKey })));
  return {
    ok: results.every((result) => result.ok),
    tenants: results.length,
    checked: results.reduce((total, result) => total + result.checked, 0),
    failures: results.flatMap((result) => result.failures),
  };
}
