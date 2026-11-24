import path from 'node:path';

import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same as the `@/*` path in tsconfig.json, for tests that import route handlers.
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    // Playwright specs live in e2e/ and run with `pnpm e2e`.
    exclude: [...configDefaults.exclude, 'e2e/**', 'site/**'],
  },
});
