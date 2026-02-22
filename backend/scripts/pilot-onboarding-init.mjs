import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const hospitalName = process.argv[2];
if (!hospitalName) {
  console.error("Usage: node backend/scripts/pilot-onboarding-init.mjs \"Hospital Name\"");
  process.exit(1);
}

const safeName = hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const dir = path.join(root, "backend", "artifacts", "pilot-onboarding", safeName);
fs.mkdirSync(dir, { recursive: true });

const data = {
  hospitalName,
  createdAt: new Date().toISOString(),
  status: "DISCOVERY",
  contacts: {
    executiveSponsor: "",
    technicalLead: "",
    clinicalLead: "",
    securityLead: "",
  },
  milestones: [
    { id: "contract-signoff", done: false },
    { id: "integration-inventory", done: false },
    { id: "role-mapping", done: false },
    { id: "data-migration-dry-run", done: false },
    { id: "training-complete", done: false },
    { id: "go-live", done: false },
  ],
};

fs.writeFileSync(path.join(dir, "onboarding.json"), JSON.stringify(data, null, 2));
fs.copyFileSync(
  path.join(root, "backend", "ops", "pilot", "checklists", "HOSPITAL_ONBOARDING_CHECKLIST.md"),
  path.join(dir, "CHECKLIST.md")
);

console.log(`PASS pilot-onboarding-init: created backend/artifacts/pilot-onboarding/${safeName}`);
