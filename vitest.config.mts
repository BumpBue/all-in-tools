import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const SRC_ALIAS = '@';
const SRC_DIR = fileURLToPath(new URL('./src', import.meta.url));

const TEST_INCLUDE = ['src/**/*.test.{ts,tsx}'];

export default defineConfig({
  resolve: {
    alias: { [SRC_ALIAS]: SRC_DIR },
  },
  test: {
    include: TEST_INCLUDE,
    // Pure logic tests run in node; hook tests opt into happy-dom per file.
    environment: 'node',
  },
});
