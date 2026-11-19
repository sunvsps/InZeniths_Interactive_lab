import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    // All files share one throw-away database, so they run one after another.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
