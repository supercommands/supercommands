import { resolve } from 'node:path';
import { withPageConfig } from '@extension/vite-config';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
      '@extension/ui': resolve(rootDir, '..', '..', '..', 'packages', 'ui'),
      '@extension/shared': resolve(rootDir, '..', '..', '..', 'packages', 'shared'),
      '@extension/storage': resolve(rootDir, '..', '..', '..', 'packages', 'storage'),
      // Force english-only locale to avoid deep locale resolution issues
      'chrono-node': resolve(rootDir, 'node_modules', 'chrono-node', 'dist', 'esm', 'locales', 'en', 'index.js'),
    },
  },
  optimizeDeps: {
    include: ['chrono-node'],
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', '..', 'dist', 'AltS_search_newtab'),
  },
  server: {
    port: 8080,
    strictPort: true,
  },
});
