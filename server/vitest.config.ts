import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    // Under load the suite reconnects to the database per file; the default
    // 10s hook timeout can abandon an afterEach mid-cleanup, leaking DB/Redis
    // state into the next test (flaky "missing user" failures). Give hooks and
    // tests generous headroom so cleanup always completes.
    hookTimeout: 30000,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'src/server.ts',
        'src/jobs/worker.ts',
        'src/docs/**',
      ],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
