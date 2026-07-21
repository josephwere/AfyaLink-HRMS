import fs from 'fs';
import path from 'path';
import process from 'process';

const root = process.cwd();
const runtimesRoot = path.join(root, 'runtimes');

function exists(filePath) {
  return fs.existsSync(filePath);
}

function walk(dir) {
  if (!exists(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name === 'runtime.json') {
      results.push(fullPath);
    }
  }
  return results;
}

const runtimeFiles = walk(runtimesRoot);
const issues = [];
for (const file of runtimeFiles) {
  const runtimeDir = path.dirname(file);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const runtimeName = manifest.name || path.basename(runtimeDir);
  const requiredPaths = [
    'runtime',
    'repositories',
    'contracts',
    'policies',
    'workers',
    'events',
    'tests',
    'docs',
    'README.md',
    'runtime.json',
  ];
  for (const rel of requiredPaths) {
    const target = path.join(runtimeDir, rel);
    if (!exists(target)) issues.push(`${runtimeName}: missing ${rel}`);
  }
  if (!manifest.dependencies || !Array.isArray(manifest.dependencies)) {
    issues.push(`${runtimeName}: invalid dependencies`);
  }
  if (!manifest.states || !Array.isArray(manifest.states)) {
    issues.push(`${runtimeName}: invalid states`);
  }
}

if (issues.length) {
  console.error('Runtime verification failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Runtime verification passed for ${runtimeFiles.length} runtime manifest(s).`);
