#!/usr/bin/env node

import { runInteractiveSurfaceAudit, writeAuditReports } from "./lib/interactive-surface-audit.mjs";

async function main() {
  const payload = await runInteractiveSurfaceAudit();
  await writeAuditReports(payload);
  console.log(`Interactive surface audit complete: ${payload.summary.total} scanned, ${payload.summary.resolved} resolved, ${payload.summary.unresolved} unresolved.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
