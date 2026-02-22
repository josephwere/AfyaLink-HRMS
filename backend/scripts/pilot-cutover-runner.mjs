import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const hospitalName = process.argv[2];
if (!hospitalName) {
  console.error('Usage: node backend/scripts/pilot-cutover-runner.mjs "Hospital Name"');
  process.exit(1);
}

const safeName = hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const baseDir = path.join(root, "backend", "artifacts", "pilot-onboarding", safeName);
if (!fs.existsSync(baseDir)) {
  console.error(`FAIL pilot-cutover-runner: onboarding artifact not found for ${safeName}. Run pilot:onboarding:init first.`);
  process.exit(1);
}

const onboardingPath = path.join(baseDir, "onboarding.json");
const onboarding = JSON.parse(fs.readFileSync(onboardingPath, "utf8"));

const now = new Date().toISOString();
onboarding.status = "CUTOVER_IN_PROGRESS";
onboarding.cutover = {
  ...(onboarding.cutover || {}),
  startedAt: now,
  checklist: [
    "Freeze source writes",
    "Run final reconciliation",
    "Switch traffic to AfyaLink",
    "Monitor dashboards for 2h",
    "Capture evidence bundle",
  ],
};

onboarding.milestones = (onboarding.milestones || []).map((m) => {
  if (m.id === "data-migration-dry-run") return { ...m, done: true };
  return m;
});

const report = {
  hospitalName,
  startedAt: now,
  status: "IN_PROGRESS",
  tasks: [
    { id: "freeze", done: false },
    { id: "reconcile", done: false },
    { id: "traffic-switch", done: false },
    { id: "hypercare-watch", done: false },
    { id: "evidence-capture", done: false },
  ],
};

fs.writeFileSync(onboardingPath, JSON.stringify(onboarding, null, 2));
fs.writeFileSync(path.join(baseDir, `cutover-${Date.now()}.json`), JSON.stringify(report, null, 2));

console.log(`PASS pilot-cutover-runner: cutover artifact created for ${hospitalName}`);
