import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const required = [
  "backend/docs/PHASE5_EXECUTION.md",
  "backend/scripts/global-wave-execute.mjs",
  "backend/scripts/launch-command-center-snapshot.mjs",
  "backend/scripts/phase5-launch-verify.mjs",
];

const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error("FAIL phase5-launch-verify: missing assets");
  missing.forEach((m) => console.error(` - ${m}`));
  process.exit(1);
}

const wavesDir = path.join(root, "backend", "ops", "global", "waves");
const hasWavePlan = fs.existsSync(wavesDir) && fs.readdirSync(wavesDir).some((f) => f.startsWith("wave-plan-") && f.endsWith(".json"));

const countryDir = path.join(root, "backend", "artifacts", "global-rollout");
const hasCountry = fs.existsSync(countryDir) && fs.readdirSync(countryDir).some((name) => {
  const p = path.join(countryDir, name);
  return fs.statSync(p).isDirectory() && name !== "executions";
});

if (!hasWavePlan || !hasCountry) {
  console.error("FAIL phase5-launch-verify: rollout prerequisites missing");
  if (!hasCountry) console.error(" - No country readiness pack found");
  if (!hasWavePlan) console.error(" - No wave plan found");
  process.exit(1);
}

console.log("PASS phase5-launch-verify: launch prerequisites satisfied");
