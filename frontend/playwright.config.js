import { defineConfig } from '@playwright/test';

const frontendBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const backendBaseURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global.setup.ts',
  timeout: 60_000,
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
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || './test-results/.auth/storage.json',
  },
  reporter: [['list']],
  metadata: {
    frontendBaseURL,
    backendBaseURL,
  },
});
