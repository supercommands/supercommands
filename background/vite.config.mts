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
      '@config': resolve(rootDir, '..', 'src', 'storage', 'API', 'core'),
      '@todos': resolve(srcDir, 'todos'),
      '@sessions': resolve(srcDir, 'sessions'),
      '@browserWindows': resolve(srcDir, 'browserWindows'),
      '@notifications': resolve(srcDir, 'notifications'),
      '@tabs': resolve(srcDir, 'tabs'),
      '@browserData': resolve(srcDir, 'browserData'),
      '@hotkeys': resolve(srcDir, 'hotkeys'),
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
