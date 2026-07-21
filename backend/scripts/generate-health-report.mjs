import fs from 'fs';
import path from 'path';
import process from 'process';

const root = process.cwd();
const runtimesRoot = path.join(root, 'runtimes');

function exists(filePath) { return fs.existsSync(filePath); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

function collectRuntimeManifests(dir) {
  if (!exists(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const manifestPath = path.join(fullPath, 'runtime.json');
      if (exists(manifestPath)) manifests.push(readJson(manifestPath));
      manifests.push(...collectRuntimeManifests(fullPath));
    }
  }
  return manifests;
}

const manifests = collectRuntimeManifests(runtimesRoot);
const seen = new Map();
for (const manifest of manifests) {
  if (!manifest?.name) continue;
  seen.set(manifest.name, manifest);
}

const rows = Array.from(seen.values()).map((manifest) => {
  const status = manifest.releaseStatus || 'Not Started';
  return `- ${manifest.name}: ${status}`;
});

console.log('Runtime health report');
console.log('=====================');
for (const row of rows) console.log(row);
