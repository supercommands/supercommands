import baseConfig from '@extension/tailwindcss-config';
import type { Config } from 'tailwindcss';

import path from 'path';

const toPosix = (p: string) => p.replace(/\\/g, '/');
const localDir = toPosix(__dirname);

export default {
  ...baseConfig,
  content: [`${localDir}/index.html`, `${localDir}/src/**/*.{js,ts,jsx,tsx}`, "!**/node_modules/**"],
} as Config;
