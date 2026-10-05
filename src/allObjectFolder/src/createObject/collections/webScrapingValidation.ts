import { CollectionStorageError } from './collectionErrors';
import type { WebScrapingData } from './webScrapingTypes';
import { isWebScrapingStyle } from './webScrapingStyle';
import { WEB_SCRAPING_LIMITS } from './webScrapingLimits';

const fail = (message: string): never => { throw new CollectionStorageError('INVALID_INPUT', message); };
const MAX_DEPTH = WEB_SCRAPING_LIMITS.depth;
const MAX_NODES = WEB_SCRAPING_LIMITS.nodes;
const MAX_BYTES = WEB_SCRAPING_LIMITS.bytes;

/** Strict JSON contract, bounded traversal, safe links and resolved image references. */
export function validateWebScrapingData(value: unknown): WebScrapingData {
  let nodes = 0;
  const object = (value: unknown, keys: string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('Web Scraping data must contain plain objects.');
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some(key => !keys.includes(key))) fail('Unsupported Web Scraping field.');
    if (row.style !== undefined && !isWebScrapingStyle(row.style)) fail('Unsupported Web Scraping appearance.');
    return row;
  };
  const text = (value: unknown, required = false): void => {
    if (typeof value !== 'string' || (required && !value.trim())) fail('Invalid Web Scraping text.');
  };
  const url = (value: unknown): void => {
    text(value, true);
    try { if (!['http:', 'https:'].includes(new URL(value as string).protocol)) fail('Web Scraping URLs must use HTTP or HTTPS.'); }
    catch { fail('Invalid Web Scraping URL.'); }
  };
  const array = (value: unknown, visit: (child: unknown) => void): void => {
    if (!Array.isArray(value)) fail('Web Scraping content must be an array.');
    for (const child of value as unknown[]) { if (++nodes > MAX_NODES) fail('Web Scraping content exceeds the node limit.'); visit(child); }
  };
  const data = object(value, ['version', 'blocks', 'images', 'style', 'snapshotId']);
  if (data.version !== 1) fail('Unsupported Web Scraping data version.');
  if (data.snapshotId !== undefined && (typeof data.snapshotId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(data.snapshotId))) fail('Invalid Element snapshot identity.');
  const imageIds = new Set<string>();
  array(data.images, image => {
    const row = object(image, ['id', 'assetId']);
    text(row.id, true); text(row.assetId, true);
    if (imageIds.has(row.id as string)) fail('Duplicate Web Scraping image ID.');
    imageIds.add(row.id as string);
  });
  if (imageIds.size > WEB_SCRAPING_LIMITS.images) fail('Web Scraping supports at most 100 images.');
  const referenced = new Set<string>();
  let unavailableImages = 0;
  const inline = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) fail('Web Scraping content is too deeply nested.');
    const row = object(value, ['type', 'text', 'marks', 'url', 'children', 'style']);
    if (row.type === 'text') {
      object(value, ['type', 'text', 'marks', 'style']); text(row.text);
      if (row.marks !== undefined) array(row.marks, mark => { if (!['bold', 'italic', 'code'].includes(mark as string)) fail('Unsupported inline mark.'); });
    } else if (row.type === 'link') {
      object(value, ['type', 'url', 'children', 'style']); url(row.url); array(row.children, child => inline(child, depth + 1));
    } else fail('Unsupported inline content.');
  };
  const block = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) fail('Web Scraping content is too deeply nested.');
    const row = object(value, ['type', 'children', 'level', 'ordered', 'items', 'blocks', 'text', 'rows', 'imageId', 'style']);
    const blocks = (value: unknown) => array(value, child => block(child, depth + 1));
    switch (row.type) {
      case 'paragraph': case 'heading':
        object(value, row.type === 'heading' ? ['type', 'level', 'children', 'style'] : ['type', 'children', 'style']);
        if (row.type === 'heading' && ![1, 2, 3, 4, 5, 6].includes(row.level as number)) fail('Invalid heading level.');
        array(row.children, child => inline(child, depth + 1)); break;
      case 'list':
        object(value, ['type', 'ordered', 'items', 'style']);
        if (typeof row.ordered !== 'boolean') fail('List ordered must be boolean.');
        array(row.items, blocks); break;
      case 'quote': object(value, ['type', 'blocks', 'style']); blocks(row.blocks); break;
      case 'code': object(value, ['type', 'text', 'style']); text(row.text); break;
      case 'table': object(value, ['type', 'rows', 'style']); array(row.rows, cells => array(cells, blocks)); break;
      case 'image':
        object(value, ['type', 'imageId', 'style']); text(row.imageId, true);
        if (!imageIds.has(row.imageId as string)) fail('Unknown Web Scraping image reference.');
        referenced.add(row.imageId as string); break;
      case 'unavailable-image':
        object(value, ['type', 'style']);
        if (++unavailableImages + imageIds.size > WEB_SCRAPING_LIMITS.images) fail('Web Scraping supports at most 100 image candidates.');
        break;
      default: fail('Unsupported Web Scraping block.');
    }
  };
  array(data.blocks, child => block(child, 0));
  if (!(data.blocks as unknown[]).length) fail('Web Scraping content is required.');
  if (referenced.size !== imageIds.size) fail('Every Web Scraping image must appear in the content.');
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_BYTES) fail('Web Scraping content exceeds 1 MiB.');
  return value as WebScrapingData;
}
