#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(ROOT_DIR, "docs", "afy-p1-020-interactive-surface-audit.json");

async function main() {
  const payload = JSON.parse(await readFile(REPORT_PATH, "utf8"));
  const clickSimulation = payload.surfaces.map((entry) => ({
    id: entry.id,
    file: entry.file,
    line: entry.line,
    target: entry.target,
    resolved: entry.resolved,
    action: entry.resolved ? "click-target-resolved" : "click-target-unresolved",
  }));

  const outputPath = path.join(ROOT_DIR, "docs", "afy-p1-020-click-simulation.json");
  await (await import("node:fs/promises")).writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), clickSimulation }, null, 2)}\n`, "utf8");

  console.log(`Click simulation complete: ${clickSimulation.length} interactions captured.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
