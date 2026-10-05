import type { CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { getWebScrapingCardPreview } from './collectionCardPreview';

export type CollectionFolderPreview =
  | { kind: 'image'; itemId: string; assetId: string }
  | { kind: 'capture'; item: Extract<CollectionItemRecord, { type: 'web-scraping' }> };

/** Prefer saved image assets across the folder; use text-only captures for remaining slots. */
export const collectionFolderPreviews = (items: CollectionItemRecord[]): CollectionFolderPreview[] => {
  const previews: CollectionFolderPreview[] = [];
  const captures: CollectionFolderPreview[] = [];
  const seenAssets = new Set<string>();
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);

  for (const item of sorted) {
    const assetIds =
      item.type === 'screenshot'
        ? [item.data.assetId]
        : item.type === 'web-scraping'
          ? getWebScrapingCardPreview(item.data).assetIds
          : [];
    for (const assetId of assetIds) {
      if (!assetId || seenAssets.has(assetId)) continue;
      seenAssets.add(assetId);
      previews.push({ kind: 'image', itemId: item.id, assetId });
      if (previews.length === 4) return previews;
    }
    if (item.type === 'web-scraping' && assetIds.length === 0) {
      captures.push({ kind: 'capture', item });
    }
  }
  return [...previews, ...captures].slice(0, 4);
};
