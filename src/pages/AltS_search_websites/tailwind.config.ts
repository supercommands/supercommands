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
    `${localDir}/../../shared-components/**/*.{ts,tsx,js,jsx}`,
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
