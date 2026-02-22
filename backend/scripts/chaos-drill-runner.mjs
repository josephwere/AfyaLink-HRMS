import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const scenariosPath = path.join(root, "backend", "ops", "chaos", "scenarios.json");
const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));

console.log("AfyaLink Chaos Drill Planner");
console.log("============================");
for (const s of scenarios) {
  console.log(`\nScenario: ${s.id}`);
  console.log(`Description: ${s.description}`);
  console.log("Expected checks:");
  for (const e of s.expected) console.log(` - ${e}`);
}

console.log("\nRunbook: backend/docs/SRE_OPERATIONS.md and deploy/dr/dr-drill.sh");
