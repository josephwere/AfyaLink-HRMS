import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const summaryArg = process.argv[2] || "backend/artifacts/perf/kenya-peak-summary.json";
const summaryPath = path.isAbsolute(summaryArg) ? summaryArg : path.join(root, summaryArg);

const maxErrorRate = Number(process.env.K6_MAX_ERROR_RATE || 0.01);
const maxP95Ms = Number(process.env.K6_MAX_P95_MS || 1200);
const minCheckRate = Number(process.env.K6_MIN_CHECK_RATE || 0.99);

if (!fs.existsSync(summaryPath)) {
  console.error(`FAIL load-capacity-gate: summary file not found: ${summaryPath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const metrics = summary?.metrics || {};

function metricValue(name, fallback = null) {
  const obj = metrics[name];
  if (!obj) return fallback;
  if (obj.values) return obj.values;
  return fallback;
}

const failedRate = Number(metricValue("http_req_failed", {}).rate ?? 1);
const p95Ms = Number(metricValue("http_req_duration", {})["p(95)"] ?? Number.POSITIVE_INFINITY);
const checkRate = Number(metricValue("checks", {}).rate ?? 0);

const failures = [];
if (failedRate > maxErrorRate) {
  failures.push(`error rate ${failedRate.toFixed(4)} exceeds ${maxErrorRate.toFixed(4)}`);
}
if (p95Ms > maxP95Ms) {
  failures.push(`p95 latency ${p95Ms.toFixed(2)}ms exceeds ${maxP95Ms.toFixed(2)}ms`);
}
if (checkRate < minCheckRate) {
  failures.push(`checks rate ${checkRate.toFixed(4)} below ${minCheckRate.toFixed(4)}`);
}

const report = {
  evaluatedAt: new Date().toISOString(),
  thresholds: { maxErrorRate, maxP95Ms, minCheckRate },
  observed: { failedRate, p95Ms, checkRate },
  pass: failures.length === 0,
  failures,
  summaryPath: path.relative(root, summaryPath),
};

const outDir = path.join(root, "backend", "artifacts", "perf");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "capacity-gate-latest.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

if (failures.length) {
  console.error("FAIL load-capacity-gate:");
  failures.forEach((f) => console.error(` - ${f}`));
  console.error(`Artifact: ${path.relative(root, outPath)}`);
  process.exit(1);
}

console.log("PASS load-capacity-gate");
console.log(`Artifact: ${path.relative(root, outPath)}`);
