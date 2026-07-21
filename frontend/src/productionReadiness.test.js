import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");

describe("production readiness validation", () => {
  it("generates the route crawl report and production readiness artifacts", () => {
    execFileSync(process.execPath, ["scripts/e2e-route-crawl.mjs"], {
      cwd: frontendRoot,
      stdio: "pipe",
      encoding: "utf8",
    });

    const reportMd = path.join(frontendRoot, "docs", "e2e-route-crawl-report.md");
    const reportJson = path.join(frontendRoot, "docs", "e2e-route-crawl-report.json");

    expect(existsSync(reportMd)).toBe(true);
    expect(existsSync(reportJson)).toBe(true);

    const payload = JSON.parse(readFileSync(reportJson, "utf8"));
    expect(payload.summary).toBeDefined();
    expect(payload.summary.totalRoutes).toBeGreaterThan(0);
  });
});
