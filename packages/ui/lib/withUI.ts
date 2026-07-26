import deepmerge from 'deepmerge';
import type { Config } from 'tailwindcss';
import path from 'path';

const toPosix = (p: string) => p.replace(/\\/g, '/');

export function withUI(tailwindConfig: Config): Config {
  const uiDir = toPosix(__dirname);
  const uiPaths = [
    `${uiDir}/**/*.tsx`,
    `${uiDir}/**/*.ts`,
    `${uiDir}/**/*.js`,
    `${uiDir}/**/*.jsx`
  ];

  let uiContent: any = uiPaths;
  if (tailwindConfig.content && typeof tailwindConfig.content === 'object' && !Array.isArray(tailwindConfig.content)) {
    uiContent = { files: uiPaths };
  }

  return deepmerge(tailwindConfig, {
    content: uiContent,
  });
}
