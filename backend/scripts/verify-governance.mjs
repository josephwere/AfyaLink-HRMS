import fs from 'fs';
import path from 'path';
import process from 'process';

const root = process.cwd();
const docsRoot = path.join(root, 'docs', 'architecture');
const runtimesRoot = path.join(root, 'runtimes');
const artifactsDir = path.join(root, 'artifacts');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function collectRuntimeManifests(dir) {
  if (!exists(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const manifestPath = path.join(fullPath, 'runtime.json');
      if (exists(manifestPath)) {
        manifests.push({ dir: fullPath, manifest: readJson(manifestPath) });
      }
      manifests.push(...collectRuntimeManifests(fullPath));
    }
  }
  return manifests;
}

function main() {
  const manifests = collectRuntimeManifests(runtimesRoot);
  const issues = [];

  if (!exists(path.join(root, 'package.json'))) {
    issues.push('package.json missing');
  }

  const requiredDocs = [
    'BLUEPRINT-v1.md',
    'MASTER_ROADMAP.md',
    'RUNTIME_STATUS.md',
    'CURRENT_SPRINT.md',
    'IMPLEMENTATION_STATUS.md',
    'ARCHITECTURAL_DECISIONS.md',
    'VERIFICATION_DRIVEN_PROMPT.md',
    'RELEASE_GATES.md',
    'DEPENDENCY_GRAPH.md',
    'TEST_COVERAGE_MATRIX.md',
    'RISK_REGISTER.md',
    'API_CONTRACTS.md',
  ];

  for (const doc of requiredDocs) {
    if (!exists(path.join(docsRoot, doc))) {
      issues.push(`missing governance document: ${doc}`);
    }
  }

  if (manifests.length === 0) {
    issues.push('no runtime manifests found');
  }

  for (const { dir, manifest } of manifests) {
    const runtimeName = manifest.name || path.basename(dir);

    if (!manifest.owner) issues.push(`${runtimeName}: missing owner`);
    if (!manifest.version) issues.push(`${runtimeName}: missing version`);
    if (!manifest.maturity) issues.push(`${runtimeName}: missing maturity`);
    if (!manifest.dependencies || !Array.isArray(manifest.dependencies)) {
      issues.push(`${runtimeName}: missing dependencies array`);
    }
    if (!manifest.states || !Array.isArray(manifest.states)) {
      issues.push(`${runtimeName}: missing states array`);
    }
    if (!manifest.eventsPublished || !Array.isArray(manifest.eventsPublished)) {
      issues.push(`${runtimeName}: missing eventsPublished array`);
    }
    if (!manifest.eventsConsumed || !Array.isArray(manifest.eventsConsumed)) {
      issues.push(`${runtimeName}: missing eventsConsumed array`);
    }
    if (!manifest.repositories || !Array.isArray(manifest.repositories)) {
      issues.push(`${runtimeName}: missing repositories array`);
    }
    if (!manifest.routes || !Array.isArray(manifest.routes)) {
      issues.push(`${runtimeName}: missing routes array`);
    }
    if (!manifest.controllers || !Array.isArray(manifest.controllers)) {
      issues.push(`${runtimeName}: missing controllers array`);
    }
    if (!manifest.policies || !Array.isArray(manifest.policies)) {
      issues.push(`${runtimeName}: missing policies array`);
    }
    if (!manifest.apiRoutes || !Array.isArray(manifest.apiRoutes)) {
      issues.push(`${runtimeName}: missing apiRoutes array`);
    }
    if (!manifest.requiredTests || !Array.isArray(manifest.requiredTests)) {
      issues.push(`${runtimeName}: missing requiredTests array`);
    }
    if (!manifest.documentation || !Array.isArray(manifest.documentation)) {
      issues.push(`${runtimeName}: missing documentation array`);
    }
    if (!manifest.releaseStatus) issues.push(`${runtimeName}: missing releaseStatus`);

    for (const doc of manifest.documentation || []) {
      const docPath = path.join(dir, doc);
      if (!exists(docPath)) {
        issues.push(`${runtimeName}: missing required doc ${doc}`);
      }
    }
  }

  if (!exists(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'governance-report.txt'), `Governance verification passed for ${manifests.length} runtime manifest(s).\n`);

  if (issues.length > 0) {
    console.error('Governance verification failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }

  console.log(`Governance verification passed for ${manifests.length} runtime manifest(s).`);
}

main();
