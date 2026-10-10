import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

/** Builds the content-script task rail as a single IIFE (no shared chunks). */
export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(root, 'src/core'),
      '@platform': resolve(root, 'src/platform'),
      '@ui': resolve(root, 'src/ui'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'src/content/taskRail.ts'),
      name: 'AegisTaskRail',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
});
