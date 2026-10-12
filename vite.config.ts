import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const contentEntry = resolve(root, 'src/content/taskRail.ts');
const contentStyles = resolve(root, 'src/content/taskRailStyles.ts');
const peekChip = resolve(root, 'src/content/peekChip.ts');
const peekChipStyles = resolve(root, 'src/content/peekChipStyles.ts');
const contentConfigFile = resolve(root, 'vite.content.config.ts');

/** After the main extension bundle, rebuild content.js (survives emptyOutDir + watch). */
function buildContentScriptPlugin() {
  let buildingContent = false;

  return {
    name: 'build-content-script',
    buildStart() {
      this.addWatchFile(contentEntry);
      this.addWatchFile(contentStyles);
      this.addWatchFile(peekChip);
      this.addWatchFile(peekChipStyles);
    },
    async closeBundle() {
      if (buildingContent) {
        return;
      }
      buildingContent = true;
      try {
        await viteBuild({
          configFile: contentConfigFile,
        });
      } finally {
        buildingContent = false;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), buildContentScriptPlugin()],
  base: './',
  resolve: {
    alias: {
      '@core': resolve(root, 'src/core'),
      '@platform': resolve(root, 'src/platform'),
      '@ui': resolve(root, 'src/ui'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        blocked: resolve(root, 'blocked.html'),
        sidepanel: resolve(root, 'sidepanel.html'),
        background: resolve(root, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
