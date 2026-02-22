import fs from "fs";
import path from "path";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5000";
const outRoot = path.resolve(process.cwd(), "backend", "artifacts", "failover-drill");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(outRoot, stamp);
fs.mkdirSync(outDir, { recursive: true });

async function fetchJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

const metricsToken = process.env.METRICS_TOKEN || "";
const headers = metricsToken
  ? { Authorization: `Bearer ${metricsToken}` }
  : {};

const healthz = await fetchJson(`${baseUrl}/healthz`);
const readyz = await fetchJson(`${baseUrl}/readyz`);
const metrics = await fetchJson(`${baseUrl}/metrics`, headers);

const evidence = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  checks: {
    healthz,
    readyz,
    metrics: {
      ok: metrics.ok,
      status: metrics.status,
      snippet:
        typeof metrics?.data?.raw === "string"
          ? String(metrics.data.raw).slice(0, 500)
          : null,
    },
  },
};

fs.writeFileSync(path.join(outDir, "evidence.json"), JSON.stringify(evidence, null, 2));
fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# Failover Drill Evidence\n\nGenerated: ${evidence.generatedAt}\n\nBase URL: ${baseUrl}\n`
);

console.log(`PASS failover-evidence-capture: ${path.relative(process.cwd(), outDir)}`);
