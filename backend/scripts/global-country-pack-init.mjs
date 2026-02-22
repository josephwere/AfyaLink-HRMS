import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const country = process.argv[2];
if (!country) {
  console.error('Usage: node backend/scripts/global-country-pack-init.mjs "Country Code or Name"');
  process.exit(1);
}

const slug = country.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const outDir = path.join(root, "backend", "artifacts", "global-rollout", slug);
fs.mkdirSync(outDir, { recursive: true });

const checklistTemplate = path.join(root, "backend", "ops", "global", "country-pack-template", "COUNTRY_READINESS_CHECKLIST.md");
const legalTemplate = path.join(root, "backend", "ops", "global", "country-pack-template", "LEGAL_REGULATORY_MATRIX.json");

fs.copyFileSync(checklistTemplate, path.join(outDir, "COUNTRY_READINESS_CHECKLIST.md"));
fs.copyFileSync(legalTemplate, path.join(outDir, "LEGAL_REGULATORY_MATRIX.json"));

const manifest = {
  country,
  slug,
  createdAt: new Date().toISOString(),
  status: "DISCOVERY",
  workstreams: {
    legal: "pending",
    dataResidency: "pending",
    integrations: "pending",
    security: "pending",
    support: "pending",
  },
};

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`PASS global-country-pack-init: backend/artifacts/global-rollout/${slug}`);
