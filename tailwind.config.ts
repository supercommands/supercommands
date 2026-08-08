import baseConfig from '@extension/tailwindcss-config';
import { withUI } from './packages/ui/lib/withUI';
import typography from '@tailwindcss/typography';
import path from 'path';

const toPosix = (p: string) => p.replace(/\\/g, '/');
const rootDir = toPosix(__dirname);

export default withUI({
  ...baseConfig,
  darkMode: 'class',
  content: [
    `${rootDir}/entrypoints/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/pages/AltS_search_newtab/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/pages/AltS_search_websites/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/pages/popup/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/pages/contentScript/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/shared-components/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/settings/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/welcomeGuide/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/src/allObjectFolder/**/*.{html,js,ts,jsx,tsx}`,
    `${rootDir}/packages/ui/lib/**/*.{html,js,ts,jsx,tsx}`, "!**/node_modules/**"],
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
