import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import allowlist from "./check-page-api-usage.allowlist.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const TARGET_DIRECTORIES = ["src/pages"];

const RULES = [
  {
    name: "direct apiFetch call",
    regex: /\bapiFetch\s*\(/g,
    roles: ["page", "component", "app", "hook"],
    recommendation: "Use a service method instead of calling apiFetch directly outside the service layer.",
  },
  {
    name: "direct fetch call",
    regex: /\bfetch\s*\(/g,
    roles: ["page", "component", "app", "hook", "service"],
    recommendation: "Use the shared API client instead of calling fetch directly.",
  },
  {
    name: "direct axios call",
    regex: /\baxios\s*\(/g,
    roles: ["page", "component", "app", "hook", "service"],
    recommendation: "Use the shared API client instead of calling axios directly.",
  },
  {
    name: "literal /api/ string",
    regex: /["'`]\/api\//g,
    roles: ["page", "component", "app", "hook", "utils"],
    recommendation: "Keep literal /api/ endpoints inside service modules only.",
  },
  {
    name: "forbidden shared API client import",
    regex: /\b(import\s+[^;]+\b(apiFetch|axios)\b|require\(['\"](axios|\.\.\/\.\.\/utils\/apiFetch|\.\.\/utils\/apiFetch|\.\.\/\.\.\/apiFetch|\.\.\/apiFetch|\.\.\/api\/client|\.\.\/\.\.\/api\/client)['\"]\))/g,
    roles: ["page", "component", "app", "hook"],
    recommendation: "Avoid importing shared API utilities outside service modules; move the call into a service.",
  },
  {
    name: "hook direct API utility import",
    regex: /\b(import\s+[^;]+\b(apiFetch|axios)\b|require\(['"](axios|\.\.\/\.\.\/utils\/apiFetch|\.\.\/utils\/apiFetch|\.\.\/\.\.\/apiFetch|\.\.\/apiFetch|\.\.\/api\/client|\.\.\/\.\.\/api\/client)['"]\))/g,
    roles: ["hook"],
    recommendation: "Hooks should not import apiFetch/axios directly; use domain services instead.",
  },
  {
    name: "page service import",
    regex: /\bimport\s+[^;]+\bfrom\s+['"](?:\.\.\/)+services\//g,
    roles: ["page"],
    recommendation: "Pages should import hooks, not service modules directly.",
  },
];

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function normalize(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function categorizeFile(filePath) {
  const relative = normalize(filePath);
  if (relative.startsWith("src/pages/")) {
    const remainder = relative.slice("src/pages/".length);
    const category = remainder.split("/")[0] || "root";
    return `pages/${category}`;
  }
  if (relative.startsWith("src/components/")) {
    const remainder = relative.slice("src/components/".length);
    const category = remainder.split("/")[0] || "root";
    return `components/${category}`;
  }
  if (relative.startsWith("src/app")) {
    return "app";
  }
  if (relative.startsWith("src/hooks/")) {
    return "hook";
  }
  if (relative.startsWith("src/services/")) {
    return "service";
  }
  return "other";
}

function determineRole(filePath) {
  const relative = normalize(filePath);
  if (relative.startsWith("src/pages/")) return "page";
  if (relative.startsWith("src/components/")) return "component";
  if (relative.startsWith("src/app")) return "app";
  if (relative.startsWith("src/hooks/")) return "hook";
  if (relative.startsWith("src/services/")) return "service";
  return "other";
}

async function walkDirectory(directory, results) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, results);
    } else if (entry.isFile() && isSourceFile(fullPath)) {
      results.push(fullPath);
    }
  }
}

async function walkPaths(paths) {
  const results = [];
  for (const target of paths) {
    const resolved = path.resolve(ROOT, target);
    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) {
        await walkDirectory(resolved, results);
      } else if (stat.isFile() && isSourceFile(resolved)) {
        results.push(resolved);
      }
    } catch (error) {
      console.error(`Unable to read path: ${resolved}`);
      process.exitCode = 2;
    }
  }
  return results;
}

function formatViolation({ filePath, lineNumber, column, rule, snippet }) {
  const relativePath = normalize(filePath);
  return `❌ ${relativePath}:${lineNumber}:${column}\nFound: ${rule.name}\n${snippet.trim()}\nExpected: ${rule.recommendation}\n`;
}

function summarizeCategories(categoryCounts) {
  const entries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  return entries.map(([category, count]) => `  - ${category}: ${count}`).join("\n");
}

async function run() {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : TARGET_DIRECTORIES;
  const rawFiles = await walkPaths(targets);
  const normalizedAllowlist = new Set(allowlist.map((entry) => entry.replace(/\\/g, "/")));

  const skippedAllowlisted = rawFiles.filter((filePath) => normalizedAllowlist.has(normalize(filePath)));
  const files = rawFiles.filter((filePath) => !normalizedAllowlist.has(normalize(filePath)));

  const metadata = {
    scanned: files.length,
    warnings: skippedAllowlisted.length,
    violations: [],
    filesWithViolations: new Set(),
    categoryCounts: {},
    ruleCounts: {},
  };

  await Promise.all(
    files.map(async (filePath) => {
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split(/\r?\n/);
      const category = categorizeFile(filePath);
      const role = determineRole(filePath);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        for (const rule of RULES) {
          if (!rule.roles.includes(role)) continue;
          let match;
          rule.regex.lastIndex = 0;
          while ((match = rule.regex.exec(line)) !== null) {
            metadata.violations.push({
              filePath,
              lineNumber: index + 1,
              column: match.index + 1,
              rule,
              snippet: line,
            });
            metadata.filesWithViolations.add(filePath);
            metadata.categoryCounts[category] = (metadata.categoryCounts[category] || 0) + 1;
            metadata.ruleCounts[rule.name] = (metadata.ruleCounts[rule.name] || 0) + 1;
          }
        }
      }
    })
  );

  const compliantFiles = metadata.scanned - metadata.filesWithViolations.size;

  if (metadata.violations.length === 0) {
    console.log(`✅ Checked ${metadata.scanned} forbidden-layer file(s). No violations found.`);
    if (metadata.warnings > 0) {
      console.log(`⚠️  Allowlist warnings: ${metadata.warnings} file(s) are still pending migration.`);
    }
    return;
  }

  console.error(`\nFound ${metadata.violations.length} forbidden API usage violation(s) in ${metadata.scanned} file(s):\n`);
  for (const violation of metadata.violations) {
    console.error(formatViolation(violation));
  }

  console.error(`Summary:`);
  console.error(`  Files scanned: ${metadata.scanned}`);
  console.error(`  Compliant files: ${compliantFiles}`);
  console.error(`  Files with violations: ${metadata.filesWithViolations.size}`);
  console.error(`  Violations: ${metadata.violations.length}`);
  console.error(`  Allowlist warnings: ${metadata.warnings}`);
  if (metadata.warnings > 0) {
    console.error(`  Allowlist paths skipped: ${skippedAllowlisted.map((filePath) => normalize(filePath)).join(", ")}`);
  }
  if (Object.keys(metadata.categoryCounts).length > 0) {
    console.error(`  Violations by category:`);
    console.error(summarizeCategories(metadata.categoryCounts));
  }
  if (Object.keys(metadata.ruleCounts).length > 0) {
    console.error(`  Violations by rule:`);
    for (const [ruleName, count] of Object.entries(metadata.ruleCounts)) {
      console.error(`    - ${ruleName}: ${count}`);
    }
  }

  process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
