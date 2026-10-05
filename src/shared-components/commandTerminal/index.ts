/**
 * Shared command-terminal API.
 *
 * This folder owns reusable parsing contracts only:
 * - commandSpace parses top-level `c ...` input
 * - chaining parses category chains like `c t -s query`
 * - search adapts caller-provided IndexedDB snapshots into shared searchAll()
 * - runtime builds launch targets for website-popup versus newtab handoff
 *
 * Website, newtab, and omnibox adapters keep their own UI, event handling, and
 * final execution behavior.
 */
export * from './types';
export * from './commandSpace';
export * from './chaining';
export * from './search';
export * from './runtime';
