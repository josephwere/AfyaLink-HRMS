import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const rolloutName = process.argv[2] || "global-rollout";
const slug = rolloutName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const outDir = path.join(root, "backend", "artifacts", "postlaunch", slug);
fs.mkdirSync(outDir, { recursive: true });

const plan = {
  rollout: rolloutName,
  createdAt: new Date().toISOString(),
  milestones: [
    { day: 30, review: "Operations stability", owner: "SRE", status: "pending" },
    { day: 60, review: "Integration reliability", owner: "Platform", status: "pending" },
    { day: 90, review: "Business and adoption outcomes", owner: "Program", status: "pending" }
  ],
  kpis: [
    "availability",
    "p95_latency",
    "connector_success_rate",
    "incident_mttr",
    "onboarding_lead_time",
    "active_users_by_role"
  ]
};

fs.writeFileSync(path.join(outDir, "30-60-90-plan.json"), JSON.stringify(plan, null, 2));
console.log(`PASS postlaunch-review-init: ${path.relative(root, outDir)}`);
