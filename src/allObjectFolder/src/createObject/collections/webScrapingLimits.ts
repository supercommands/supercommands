/** DOM wrappers flatten during extraction; stored semantic nesting has a separate bound. */
export const WEB_SCRAPING_LIMITS = { sourceDepth: 256, depth: 24, nodes: 10000, bytes: 1024 * 1024, images: 100 } as const;
