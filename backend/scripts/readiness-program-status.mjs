import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const requiredDocs = [
  "backend/docs/GLOBAL_READINESS_PROGRAM.md",
  "backend/docs/MULTI_REGION_ARCHITECTURE.md",
  "backend/docs/SRE_OPERATIONS.md",
  "backend/docs/COMPLIANCE_DATA_RESIDENCY_MATRIX.md",
  "backend/docs/INTEGRATION_SLA_AND_MIGRATION_PLAYBOOK.md",
  "backend/docs/SECURITY_HARDENING_PROGRAM.md",
  "backend/docs/PERFORMANCE_CAPACITY_PLAN.md",
  "backend/docs/CUSTOMER_OPERATIONS_PLAYBOOK.md",
  "deploy/nginx/afyalink-multiregion.conf",
  "deploy/haproxy/haproxy-multiregion.cfg",
];

const missing = requiredDocs.filter((p) => !fs.existsSync(path.join(root, p)));

if (missing.length) {
  console.error("FAIL readiness-program-status: missing assets:");
  for (const item of missing) console.error(` - ${item}`);
  process.exit(1);
}

console.log("PASS readiness-program-status: all readiness assets present.");
console.log("Next gates:");
console.log("  1) npm --prefix backend run security:gate");
console.log("  2) npm --prefix backend test");
console.log("  3) npm --prefix frontend run build");
console.log("  4) npm --prefix backend run preprod:preflight");
