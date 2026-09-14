import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const SRC_ALIAS = '@';
const SRC_DIR = fileURLToPath(new URL('./src', import.meta.url));

// Only pure logic modules are unit tested, so no DOM environment is needed.
const TEST_INCLUDE = ['src/**/*.test.ts'];

export default defineConfig({
  resolve: {
    alias: { [SRC_ALIAS]: SRC_DIR },
  },
  test: {
    include: TEST_INCLUDE,
    environment: 'node',
  },
});
