import type { CollectionItemRecord } from './collectionTypes';

export function collectionItemAssetIds(item: CollectionItemRecord): string[] {
  return item.type === 'screenshot' ? [item.data.assetId]
    : item.type === 'web-scraping' ? item.data.images.map(image => image.assetId) : [];
}
