#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
const OUTPUT_MD = path.join(DOCS_DIR, 'DEPLOYMENT_CERTIFICATION_REPORT.md');
const OUTPUT_JSON = path.join(DOCS_DIR, 'DEPLOYMENT_CERTIFICATION_REPORT.json');
const RC1_MD = path.join(REPORTS_DIR, 'appointment-experience-rc1-report.md');
const RC1_JSON = path.join(REPORTS_DIR, 'appointment-experience-rc1-report.json');
const PLAYWRIGHT_JSON = path.join(FRONTEND_ROOT, 'playwright-report.json');
const IS_RC1 = process.argv.includes('--rc1');

function run(command, args, cwd, env = {}) {
  const result = {
    command: [command, ...args].join(' '),
    status: 'passed',
    stdout: '',
    stderr: '',
  };
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    result.stdout = stdout;
  } catch (error) {
    result.status = 'failed';
    result.stdout = error.stdout?.toString() || '';
    result.stderr = error.stderr?.toString() || '';
  }
  return result;
}

function classifyResult(stdout, stderr, status) {
  const output = `${stdout}\n${stderr}`;
  if (status === 'passed') {
    return 'PASS';
  }
  if (output.includes('PASS') || output.includes('passed')) {
    return 'PASS';
  }
  if (output.includes('FAIL') || output.includes('failed')) {
    return 'FAIL';
  }
  return 'FAIL';
}

function parsePlaywrightReport(output) {
  const cleaned = String(output || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
  if (!cleaned) {
    return null;
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  const candidate = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    const start = cleaned.indexOf('{"config"');
    if (start !== -1) {
      try {
        return JSON.parse(cleaned.slice(start));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function getOverallStatus(results) {
  return Object.values(results).every((entry) => entry === 'passed') ? 'passed' : 'failed';
}

async function writeReport(markdown, json, outputPathMd, outputPathJson) {
  await fs.mkdir(path.dirname(outputPathMd), { recursive: true });
  await fs.mkdir(path.dirname(outputPathJson), { recursive: true });
  await fs.writeFile(outputPathMd, markdown, 'utf8');
  await fs.writeFile(outputPathJson, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

async function main() {
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const backendTests = run('pnpm', ['test', '--', '--runInBand', 'tests/appointments.test.js', 'tests/hospitalVerification.test.js', 'tests/laboratoryRuntime.test.js'], BACKEND_ROOT);
  const frontendTests = run('pnpm', ['vitest', 'run', 'src/pages/Patient/appointmentLayoutUtils.test.js', 'src/pages/Patient/appointmentFeatureFlags.test.js', '--config', 'vitest.config.mjs'], FRONTEND_ROOT);
  const build = run('pnpm', ['build'], FRONTEND_ROOT);
  const playwrightArgs = [
    'exec',
    'playwright',
    'test',
    'tests/e2e/workflows/patient-journey.spec.ts',
    'tests/e2e/workflows/laboratory.spec.ts',
    'tests/e2e/workflows/pharmacy.spec.ts',
    'tests/e2e/workflows/billing.spec.ts',
    'tests/e2e/workflows/inpatient.spec.ts',
    'tests/e2e/notifications.spec.ts',
    '--reporter=json',
  ];
  const playwright = run('pnpm', playwrightArgs, FRONTEND_ROOT, { PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173' });
  let playwrightReport = parsePlaywrightReport(playwright.stdout || playwright.stderr);
  if (!playwrightReport) {
    try {
      const raw = await fs.readFile(PLAYWRIGHT_JSON, 'utf8');
      const fileReport = JSON.parse(raw);
      if (fileReport?.stats) {
        playwrightReport = fileReport;
      }
    } catch {
      // Fall back to the stdout payload captured above.
    }
  }
  const playwrightUnexpected = playwrightReport?.stats?.unexpected || 0;
  const playwrightStatus = playwright.status === 'passed' && playwrightUnexpected === 0 ? 'passed' : 'failed';

  const statusMap = {
    backend: backendTests.status,
    frontend: frontendTests.status,
    build: build.status,
    playwright: playwrightStatus,
  };
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: IS_RC1 ? 'rc1' : 'deployment',
    backend: backendTests.status,
    frontend: frontendTests.status,
    build: build.status,
    playwright: playwrightStatus,
    overall: getOverallStatus(statusMap),
    backendCommand: backendTests.command,
    frontendCommand: frontendTests.command,
    buildCommand: build.command,
    playwrightCommand: playwright.command,
    backendOutput: backendTests.stdout || backendTests.stderr,
    frontendOutput: frontendTests.stdout || frontendTests.stderr,
    buildOutput: build.stdout || build.stderr,
    playwrightOutput: playwright.stdout || playwright.stderr,
    tests: {
      backend: classifyResult(backendTests.stdout, backendTests.stderr, backendTests.status),
      frontend: classifyResult(frontendTests.stdout, frontendTests.stderr, frontendTests.status),
      build: classifyResult(build.stdout, build.stderr, build.status),
      playwright: playwrightUnexpected > 0 ? 'FAIL' : 'PASS',
    },
    playwrightStats: playwrightReport?.stats || null,
    artifacts: {
      deploymentReportMd: OUTPUT_MD,
      deploymentReportJson: OUTPUT_JSON,
      rc1ReportMd: RC1_MD,
      rc1ReportJson: RC1_JSON,
    },
  };

  const markdown = [
    IS_RC1 ? '# Appointment Experience RC1 Certification Report' : '# Deployment Certification Report',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Mode: ${summary.mode}`,
    `- Backend Jest: ${summary.backend}`,
    `- Frontend Vitest: ${summary.frontend}`,
    `- Frontend Build: ${summary.build}`,
    `- Playwright workflow matrix: ${summary.playwright}`,
    `- Overall: ${summary.overall}`,
    '',
    '## Commands',
    '',
    `- ${summary.backendCommand}`,
    `- ${summary.frontendCommand}`,
    `- ${summary.buildCommand}`,
    `- ${summary.playwrightCommand}`,
    '',
    '## Result Summary',
    '',
    `- Backend: ${summary.tests.backend}`,
    `- Frontend: ${summary.tests.frontend}`,
    `- Build: ${summary.tests.build}`,
    `- Playwright: ${summary.tests.playwright}`,
    '',
    '## Backend Output',
    '',
    summary.backendOutput ? `\n${summary.backendOutput}` : '- No output captured.',
    '',
    '## Frontend Output',
    '',
    summary.frontendOutput ? `\n${summary.frontendOutput}` : '- No output captured.',
    '',
    '## Build Output',
    '',
    summary.buildOutput ? `\n${summary.buildOutput}` : '- No output captured.',
    '',
    '## Playwright Output',
    '',
    summary.playwrightOutput ? `\n${summary.playwrightOutput}` : '- No output captured.',
    '',
    '## Playwright Stats',
    '',
    summary.playwrightStats ? JSON.stringify(summary.playwrightStats, null, 2) : '- No Playwright JSON report was produced.',
    '',
  ].join('\n');

  await writeReport(markdown, summary, OUTPUT_MD, OUTPUT_JSON);
  if (IS_RC1) {
    await writeReport(markdown, summary, RC1_MD, RC1_JSON);
  }
  console.log(IS_RC1 ? 'RC1 certification report generated.' : 'Deployment certification report generated.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
