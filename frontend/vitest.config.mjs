import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    deps: {
      inline: ['@testing-library/react', '@testing-library/user-event'],
    },
  },
});
