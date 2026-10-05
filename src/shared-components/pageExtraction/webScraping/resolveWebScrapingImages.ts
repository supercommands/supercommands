import type { WebScrapingBlock, WebScrapingData, WebScrapingImage } from '../../../allObjectFolder/src/createObject/collections/webScrapingTypes';
import { validateWebScrapingData } from '../../../allObjectFolder/src/createObject/collections/webScrapingValidation';
import type { ExtractedWebScraping } from './webScrapingExtractionTypes';

/** Build persistable JSON after adoption, omitting unavailable content when partial saving is allowed. */
export function resolveWebScrapingImages(draft: ExtractedWebScraping, adopted: ReadonlyMap<string, string>): WebScrapingData {
  return resolveImages(draft, adopted, false)!;
}
/** Available-content capture policy: an image-only selection with no readable bytes is not saved. */
export function resolveAvailableWebScrapingImages(draft: ExtractedWebScraping, adopted: ReadonlyMap<string, string>): WebScrapingData | null {
  return resolveImages(draft, adopted, true);
}
function resolveImages(draft: ExtractedWebScraping, adopted: ReadonlyMap<string, string>, skipEmpty: boolean): WebScrapingData | null {
  const images: WebScrapingImage[] = [];
  const available = new Set<string>();
  const candidates = new Set<string>();
  for (const candidate of draft.images) {
    if (candidates.has(candidate.id)) throw new Error('Duplicate image candidate ID.');
    candidates.add(candidate.id);
    const assetId = adopted.get(candidate.id);
    if (assetId) { images.push({ id: candidate.id, assetId }); available.add(candidate.id); }
    else if (!skipEmpty) throw new Error('Some images are unavailable.');
  }
  const map = (blocks: WebScrapingBlock[]): WebScrapingBlock[] => blocks.flatMap((block): WebScrapingBlock[] => {
    switch (block.type) {
      case 'image':
        if (!candidates.has(block.imageId)) throw new Error('Unknown image candidate reference.');
        return available.has(block.imageId) ? [block] : [];
      case 'unavailable-image': return [];
      case 'quote': {
        const children = map(block.blocks);
        return children.length ? [{ ...block, blocks: children }] : [];
      }
      case 'list': {
        const items = block.items.map(map).filter(item => item.length);
        return items.length ? [{ ...block, items }] : [];
      }
      case 'table': {
        const rows = block.rows.map(row => row.map(map)).filter(row => row.some(cell => cell.length));
        return rows.length ? [{ ...block, rows }] : [];
      }
      default: return [block];
    }
  });
  const blocks = map(draft.blocks);
  if (skipEmpty && !blocks.length) return null;
  return validateWebScrapingData({ version: 1, blocks, images, ...(draft.style ? { style: draft.style } : {}) });
}
