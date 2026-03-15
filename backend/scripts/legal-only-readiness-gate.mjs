import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveRepoRoot() {
  const cwd = process.cwd();
  const cwdHasRootLayout =
    fs.existsSync(path.join(cwd, "backend", "package.json")) &&
    fs.existsSync(path.join(cwd, "frontend", "package.json"));
  if (cwdHasRootLayout) return cwd;

  const backendParent = path.resolve(cwd, "..");
  const backendDirLayout =
    fs.existsSync(path.join(cwd, "package.json")) &&
    fs.existsSync(path.join(backendParent, "frontend", "package.json"));
  if (backendDirLayout) return backendParent;

  const scriptDerived = path.resolve(__dirname, "..", "..");
  const scriptHasRootLayout =
    fs.existsSync(path.join(scriptDerived, "backend", "package.json")) &&
    fs.existsSync(path.join(scriptDerived, "frontend", "package.json"));
  if (scriptHasRootLayout) return scriptDerived;

  throw new Error("Could not resolve AfyaLink repo root for readiness gate.");
}

const repoRoot = resolveRepoRoot();
const backendEnvPath = path.join(repoRoot, "backend", ".env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

function run(label, cmd) {
  try {
    execSync(cmd, { stdio: "inherit", cwd: repoRoot });
    return { label, ok: true };
  } catch (err) {
    return { label, ok: false, error: err?.message || String(err) };
  }
}

const steps = [
  ["phase6 gate", "npm --prefix backend run phase6:gate"],
  ["frontend build", "npm --prefix frontend run build"],
  ["backend preprod preflight", "npm --prefix backend run preprod:preflight"],
];

const requiredProdEnv = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "FRONTEND_URL",
  "CLAIM_SECRET_KEY",
  "METRICS_TOKEN",
  "FLW_SECRET_KEY",
  "FLW_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
];

console.log("AfyaLink Legal-Only Readiness Gate");
console.log("================================");

let failed = false;
for (const [label, cmd] of steps) {
  console.log(`\n[RUN] ${label}`);
  const out = run(label, cmd);
  if (!out.ok) {
    failed = true;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[PASS] ${label}`);
  }
}

console.log("\n[CHECK] production env vars");
const missing = requiredProdEnv.filter((k) => !String(process.env[k] || "").trim());
if (missing.length) {
  failed = true;
  console.error("[FAIL] missing required production env vars:");
  for (const key of missing) console.error(` - ${key}`);
} else {
  console.log("[PASS] production env vars present");
}

if (failed) {
  console.error("\nRESULT: NO_GO (technical readiness incomplete)");
  process.exit(1);
}

console.log("\nRESULT: GO_TECH_COMPLETE");
console.log("Only remaining track: legal/regulatory execution and signed institutional agreements.");
