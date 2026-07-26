/**
 * @file vite.config.mts
 * @description Vite build configuration for the Chrome Extension background service worker.
 * Handles path aliases, environment variable injection, and output formatting.
 */
import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest-plugin.js';
import { watchPublicPlugin, watchRebuildPlugin } from '@extension/hmr';
import { watchOption } from '@extension/vite-config';
import env, { IS_DEV, IS_PROD } from '@extension/env';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');

const enableSharing = process.env.VITE_ENABLE_SHARING !== 'false';
const cloudProviderPath = enableSharing
  ? resolve(rootDir, '..', 'src', 'pages', 'Apis', 'storage', 'providers', 'CloudProvider.ts')
  : resolve(rootDir, '..', 'src', 'pages', 'Apis', 'storage', 'providers', 'private-mocks', 'CloudProvider.ts');

const migrationProviderPath = enableSharing
  ? resolve(rootDir, '..', 'src', 'pages', 'Apis', 'storage', 'providers', 'MigrationProvider.ts')
  : resolve(rootDir, '..', 'src', 'pages', 'Apis', 'storage', 'providers', 'private-mocks', 'MigrationProvider.ts');

const logoutProviderPath = enableSharing
  ? resolve(rootDir, '..', 'src', 'pages', 'Apis', 'storage', 'providers', 'LogoutProvider.ts')
  : resolve(rootDir, '..', 'src', 'pages', 'Apis', 'storage', 'providers', 'private-mocks', 'LogoutProvider.ts');

const subscriptionApiPath = enableSharing
  ? resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services', 'subscriptionApi.ts')
  : resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services', 'private-mocks', 'subscriptionApi.ts');

const refreshCounterServicePath = enableSharing
  ? resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services', 'refreshCounterService.ts')
  : resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services', 'private-mocks', 'refreshCounterService.ts');

const userRefreshCounterServicePath = enableSharing
  ? resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services', 'userRefreshCounterService.ts')
  : resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services', 'private-mocks', 'userRefreshCounterService.ts');

const outDir = resolve(rootDir, '..', 'dist');
export default defineConfig({
  define: {
    'process.env': env,
  },
  resolve: {
    alias: {
      '@root': rootDir,
      '@src': srcDir,
      '@assets': resolve(srcDir, 'assets'),
      '@private-providers/CloudProvider': cloudProviderPath,
      '@private-providers/MigrationProvider': migrationProviderPath,
      '@private-providers/LogoutProvider': logoutProviderPath,
      '@private-services/subscriptionApi': subscriptionApiPath,
      '@private-services/refreshCounterService': refreshCounterServicePath,
      '@private-services/userRefreshCounterService': userRefreshCounterServicePath,
      '@private-services': resolve(rootDir, '..', 'src', 'pages', 'Apis', 'services'),
      '@config': resolve(rootDir, '..', 'src', 'storage', 'API', 'core'),
      '@_userAnalytics': resolve(srcDir, '_private', 'userAnalytics_private'),
      '@automation': resolve(srcDir, 'automation'),
      '@todos': resolve(srcDir, 'todos'),
      '@sessions': resolve(srcDir, 'sessions'),
      '@browserWindows': resolve(srcDir, 'browserWindows'),
      '@notifications': resolve(srcDir, 'notifications'),
      '@tabs': resolve(srcDir, 'tabs'),
      '@browserData': resolve(srcDir, 'browserData'),
      '@hotkeys': resolve(srcDir, 'hotkeys'),
      '@_authentication': resolve(srcDir, '_private', 'authentication_private'),
      '@chatAgents': resolve(srcDir, 'chatAgents'),
      '@preBuiltCommands': resolve(srcDir, 'all_PreBuilt_Commands'),
    },
  },
  plugins: [
    libAssetsPlugin() as PluginOption,
    watchPublicPlugin(),
    makeManifestPlugin({ outDir }),
    IS_DEV && watchRebuildPlugin({ reload: true, id: 'chrome-extension-hmr' }),
    nodePolyfills() as unknown as PluginOption,
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      name: 'BackgroundScript',
      fileName: 'background',
      formats: ['es'],
      entry: resolve(srcDir, 'index.ts'),
    },
    outDir,
    emptyOutDir: false,
    sourcemap: IS_DEV,
    minify: IS_PROD,
    reportCompressedSize: IS_PROD,
    watch: watchOption,
    rollupOptions: {
      external: ['chrome'],
    },
  },
});
