import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

function run(cmd) {
  try {
    return {
      ok: true,
      output: execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "pipe"] })
        .toString("utf8")
        .trim(),
    };
  } catch (err) {
    return {
      ok: false,
      output: (err?.stdout?.toString?.("utf8") || "") + (err?.stderr?.toString?.("utf8") || ""),
    };
  }
}

const checks = {
  phase0: run("npm --prefix backend run phase0:gate"),
  phase1: run("npm --prefix backend run phase1:gate"),
  phase2: run("npm --prefix backend run phase2:gate"),
  phase3: run("npm --prefix backend run phase3:gate"),
  phase4: run("npm --prefix backend run phase4:gate"),
  phase5: run("npm --prefix backend run phase5:gate"),
};

const passed = Object.entries(checks)
  .filter(([, v]) => v.ok)
  .map(([k]) => k);
const failed = Object.entries(checks)
  .filter(([, v]) => !v.ok)
  .map(([k]) => k);

const report = {
  generatedAt: new Date().toISOString(),
  git: {
    branch: run("git branch --show-current").output,
    commit: run("git rev-parse --short HEAD").output,
  },
  summary: {
    total: Object.keys(checks).length,
    passed: passed.length,
    failed: failed.length,
    readiness: failed.length === 0 ? "GO" : "NO_GO",
  },
  passed,
  failed,
  checks: Object.fromEntries(
    Object.entries(checks).map(([k, v]) => [k, { ok: v.ok, outputSnippet: String(v.output || "").slice(0, 2000) }])
  ),
};

const outDir = path.join(root, "backend", "artifacts", "executive-reports");
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `readiness-${Date.now()}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 2));

if (report.summary.readiness !== "GO") {
  console.log(`WARN executive-readiness-report: NO_GO (${failed.join(", ")})`);
}

console.log(`PASS executive-readiness-report: ${path.relative(root, file)}`);
