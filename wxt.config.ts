import dotenvx from '@dotenvx/dotenvx';
dotenvx.config({ path: process.env.ENV_FILE || '.env' });
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const watchIgnoredDirs = [
  '**/.git/**',
  '**/.output/**',
  '**/.turbo/**',
  '**/.wxt/**',
  '**/dist/**',
  '**/extension-artifacts/**',
  '**/logs/**',
  '**/node_modules/**',
  '**/test-results/**',
];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      if (_wxt.config.browser === 'firefox') {
        manifest.permissions = (manifest.permissions || []).filter(permission => permission !== 'system.memory');
      }
      const isSnippetInjectorScript = (path: string) =>
        path === 'content-scripts/content.js' ||
        path === 'content/index.iife.js' ||
        path.endsWith('/content-scripts/content.js') ||
        path.endsWith('/content/index.iife.js');

      manifest.content_scripts ??= [];

      let hasSnippetInjector = false;
      manifest.content_scripts.forEach(script => {
        const scripts = script.js || [];
        const includesSnippetInjector = scripts.some(isSnippetInjectorScript);

        if (includesSnippetInjector) {
          hasSnippetInjector = true;
          script.all_frames = true;
          script.match_about_blank = true;
          (script as any).match_origin_as_fallback = true;
        }
      });

      if (!hasSnippetInjector) {
        manifest.content_scripts.push({
          matches: ['<all_urls>'],
          js: ['content-scripts/content.js'],
          all_frames: true,
          match_about_blank: true,
          match_origin_as_fallback: true,
        });
      }
    },
  },

  alias: {
    '@extension/shared/lib': resolve('packages/shared/lib'),
    '@extension/shared': resolve('packages/shared/index.mts'),
    '@extension/storage/lib': resolve('packages/storage/lib'),
    '@extension/storage': resolve('packages/storage/index.mts'),
    '@extension/ui/lib': resolve('packages/ui/lib'),
    '@extension/ui': resolve('packages/ui/index.ts'),
    '@extension/browser': resolve('packages/browser/index.ts'),
    '@src': resolve('src'),
    '@chatAgents': resolve('background/src/chatAgents'),
    '@config': resolve('src/storage/API/core'),
    '@todos': resolve('background/src/todos'),
    '@sessions': resolve('background/src/sessions'),
    '@browserWindows': resolve('background/src/browserWindows'),
    '@notifications': resolve('background/src/notifications'),
    '@tabs': resolve('background/src/tabs'),
    '@browserData': resolve('background/src/browserData'),
    '@hotkeys': resolve('background/src/hotkeys'),
    '@preBuiltCommands': resolve('background/src/all_PreBuilt_Commands'),
  },

  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    version: '0.3.66',
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'example@example.com',
        strict_min_version: '109.0',
      },
    },
    permissions: [
      'storage',
      'tabs',
      'activeTab',
      'bookmarks',
      'scripting',
      'downloads',
      'history',
      'alarms',
      'contextMenus',
      'notifications',
      'unlimitedStorage',
      'identity',
      'system.memory',
    ],
    ...(() => {
      const variant = process.env.WXT_ARTIFACT_VARIANT;

      // Normal Build: Do NOT include PEM ID
      if (variant === 'chrome-standard') return {};

      // SaaS Build: Pull PEM ID explicitly from env.oss if it exists, otherwise fallback to process.env
      if (variant === 'chrome-saas') {
        try {
          const fs = require('fs');
          if (fs.existsSync('env.oss')) {
            const envOssContent = fs.readFileSync('env.oss', 'utf-8');
            const match = envOssContent.match(/^VITE_EXTENSION_PUBLIC_KEY=(.*)$/m);
            if (match && match[1]) return { key: match[1].trim() };
          } else {
            const extKey = process.env.WXT_EXTENSION_PUBLIC_KEY || process.env.VITE_EXTENSION_PUBLIC_KEY;
            return extKey ? { key: extKey } : {};
          }
        } catch (e) {
          console.warn('Could not read env.oss for SaaS build PEM ID');
        }
      }

      // OSS builds do not publish an extension key.
     if (variant === 'chrome-oss') {
  const fs = require('fs');
  const ossEnv = fs.readFileSync(resolve('env.oss'), 'utf8');
  const key = ossEnv
    .match(/^VITE_EXTENSION_PUBLIC_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');

  if (!key) {
    throw new Error('Missing public extension key in env.oss.');
  }

  return { key };
}
      return {};
    })(),
    ...(() => {
      const variant = process.env.WXT_ARTIFACT_VARIANT;
      let clientId: string | undefined = undefined;

      if (variant === 'chrome-standard') {
        // Normal Build: Pull Client ID from regular .env
        clientId = process.env.WXT_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      } else if (variant === 'chrome-saas') {
        // SaaS Build: Pull Client ID explicitly from env.oss if it exists, otherwise fallback to process.env
        try {
          const fs = require('fs');
          if (fs.existsSync('env.oss')) {
            const envOssContent = fs.readFileSync('env.oss', 'utf-8');
            const match = envOssContent.match(/^VITE_GOOGLE_CLIENT_ID=(.*)$/m);
            if (match && match[1]) clientId = match[1].trim();
          } else {
            clientId = process.env.WXT_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
          }
        } catch (e) {
          console.warn('Could not read env.oss for SaaS build Client ID');
        }
      } else if (variant === 'chrome-oss') {
        // Read only the OSS client ID; never inherit the private build's client ID.
        const fs = require('fs');
        const ossEnv = fs.readFileSync(resolve('env.oss'), 'utf8');
        clientId = ossEnv.match(/^VITE_GOOGLE_CLIENT_ID=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
        if (!clientId || !/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
          throw new Error('OSS build requires its Google OAuth client ID in env.oss.');
        }
      }

      return clientId
        ? {
            oauth2: {
              client_id: clientId,
              scopes: ['https://www.googleapis.com/auth/drive.appdata'],
            },
          }
        : {};
    })(),
    action: {
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
    web_accessible_resources: [
      {
        resources: [
          'icon.png',
          'icons/icon-16.png',
          'icons/icon-32.png',
          'icons/icon-48.png',
          'icons/icon-128.png',
          'icon-34.png',
          'pin_new_tab.png',
          'content/injected.js',
          'content/supercommands_logo.png',
          'popup/supercommands_logo.png',
          'popup/icon.png',
          'popup/start_writing.png',
          'AltS_search_newtab/index.html',
          'AltS_search_newtab/images/wallappear/*',
          'AltS_search_newtab/images/Gif/*',
        ],
        matches: ['*://*/*'],
      },
    ],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*',
    ],
    omnibox: {
      keyword: 'c',
    },
    commands: {
      open_alts: {
        suggested_key: { default: 'Alt+S', mac: 'Alt+S' },
        description: 'Alt + S Search',
      },
    },
    externally_connectable: {
      matches: ['https://www.supercommands.com/*', 'https://supercommands.com/*', 'https://www.cmdos.app/*'],
    },
  },
  vite: () => ({
    envPrefix: process.env.WXT_ARTIFACT_VARIANT === 'chrome-oss' ? ['VITE_ENABLE_GOOGLE_DRIVE_BACKUP'] : 'VITE_',
    cacheDir: resolve('.wxt/vite-cache'),
    server: {
      watch: {
        ignored: watchIgnoredDirs,
      },
    },
    optimizeDeps: {
      include: ['@vitejs/plugin-react', 'dexie', 'framer-motion', 'react', 'react-dom', 'react/jsx-runtime', 'zustand'],
    },
    build: {
      // Chrome warns when eagerly preloaded chunks are not evaluated shortly
      // after the new-tab page loads. Let normal ESM imports fetch the chunks
      // when they are needed instead of emitting <link rel="modulepreload">.
      modulePreload: false,
      reportCompressedSize: false,
      sourcemap: false,
      chunkSizeWarningLimit: 5000,
    },
    esbuild: {
      charset: 'ascii',
    },
    plugins: [
      {
        name: 'dynamic-page-aliases',
        enforce: 'pre',
        resolveId(source, importer) {
          if (!importer) return null;

          if (source.startsWith('@src/')) {
            const pageMatch = importer.match(/src[\\\/]pages[\\\/]([^\\\/]+)[\\\/]/);
            if (pageMatch) {
              const pageName = pageMatch[1];
              return resolve(`src/pages/${pageName}/src`, source.replace('@src/', ''));
            }
          }


          return null;
        },
      },
    ],
  }),
});
