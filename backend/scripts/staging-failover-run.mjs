import { execSync } from "child_process";

function run(cmd) {
  return execSync(cmd, { stdio: "inherit" });
}

try {
  console.log("[PHASE3] Staging failover drill started");
  run("bash deploy/dr/dr-drill.sh");
  run("npm --prefix backend run failover:evidence:capture");
  console.log("PASS staging-failover-run: drill + evidence captured");
} catch (err) {
  console.error("FAIL staging-failover-run:", err?.message || err);
  process.exit(1);
}
