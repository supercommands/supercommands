/**
 * @fileoverview Vite plugin for generating and copying the Chrome Extension manifest.
 *
 * This module hooks into the Vite build process to generate the `manifest.json` file.
 * It dynamically injects Hot Module Replacement (HMR) scripts during development
 * and handles caching and dynamic imports of the manifest configuration.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Manifest } from '@extension/dev-utils';
import { colorLog, ManifestParser } from '@extension/dev-utils';
import type { PluginOption } from 'vite';
import { IS_DEV, IS_FIREFOX } from '@extension/env';

import { createJiti } from 'jiti';

const manifestFile = resolve(import.meta.dirname, '..', '..', 'manifest.ts');
const refreshFilePath = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'packages',
  'hmr',
  'dist',
  'lib',
  'injections',
  'refresh.js',
);

const withHMRId = (code: string) => {
  return `(function() {let __HMR_ID = 'chrome-extension-hmr';${code}\n})();`;
};

const getManifestWithCacheBurst = async () => {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const module = (await jiti.import(manifestFile)) as { default: Manifest };
  return module.default;
};

export default (config: { outDir: string }): PluginOption => {
  const makeManifest = (manifest: Manifest, to: string) => {
    if (!existsSync(to)) {
      mkdirSync(to);
    }

    const manifestPath = resolve(to, 'manifest.json');

    if (IS_DEV) {
      addRefreshContentScript(manifest);
    }

    writeFileSync(manifestPath, ManifestParser.convertManifestToString(manifest, IS_FIREFOX));

    const refreshFileString = readFileSync(refreshFilePath, 'utf-8');

    if (IS_DEV) {
      writeFileSync(resolve(to, 'refresh.js'), withHMRId(refreshFileString));
    }

    colorLog(`Manifest file copy complete: ${manifestPath}`, 'success');
  };

  return {
    name: 'make-manifest',
    buildStart() {
      this.addWatchFile(manifestFile);
    },
    async writeBundle() {
      const outDir = config.outDir;
      const manifest = await getManifestWithCacheBurst();
      makeManifest(manifest, outDir);
    },
  };
};

function addRefreshContentScript(manifest: Manifest) {
  manifest.content_scripts = manifest.content_scripts || [];
  manifest.content_scripts.push({
    matches: ['http://*/*', 'https://*/*', '<all_urls>'],
    js: ['refresh.js'], // for public's HMR(refresh) support
  });
}
