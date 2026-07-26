import baseConfig from '@extension/tailwindcss-config';
import { withUI } from '../../../packages/ui/lib/withUI';
import typography from '@tailwindcss/typography';

import path from 'path';

const toPosix = (p: string) => p.replace(/\\/g, '/');
const localDir = toPosix(__dirname);

export default withUI({
  ...baseConfig,
  darkMode: 'class',
  content: [
    `${localDir}/index.html`,
    `${localDir}/src/**/*.{js,ts,jsx,tsx}`,
    `${localDir}/../../allObjectFolder/src/**/*.{js,ts,jsx,tsx}`,
    `${localDir}/../../shared-components/**/*.{js,ts,jsx,tsx}`,
    `${localDir}/../../settings/**/*.{js,ts,jsx,tsx}`,
    `${localDir}/../../welcomeGuide/**/*.{js,ts,jsx,tsx}`,
    '!**/node_modules/**',
  ],
  plugins: [...(baseConfig.plugins || []), typography],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        overlayBg: 'var(--color-overlayBg)',
      },
      keyframes: {
        shrink: {
          '0%': { transform: 'scaleX(1)' },
          '100%': { transform: 'scaleX(0)' },
        },
      },
      animation: {
        'shrink-3s': 'shrink 3s linear forwards',
      },
    },
  },
});
