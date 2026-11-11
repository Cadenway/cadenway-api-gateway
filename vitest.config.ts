import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int-spec.ts', 'test/**/*.int-spec.ts'],
          // Disposable PostgreSQL and NATS containers start in the hooks.
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.int-spec.ts', 'src/main.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
