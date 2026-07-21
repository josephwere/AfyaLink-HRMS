import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");

describe("interactive surface audit", () => {
  it("generates the primary surface audit reports", () => {
    execFileSync(process.execPath, ["scripts/audit-interactive-surfaces.mjs"], {
      cwd: frontendRoot,
      stdio: "pipe",
      encoding: "utf8",
    });

    const outputJson = path.join(frontendRoot, "docs", "afy-p1-020-interactive-surface-audit.json");
    const outputMd = path.join(frontendRoot, "docs", "afy-p1-020-interactive-surface-audit.md");

    expect(existsSync(outputJson)).toBe(true);
    expect(existsSync(outputMd)).toBe(true);

    const payload = JSON.parse(readFileSync(outputJson, "utf8"));
    expect(payload.summary).toBeDefined();
    expect(Array.isArray(payload.surfaces)).toBe(true);
    expect(payload.summary.total).toBeGreaterThan(0);
  });
});
