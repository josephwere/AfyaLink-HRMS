import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

function safeCmd(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "pipe"] })
      .toString("utf8")
      .trim();
  } catch {
    return null;
  }
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
}

const countryDir = path.join(root, "backend", "artifacts", "global-rollout");
const wavesDir = path.join(root, "backend", "ops", "global", "waves");
const execDir = path.join(root, "backend", "artifacts", "global-rollout", "executions");

const countries = fs.existsSync(countryDir)
  ? fs
      .readdirSync(countryDir)
      .filter((name) => fs.statSync(path.join(countryDir, name)).isDirectory() && name !== "executions")
  : [];

const latestWavePlan = (() => {
  const files = listJson(wavesDir).filter((f) => f.startsWith("wave-plan-"));
  return files.length ? files[files.length - 1] : null;
})();

const executions = listJson(execDir);

const snapshot = {
  generatedAt: new Date().toISOString(),
  git: {
    branch: safeCmd("git branch --show-current"),
    commit: safeCmd("git rev-parse --short HEAD"),
  },
  rollout: {
    countryPackCount: countries.length,
    latestWavePlan,
    executionCount: executions.length,
    latestExecution: executions.length ? executions[executions.length - 1] : null,
  },
  launchBlockers: [
    countries.length === 0 ? "No country readiness packs initialized" : null,
    !latestWavePlan ? "No wave plan generated" : null,
  ].filter(Boolean),
};

const outDir = path.join(root, "backend", "artifacts", "launch-command-center");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `snapshot-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2));

if (snapshot.launchBlockers.length) {
  console.log(`WARN launch-command-center-snapshot: blockers detected (${snapshot.launchBlockers.length})`);
  snapshot.launchBlockers.forEach((b) => console.log(` - ${b}`));
}

console.log(`PASS launch-command-center-snapshot: ${path.relative(root, outFile)}`);
