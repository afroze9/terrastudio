import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.svelte.ts', 'src/testing/**'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
