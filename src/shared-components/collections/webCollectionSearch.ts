import type { CollectionItemRecord, CollectionRecord } from '../../allObjectFolder/src/createObject/collections/collectionTypes';

/** The same Organisation and parent-Collection scope for popup and Chrome omnibox. */
export function selectVisibleWebCollectionRecords(
  collections: readonly CollectionRecord[], items: readonly CollectionItemRecord[], organisationId?: string | null,
) {
  const visibleCollections = collections.filter(collection => collection.organisationId === organisationId);
  const visibleIds = new Set(visibleCollections.map(collection => collection.id));
  return {
    collections: visibleCollections,
    items: items.filter(item => item.organisationId === organisationId && visibleIds.has(item.collectionId)),
  };
}

export function withWebCollectionNames(items: readonly CollectionItemRecord[], collections: readonly CollectionRecord[]) {
  const names = new Map(collections.map(collection => [collection.id, collection.name]));
  return items.map(item => ({ ...item, collectionName: names.get(item.collectionId) || '' }));
}

/** Shared searchable fields; each surface remains responsible for its own ranking and presentation. */
export function getWebCollectionSearchFields(record: CollectionRecord | (CollectionItemRecord & { collectionName?: string })) {
  if ('collectionId' in record) {
    const item = record as CollectionItemRecord & { collectionName?: string };
    return [item.title, item.url, item.type, item.collectionName, item.note,
      item.type === 'article' || item.type === 'text' ? item.data.text : '',
      item.type === 'web-scraping' ? JSON.stringify(item.data.blocks) : '']
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
  }
  return [record.name];
}
