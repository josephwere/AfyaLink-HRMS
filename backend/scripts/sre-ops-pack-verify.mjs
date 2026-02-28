import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const requiredFiles = [
  "backend/docs/SRE_OPERATIONS.md",
  "backend/docs/INCIDENT_COMMAND_RUNBOOK.md",
  "backend/docs/ONCALL_WORKFLOW.md",
  "deploy/observability/prometheus.yml",
  "deploy/observability/alerts/afyalink-alert-rules.yml",
  "deploy/observability/grafana-dashboard-afyalink.json",
];

const missing = requiredFiles.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error("FAIL sre-ops-pack-verify: missing files");
  missing.forEach((m) => console.error(` - ${m}`));
  process.exit(1);
}

const alertRulesPath = path.join(
  root,
  "deploy/observability/alerts/afyalink-alert-rules.yml"
);
const alertText = fs.readFileSync(alertRulesPath, "utf8");

const requiredAlerts = [
  "AfyaLinkAvailabilityBurnFast",
  "AfyaLinkAvailabilityBurnSlow",
  "AfyaLinkApiP95LatencyHigh",
  "AfyaLinkLoginP95LatencyHigh",
];

const missingAlerts = requiredAlerts.filter((name) => !alertText.includes(`alert: ${name}`));
if (missingAlerts.length) {
  console.error("FAIL sre-ops-pack-verify: missing required alert rules");
  missingAlerts.forEach((name) => console.error(` - ${name}`));
  process.exit(1);
}

if (!alertText.includes("runbook_url")) {
  console.error("FAIL sre-ops-pack-verify: alert rules missing runbook annotations");
  process.exit(1);
}

console.log("PASS sre-ops-pack-verify: alert, runbook, and on-call assets are present.");
