const fs = require('fs');
const path = require('path');
const { defineConfig } = require('@playwright/test');

const rootDir = __dirname;
const frontendBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const backendBaseURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
const configuredStorageState = process.env.PLAYWRIGHT_STORAGE_STATE || './test-results/.auth/storage.json';
const storageStatePath = path.resolve(process.cwd(), configuredStorageState);
// Always provide the configured storage state path. global.setup.ts will create this file.
const resolvedStorageState = storageStatePath;

module.exports = defineConfig({
  testDir: './tests/e2e',
  globalSetup: process.env.SKIP_PLAYWRIGHT_GLOBAL_SETUP === '1' ? undefined : './tests/e2e/global.setup.ts',
  timeout: 60_000,
  webServer: {
    command: 'node ./scripts/start-e2e-servers.mjs',
    cwd: rootDir,
    url: frontendBaseURL,
    timeout: 180_000,
    reuseExistingServer: true,
  },
  fullyParallel: false,
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: frontendBaseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: resolvedStorageState,
  },
  reporter: [['list']],
  metadata: {
    frontendBaseURL,
    backendBaseURL,
  },
});
