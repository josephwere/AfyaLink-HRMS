import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(root, "backend", "artifacts", "compliance", stamp);
fs.mkdirSync(outDir, { recursive: true });

function cmd(command, timeoutMs = 180000) {
  try {
    return execSync(command, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    })
      .toString("utf8")
      .trim();
  } catch (err) {
    const out = err?.stdout?.toString?.("utf8") || "";
    const stderr = err?.stderr?.toString?.("utf8") || "";
    return `ERROR: ${err.message}\nSTDOUT:\n${out}\nSTDERR:\n${stderr}`.trim();
  }
}

const full = process.argv.includes("--full");

const manifest = {
  generatedAt: new Date().toISOString(),
  mode: full ? "full" : "light",
  git: {
    branch: cmd("git branch --show-current"),
    commit: cmd("git rev-parse HEAD"),
    status: cmd("git status --short"),
  },
  checks: {
    readinessProgram: cmd("npm --prefix backend run readiness:program"),
    ...(full
      ? {
          securityGate: cmd("npm --prefix backend run security:gate"),
          backendTests: cmd("npm --prefix backend test"),
          frontendBuild: cmd("npm --prefix frontend run build"),
          preprodPreflight: cmd("npm --prefix backend run preprod:preflight"),
        }
      : {}),
  },
  references: [
    "backend/docs/COMPLIANCE_DATA_RESIDENCY_MATRIX.md",
    "backend/docs/SECURITY_HARDENING_PROGRAM.md",
    "backend/docs/SRE_OPERATIONS.md",
    "backend/docs/INTEGRATION_SLA_AND_MIGRATION_PLAYBOOK.md",
    "backend/docs/PRODUCTION_RUNBOOK.md",
  ],
};

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const evidenceReadme = `# Compliance Evidence Pack\n\nGenerated: ${manifest.generatedAt}\n\nThis folder contains a point-in-time evidence manifest for audits and pilot governance.\n\n- manifest.json: command outputs + references\n`;
fs.writeFileSync(path.join(outDir, "README.md"), evidenceReadme);

console.log(`PASS compliance-evidence-pack: ${path.relative(root, outDir)}`);
