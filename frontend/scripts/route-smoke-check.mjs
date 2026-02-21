#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";

const appPath = path.resolve(process.cwd(), "src", "App.jsx");

function fail(message) {
  console.error(`FAIL route-smoke-check: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(appPath)) {
  fail(`Missing file ${appPath}`);
}

const source = fs.readFileSync(appPath, "utf8");

const importedNames = new Set();

const defaultImportRegex = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["'][^"']+["'];?/g;
let match;
while ((match = defaultImportRegex.exec(source)) !== null) {
  importedNames.add(match[1]);
}

const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+["'][^"']+["'];?/g;
while ((match = namedImportRegex.exec(source)) !== null) {
  const names = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const n of names) {
    const alias = n.includes(" as ") ? n.split(" as ")[1].trim() : n;
    importedNames.add(alias);
  }
}

const routeElementNames = new Set();
const routeElementRegex = /element=\{\s*<([A-Z][A-Za-z0-9_]*)\b/g;
while ((match = routeElementRegex.exec(source)) !== null) {
  routeElementNames.add(match[1]);
}

const localsAllowed = new Set(["LayoutShell", "RequireRoleRoute"]);
for (const n of localsAllowed) importedNames.add(n);

const missing = [...routeElementNames].filter((n) => !importedNames.has(n));
if (missing.length) {
  fail(`Missing imports for route elements: ${missing.join(", ")}`);
}

console.log(
  `PASS route-smoke-check: ${routeElementNames.size} routed elements resolved in src/App.jsx`
);

