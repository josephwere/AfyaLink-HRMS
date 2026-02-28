import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const perfSummary = process.env.K6_SUMMARY_PATH
  ? path.resolve(root, process.env.K6_SUMMARY_PATH)
  : path.join(root, "backend", "artifacts", "perf", "kenya-peak-summary.json");

const skipCapacity = String(process.env.SKIP_CAPACITY_GATE || "") === "1";

if (skipCapacity) {
  console.log("PASS ops-phase-gate: capacity gate skipped via SKIP_CAPACITY_GATE=1");
  process.exit(0);
}

if (!fs.existsSync(perfSummary)) {
  console.error("FAIL ops-phase-gate: missing k6 summary for capacity gate");
  console.error(` - expected summary: ${path.relative(root, perfSummary)}`);
  console.error(
    "Run `npm --prefix backend run perf:k6:kenya-peak` first, or set SKIP_CAPACITY_GATE=1 for non-performance environments."
  );
  process.exit(1);
}

console.log(`PASS ops-phase-gate: found k6 summary ${path.relative(root, perfSummary)}`);
