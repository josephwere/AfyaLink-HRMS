import fs from 'fs';
import path from 'path';
import process from 'process';

const root = process.cwd();
const runtimesRoot = path.join(root, 'runtimes');

function exists(filePath) { return fs.existsSync(filePath); }
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
for (const file of runtimeFiles) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const runtimeName = manifest.name || path.basename(path.dirname(file));
  const deps = (manifest.dependencies || []).join(', ') || 'none';
  console.log(`${runtimeName} -> ${deps}`);
}
