import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import env, { IS_DEV, IS_PROD } from '@extension/env';

export const watchOption = IS_DEV
  ? {
      exclude: [/\/src\/pages\/content-ui\/dist\/.*\.(css)$/],
      chokidar: {
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100,
        },
      ignored: [/\/src\/pages\/content-ui\/dist\/.*/, /node_modules(?!\/@extension)/],
    },
  }
  : undefined;

export const withPageConfig = (config: UserConfig) =>
  defineConfig(
    deepmerge(
      {
        define: {
          'process.env': env,
        },
        base: '',
        plugins: [react(), IS_DEV && watchRebuildPlugin({ refresh: true })],
        build: {
          sourcemap: IS_DEV,
          minify: IS_PROD,
          reportCompressedSize: IS_PROD,
          emptyOutDir: IS_PROD,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
          },
        },
      },
      config,
    ),
  );
