import { WEB_SCRAPING_LIMITS } from './webScrapingLimits';
import { MAX_ASSET_FILE_SIZE } from '../../../../storage/assets/assetPolicy';

/** Shared format/runtime policy, not application appearance tokens. */
export const ELEMENT_SNAPSHOT_LIMITS = { nodes: 4000, depth: WEB_SCRAPING_LIMITS.sourceDepth, bytes: 4 * 1024 * 1024, resources: WEB_SCRAPING_LIMITS.images } as const;
export const ELEMENT_CLIP_RUNTIME_LIMITS = { fontWaitMs: 2000, settleMs: 3000, acquisitionMs: 20000, imageBytes: MAX_ASSET_FILE_SIZE, decodePixels: 16 * 1024 * 1024, documentCharacters: 96 * 1024 * 1024 } as const;
