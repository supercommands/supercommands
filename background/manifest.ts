/**
 * @file manifest.ts
 * @description Dynamic extension manifest generator.
 */
import { readFileSync } from 'node:fs';
import '@extension/env';

const packageJsonPath = new URL('./package.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
// Vite loads .env before importing this file, so process.env has all VITE_* vars
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? '';
const PUBLIC_KEY =
  process.env.VITE_ENABLE_SHARING === 'false' || process.env.VITE_ENABLE_SHARING === 'true'
    ? (process.env.VITE_EXTENSION_PUBLIC_KEY ?? '')
    : '';
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  ...(PUBLIC_KEY ? { key: PUBLIC_KEY } : {}),
  browser_specific_settings: {
    gecko: {
      id: 'example@example.com',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  description: '__MSG_extensionDescription__',
  host_permissions: [
    'https://www.cmdos.app/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://drive.google.com/*',
    '<all_urls>',
  ],
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
  // Google Drive OAuth — Client ID injected from VITE_GOOGLE_CLIENT_ID in .env
  ...(GOOGLE_CLIENT_ID
    ? {
        oauth2: {
          client_id: GOOGLE_CLIENT_ID,
          scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        },
      }
    : {}),

  omnibox: {
    keyword: 'c',
  },
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_popup: 'popup/index.html',
    default_icon: 'icon.png',
  },
  chrome_url_overrides: {
    newtab: 'AltS_search_newtab/index.html',
  },
  commands: {
    open_alt_q: {
      suggested_key: {
        default: 'Alt+S',
        mac: 'Alt+S',
      },
      description: 'Main Search works on website & newtab',
    },
  },
  icons: {
    128: 'icon.png',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content/index.iife.js'],
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true,
    },
  ],

  web_accessible_resources: [
    {
      resources: [
        '*.js',
        '*.css',
        '*.svg',
        '*.png',
        'icon.png',
        'icon-34.png',
        'pin_new_tab.png',
        'AltS_search_websites/*.js',
        'AltS_search_websites/*.css',
        'content/injected.js',
        'AltS_search_newtab/index.html',
        'AltS_search_newtab/assets/*',
      ],
      matches: ['*://*/*'],
    },
  ],
  externally_connectable: {
    matches: ['https://www.cmdos.app/*'],
  },
} satisfies chrome.runtime.ManifestV3;

export default manifest;
