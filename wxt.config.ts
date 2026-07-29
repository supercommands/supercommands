import dotenvx from '@dotenvx/dotenvx';
dotenvx.config({ path: process.env.ENV_FILE || '.env' });
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

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
    '@private-services': resolve('src/storage/API/services'),
    '@private-providers': resolve('src/storage/API/storage/providers'),
    '@config': resolve('src/storage/API/core'),
    '@automation': resolve('background/src/automation'),
    '@todos': resolve('background/src/todos'),
    '@sessions': resolve('background/src/sessions'),
    '@browserWindows': resolve('background/src/browserWindows'),
    '@notifications': resolve('background/src/notifications'),
    '@tabs': resolve('background/src/tabs'),
    '@browserData': resolve('background/src/browserData'),
    '@hotkeys': resolve('background/src/hotkeys'),
    '@_authentication': resolve('background/src/_private/authentication_private'),
    '@preBuiltCommands': resolve('background/src/all_PreBuilt_Commands'),
  },

  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    version: '0.3.59',
    icons: {
      '128': 'icon.png'
    },
    browser_specific_settings: {
      gecko: {
        id: 'example@example.com',
        strict_min_version: '109.0'
      }
    },
    permissions: [
      'storage',
      'tabs',
      'activeTab',
      'bookmarks',
      'scripting',
      'downloads',
      'history',
      'debugger',
      'topSites',
      'clipboardRead',
      'clipboardWrite',
      'cookies',
      'alarms',
      'contextMenus',
      'notifications',
      'unlimitedStorage',
      'identity',
    ],
    ...((() => {
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

      // OSS Build: process.env already has env.oss loaded
      if (variant === 'chrome-oss') {
        const extKey = process.env.WXT_EXTENSION_PUBLIC_KEY || process.env.VITE_EXTENSION_PUBLIC_KEY;
        return extKey ? { key: extKey } : {};
      }

      return {};
    })()),
    ...((() => {
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
        // OSS Build: process.env already has env.oss loaded
        clientId = process.env.WXT_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      }

      return clientId
        ? {
            oauth2: {
              client_id: clientId,
              scopes: ['https://www.googleapis.com/auth/drive.appdata'],
            },
          }
        : {};
    })()),
    web_accessible_resources: [
      {
        resources: [
          'icon.png',
          'icon-34.png',
          'pin_new_tab.png',
          'content/injected.js',
          'content/tasklabs_logo.png',
          'popup/tasklabs_logo.png',
          'popup/icon.png',
          'popup/start_writing.png',
          'AltS_search_newtab/index.html',
          'assets/alt-s-website.css',
          'assets/content-ui.css',
          'AltS_search_newtab/images/wallappear/*',
          'AltS_search_newtab/images/Gif/*'
        ],
        matches: ['*://*/*']
      }
    ],
    host_permissions: [
      'https://www.cmdos.app/*',
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://www.perplexity.ai/*',
      'https://drive.google.com/*',
      '<all_urls>',
    ],
    omnibox: {
      keyword: 'c',
    },
    commands: {
      open_create: {
        suggested_key: {
          default: 'Alt+C',
          mac: 'Alt+C',
        },
        description: 'Open Create Menu',
      },
      open_alt_q: {
        suggested_key: {
          default: 'Alt+S',
          mac: 'Alt+S',
        },
        description: 'On Any Website: Command search',
      },
    },
    externally_connectable: {
      matches: ['https://www.cmdos.app/*'],
    },
  },
  vite: () => ({
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
          
          if (source.startsWith('@private-features')) {
             return resolve('src/pages/AltS_search_newtab/src/components/OrganizationPanel');
          }
          
          return null;
        }
      }
    ]
  }),
});
