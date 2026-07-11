import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the `@shared/*` tsconfig path so tests outside packages/shared
      // (e.g. the backend seed's mapping unit tests) can import shared domain code.
      '@shared': path.resolve(rootDir, 'packages/shared/src'),
      // Mirror the web-client's `@/*` tsconfig path so its unit tests can reach
      // in-package modules (e.g. the mascot voice catalog). Trailing slash keeps
      // this from matching `@shared`.
      '@/': `${path.resolve(rootDir, 'packages/web-client/src')}/`,
    },
  },
  test: {
    include: ['**/*.test.ts'],
  },
});
