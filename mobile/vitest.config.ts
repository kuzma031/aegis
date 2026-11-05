import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(root, 'src/core'),
      '@platform': resolve(root, 'src/platform'),
      '@services': resolve(root, 'src/services'),
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
  },
});
