import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMigrationMatrix, writeMigrationMatrixReport } from "../../scripts/generate-page-migration-matrix.mjs";

describe("buildMigrationMatrix", () => {
  it("groups page files by domain and marks direct-api pages as remaining", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-migration-matrix-"));
    const pagesDir = path.join(tmpDir, "src", "pages");
    await fs.mkdir(path.join(pagesDir, "Pharmacy"), { recursive: true });
    await fs.mkdir(path.join(pagesDir, "Billing"), { recursive: true });

    await fs.writeFile(path.join(pagesDir, "Pharmacy", "InventoryPage.jsx"), `export default function InventoryPage() { return <div />; }`);
    await fs.writeFile(path.join(pagesDir, "Billing", "ClaimsDashboard.jsx"), `import apiFetch from "../../utils/apiFetch";\nexport default function ClaimsDashboard(){ return <div />;}`);

    const matrix = await buildMigrationMatrix({ rootDir: tmpDir, pageDir: "src/pages" });

    expect(matrix.domains.Pharmacy.total).toBe(1);
    expect(matrix.domains.Pharmacy.migrated).toBe(1);
    expect(matrix.domains.Pharmacy.remaining).toBe(0);
    expect(matrix.domains.Billing.total).toBe(1);
    expect(matrix.domains.Billing.migrated).toBe(0);
    expect(matrix.domains.Billing.remaining).toBe(1);
    expect(matrix.summary.totalPages).toBe(2);
    expect(matrix.summary.migratedPages).toBe(1);
    expect(matrix.summary.remainingPages).toBe(1);
  });

  it("uses the previous snapshot when computing markdown deltas", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "page-migration-matrix-"));
    const pagesDir = path.join(tmpDir, "src", "pages");
    await fs.mkdir(path.join(pagesDir, "Pharmacy"), { recursive: true });

    await fs.writeFile(path.join(pagesDir, "Pharmacy", "InventoryPage.jsx"), `export default function InventoryPage() { return <div />; }`);

    const matrix = await buildMigrationMatrix({ rootDir: tmpDir, pageDir: "src/pages" });
    const markdownPath = path.join(tmpDir, "migration.md");
    const jsonPath = path.join(tmpDir, "migration.json");
    const previousPath = path.join(tmpDir, "migration.previous.json");

    await fs.writeFile(previousPath, JSON.stringify({ summary: { migratedPages: 0, remainingPages: 1, overallCompletion: 0 } }), "utf8");
    await writeMigrationMatrixReport(matrix, markdownPath, jsonPath, previousPath);

    const markdown = await fs.readFile(markdownPath, "utf8");
    expect(markdown).toContain("+1 since previous report");
    expect(markdown).toContain("-1 since previous report");
    expect(markdown).toContain("+100% since previous report");
  });
});
