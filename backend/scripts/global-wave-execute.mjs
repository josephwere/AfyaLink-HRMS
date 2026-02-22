import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const waveArg = Number(process.argv[2]);
if (!Number.isFinite(waveArg) || waveArg < 1) {
  console.error("Usage: node backend/scripts/global-wave-execute.mjs <waveNumber>");
  process.exit(1);
}

const wavesDir = path.join(root, "backend", "ops", "global", "waves");
if (!fs.existsSync(wavesDir)) {
  console.error("FAIL global-wave-execute: no wave plans found");
  process.exit(1);
}

const files = fs
  .readdirSync(wavesDir)
  .filter((f) => f.startsWith("wave-plan-") && f.endsWith(".json"))
  .sort();

if (!files.length) {
  console.error("FAIL global-wave-execute: no wave plans found");
  process.exit(1);
}

const latest = files[files.length - 1];
const latestPath = path.join(wavesDir, latest);
const plan = JSON.parse(fs.readFileSync(latestPath, "utf8"));

const wave = (plan.waves || []).find((w) => Number(w.wave) === waveArg);
if (!wave) {
  console.error(`FAIL global-wave-execute: wave ${waveArg} not found in ${latest}`);
  process.exit(1);
}

wave.status = "IN_PROGRESS";
wave.startedAt = new Date().toISOString();

const execDir = path.join(root, "backend", "artifacts", "global-rollout", "executions");
fs.mkdirSync(execDir, { recursive: true });

const execution = {
  wave: wave.wave,
  countries: wave.countries,
  startedAt: wave.startedAt,
  status: wave.status,
  sourcePlan: latest,
};

const execFile = path.join(execDir, `wave-${wave.wave}-${Date.now()}.json`);
fs.writeFileSync(execFile, JSON.stringify(execution, null, 2));
fs.writeFileSync(latestPath, JSON.stringify(plan, null, 2));

console.log(`PASS global-wave-execute: started wave ${wave.wave} from ${latest}`);
console.log(`Execution artifact: ${path.relative(root, execFile)}`);
