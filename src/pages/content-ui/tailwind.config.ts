import baseConfig from '@extension/tailwindcss-config';
import { withUI } from '../../../packages/ui/lib/withUI';

import path from 'path';

const toPosix = (p: string) => p.replace(/\\/g, '/');
const localDir = toPosix(__dirname);

export default withUI({
  ...baseConfig,
  content: [`${localDir}/src/**/*.{ts,tsx}`, `${localDir}/../AltS_search_newtab/src/components/Shared/GlobalCreateMenuModal.tsx`, "!**/node_modules/**"],
});
