import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['tests/e2e/**', '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.mjs', '**/*.spec.mjs', '**/*.test.cjs', '**/*.spec.cjs'],
    maxWorkers: 1,
    minWorkers: 1,
    deps: {
      inline: ['@testing-library/react', '@testing-library/user-event'],
    },
  },
});
