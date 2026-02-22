import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const required = [
  "backend/docs/GLOBAL_READINESS_PROGRAM.md",
  "backend/docs/COMPLIANCE_DATA_RESIDENCY_MATRIX.md",
  "backend/docs/SECURITY_HARDENING_PROGRAM.md",
  "backend/docs/SRE_OPERATIONS.md",
  "backend/docs/PHASE3_EXECUTION.md",
  "backend/docs/PHASE4_EXECUTION.md",
  "deploy/observability/prometheus.yml",
  "deploy/observability/grafana-dashboard-afyalink.json",
  "deploy/dr/dr-drill.sh",
];

const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error("FAIL global-readiness-verify: missing assets");
  missing.forEach((m) => console.error(` - ${m}`));
  process.exit(1);
}

const rolloutRoot = path.join(root, "backend", "artifacts", "global-rollout");
if (!fs.existsSync(rolloutRoot)) {
  console.log("PASS global-readiness-verify: base assets present (no country packs yet)");
  process.exit(0);
}

const countryDirs = fs.readdirSync(rolloutRoot).filter((name) => fs.statSync(path.join(rolloutRoot, name)).isDirectory());
const invalid = [];
for (const c of countryDirs) {
  const hasManifest = fs.existsSync(path.join(rolloutRoot, c, "manifest.json"));
  const hasChecklist = fs.existsSync(path.join(rolloutRoot, c, "COUNTRY_READINESS_CHECKLIST.md"));
  const hasLegal = fs.existsSync(path.join(rolloutRoot, c, "LEGAL_REGULATORY_MATRIX.json"));
  if (!(hasManifest && hasChecklist && hasLegal)) invalid.push(c);
}

if (invalid.length) {
  console.error("FAIL global-readiness-verify: invalid country packs");
  invalid.forEach((c) => console.error(` - ${c}`));
  process.exit(1);
}

console.log(`PASS global-readiness-verify: ${countryDirs.length} country packs valid`);
