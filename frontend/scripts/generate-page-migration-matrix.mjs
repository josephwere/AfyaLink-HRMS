import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_PAGE_DIR = "src/pages";
const DEFAULT_OUTPUT_FILE = path.join(DEFAULT_ROOT_DIR, "docs", "page-migration-matrix.md");
const DEFAULT_JSON_OUTPUT_FILE = path.join(DEFAULT_ROOT_DIR, "docs", "page-migration-matrix.json");
const DEFAULT_PREVIOUS_JSON_OUTPUT_FILE = path.join(DEFAULT_ROOT_DIR, "docs", "page-migration-matrix.previous.json");

function classifyDomain(relativePath) {
  const segments = relativePath.split("/");
  const pagesIndex = segments.indexOf("pages");
  const child = segments[pagesIndex + 1];

  if (pagesIndex >= 0 && child && segments.length > pagesIndex + 2 && !/\.(js|jsx|ts|tsx)$/.test(child)) {
    return child;
  }

  if (segments[1]) return segments[1];
  return "root";
}

function isPageFile(fileName) {
  return /\.(js|jsx|ts|tsx)$/.test(fileName);
}

function hasLegacyApiUsage(content) {
  return /\b(apiFetch|fetch|axios)\s*\(|\bimport\s+[^;]*\b(apiFetch|fetch|axios)\b|["'`]\/api\//.test(content);
}

function hasServiceImport(content) {
  return /\bimport\s+[^;]+\bfrom\s+["'](?:\.\.\/)+services\//.test(content);
}
function hasLegacyPagePattern(content) {
  return hasLegacyApiUsage(content) || hasServiceImport(content);
}
function determinePriority(entry) {
  if (entry.remaining === 0) return "Done";
  if (entry.remaining >= 10) return "High";
  if (entry.total >= 8) return "Medium";
  return "Low";
}

async function walkDirectory(dirPath, files = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, files);
    } else if (entry.isFile() && isPageFile(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function buildMigrationMatrix({ rootDir = DEFAULT_ROOT_DIR, pageDir = DEFAULT_PAGE_DIR } = {}) {
  const pagesRoot = path.resolve(rootDir, pageDir);
  const files = await walkDirectory(pagesRoot);
  const domains = {};

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const domain = classifyDomain(relativePath);
    const content = await fs.readFile(filePath, "utf8");
    const migrated = !hasLegacyPagePattern(content);

    if (!domains[domain]) {
      domains[domain] = { total: 0, migrated: 0, remaining: 0, files: [] };
    }

    domains[domain].total += 1;
    if (migrated) {
      domains[domain].migrated += 1;
    } else {
      domains[domain].remaining += 1;
    }
    domains[domain].files.push(relativePath);
  }

  const summary = {
    totalPages: files.length,
    migratedPages: Object.values(domains).reduce((sum, domain) => sum + domain.migrated, 0),
    remainingPages: Object.values(domains).reduce((sum, domain) => sum + domain.remaining, 0),
  };

  return { domains, summary };
}

export async function writeMigrationMatrixReport(matrix, outputFile = DEFAULT_OUTPUT_FILE, jsonOutputFile = DEFAULT_JSON_OUTPUT_FILE, previousJsonOutputFile = DEFAULT_PREVIOUS_JSON_OUTPUT_FILE) {
  const summary = {
    ...matrix.summary,
    overallCompletion: matrix.summary.totalPages === 0 ? 0 : Math.round((matrix.summary.migratedPages / matrix.summary.totalPages) * 100),
    domainsCompleted: Object.values(matrix.domains).filter((entry) => entry.remaining === 0).length,
    highPriorityDomainsRemaining: Object.values(matrix.domains).filter((entry) => entry.remaining > 0 && determinePriority(entry) === "High").length,
  };

  let previousSummary = null;
  try {
    const previousContent = await fs.readFile(previousJsonOutputFile, "utf8");
    previousSummary = JSON.parse(previousContent);
  } catch {
    previousSummary = null;
  }

  const previousSummaryData = previousSummary?.summary || previousSummary || null;
  const delta = previousSummaryData
    ? {
        migratedDelta: summary.migratedPages - previousSummaryData.migratedPages,
        remainingDelta: summary.remainingPages - previousSummaryData.remainingPages,
        completionDelta: summary.overallCompletion - previousSummaryData.overallCompletion,
      }
    : {
        migratedDelta: 0,
        remainingDelta: 0,
        completionDelta: 0,
      };

  const lines = [
    "# Page Migration Matrix",
    "",
    "## Summary",
    "",
    `- Total pages: ${summary.totalPages}`,
    `- Migrated pages: ${summary.migratedPages} (${delta.migratedDelta >= 0 ? "+" : ""}${delta.migratedDelta} since previous report)`,
    `- Remaining pages: ${summary.remainingPages} (${delta.remainingDelta >= 0 ? "+" : ""}${delta.remainingDelta} since previous report)`,
    `- Overall completion: ${summary.overallCompletion}% (${delta.completionDelta >= 0 ? "+" : ""}${delta.completionDelta}% since previous report)`,
    `- Domains completed: ${summary.domainsCompleted}`,
    `- High-priority domains remaining: ${summary.highPriorityDomainsRemaining}`,
    "",
    "| Domain | Migrated | Remaining | Total | % Complete | Complexity | Priority |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- |",
  ];

  const domainNames = Object.keys(matrix.domains).sort();
  for (const domain of domainNames) {
    const entry = matrix.domains[domain];
    const percent = entry.total === 0 ? 0 : Math.round((entry.migrated / entry.total) * 100);
    const complexity = entry.remaining === 0 ? "Complete" : entry.remaining > 10 ? "High" : "Medium";
    const priority = determinePriority(entry);
    lines.push(`| ${domain} | ${entry.migrated} | ${entry.remaining} | ${entry.total} | ${percent}% | ${complexity} | ${priority} |`);
  }

  lines.push("| --- | ---: | ---: | ---: | ---: | --- | --- |", `| Total | ${summary.migratedPages} | ${summary.remainingPages} | ${summary.totalPages} | ${summary.overallCompletion}% | — | — |`);

  lines.push(
    "",
    "## Automated Metrics",
    "",
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Total pages: ${summary.totalPages}`,
    `- Migrated: ${summary.migratedPages} (${delta.migratedDelta >= 0 ? "+" : ""}${delta.migratedDelta} since previous report)`,
    `- Remaining: ${summary.remainingPages} (${delta.remainingDelta >= 0 ? "+" : ""}${delta.remainingDelta} since previous report)`,
    `- Overall completion: ${summary.overallCompletion}% (${delta.completionDelta >= 0 ? "+" : ""}${delta.completionDelta}% since previous report)`,
    `- Domains completed: ${summary.domainsCompleted}`,
    `- High-priority domains remaining: ${summary.highPriorityDomainsRemaining}`,
    "",
    "## Recommended Execution Order",
    "",
    "1. Pharmacy",
    "2. Billing / Claims",
    "3. Laboratory",
    "4. Radiology",
    "5. Encounter",
    "6. Workflow",
    "7. Administrative dashboards",
    "8. Remaining governance screens",
    "9. Final cleanup and deprecated code removal",
  );

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${lines.join("\n")}\n`, "utf8");
  const reportPayload = JSON.stringify({ generatedAt: new Date().toISOString(), summary, domains: matrix.domains }, null, 2);
  await fs.writeFile(jsonOutputFile, reportPayload, "utf8");
  await fs.writeFile(previousJsonOutputFile, reportPayload, "utf8");
}

export async function printMigrationMatrix(options = {}) {
  const matrix = await buildMigrationMatrix(options);
  const domainNames = Object.keys(matrix.domains).sort();
  console.log("Migration matrix");
  console.log("================");
  for (const domain of domainNames) {
    const entry = matrix.domains[domain];
    console.log(`${domain}: ${entry.migrated}/${entry.total} migrated (${entry.remaining} remaining)`);
  }
  console.log("----------------");
  console.log(`Total: ${matrix.summary.migratedPages}/${matrix.summary.totalPages} migrated (${matrix.summary.remainingPages} remaining)`);
  await writeMigrationMatrixReport(matrix, options.outputFile || DEFAULT_OUTPUT_FILE, options.jsonOutputFile || DEFAULT_JSON_OUTPUT_FILE, options.previousJsonOutputFile || DEFAULT_PREVIOUS_JSON_OUTPUT_FILE);
  console.log(`Report written to ${path.relative(DEFAULT_ROOT_DIR, options.outputFile || DEFAULT_OUTPUT_FILE)}`);
  console.log(`JSON report written to ${path.relative(DEFAULT_ROOT_DIR, options.jsonOutputFile || DEFAULT_JSON_OUTPUT_FILE)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  printMigrationMatrix().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
