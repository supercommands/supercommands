import baseConfig from '@extension/tailwindcss-config';
import { withUI } from '../../../packages/ui/lib/withUI';

import path from 'path';

const toPosix = (p: string) => p.replace(/\\/g, '/');
const localDir = toPosix(__dirname);

export default withUI({
  ...baseConfig,
  darkMode: 'class',
  content: [
    `${localDir}/src/**/*.{ts,tsx}`,
    // Alt+S is injected as a content-script UI. Keep every reused editor/toolbar
    // surface here so Tailwind emits the popup/header/action classes into this bundle.
    `${localDir}/../../shared-components/editorToolbar/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../shared-components/hotkeys/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../shared-components/shortcuts/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../shared-components/versionHistory/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../allObjectFolder/src/createObject/links/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../allObjectFolder/src/createObject/todos/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../allObjectFolder/src/createObject/tags/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../AltS_search_newtab/src/components/altsNewtabSidebar/**/*.{ts,tsx}`,
    `${localDir}/../AltS_search_newtab/src/components/widgets/**/*.{ts,tsx}`,
    `${localDir}/../../allObjectFolder/src/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../shared-components/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../../settings/**/*.{ts,tsx,js,jsx}`,
    `${localDir}/../AltS_search_newtab/src/components/Shared/**/*.{ts,tsx}`,
    '!**/node_modules/**',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      fontFamily: {
        comfortaa: ['Comfortaa', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',
        lg: '25px',
        xl: '40px',
      },
      boxShadow: {
        frosted: '0 8px 32px rgba(0, 0, 0, 0.1)',
        'frosted-lg': '0 20px 64px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        frosted: '24px',
      },
      zIndex: {
        'alts-popup': '2147483647',
        'alts-subpopup': '2147483647',
      },
    },
  },
  plugins: [
    ...(baseConfig.plugins || []),
    function ({ addComponents, theme }: any) {
      addComponents({
        '.bg-frostedglass': {
          borderRadius: theme('borderRadius.frosted'),
          borderWidth: '1px',
          borderColor: 'rgba(255, 255, 255, 0.28)',
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          boxShadow: theme('boxShadow.frosted'),
          backdropFilter: 'blur(14px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
        },
        '.dark .bg-frostedglass': {
          borderColor: 'rgba(255, 255, 255, 0.18)',
          backgroundColor: 'rgba(18, 18, 18, 0.55)',
          boxShadow: theme('boxShadow.frosted'),
          backdropFilter: 'blur(14px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
        },
      });
    },
  ],
});
