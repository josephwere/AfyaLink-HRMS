import { execSync } from "child_process";

function run(label, cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
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
