import { resolve } from 'node:path';
import { withPageConfig } from '@extension/vite-config';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

const enableSharing = process.env.VITE_ENABLE_SHARING !== 'false';
console.log(
  '--- BUILD TIME: VITE_ENABLE_SHARING =',
  process.env.VITE_ENABLE_SHARING,
  'enableSharing resolved to =',
  enableSharing,
);
const privateFeaturesPath = enableSharing
  ? resolve(srcDir, 'components', 'OrganizationPanel')
  : resolve(srcDir, 'components', 'OrganizationPanel', 'private-mocks');

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
      '@private-features': privateFeaturesPath,
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
