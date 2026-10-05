export interface CollectionItemRoute {
  organisationId: string;
  collectionId: string;
  itemId?: string;
}

const routeFlag = 'open_collection_item';

export const collectionItemUrl = ({ organisationId, collectionId, itemId }: CollectionItemRoute): string => {
  const url = new URL(chrome.runtime.getURL('AltS_search_newtab/index.html'));
  url.searchParams.set(routeFlag, 'true');
  url.searchParams.set('organisation_id', organisationId);
  url.searchParams.set('collection_id', collectionId);
  if (itemId) url.searchParams.set('item_id', itemId);
  return url.toString();
};

export const readCollectionItemRoute = (params: URLSearchParams): CollectionItemRoute | null => {
  if (params.get(routeFlag) !== 'true') return null;
  const organisationId = params.get('organisation_id')?.trim();
  const collectionId = params.get('collection_id')?.trim();
  const itemId = params.get('item_id')?.trim();
  if (!organisationId || !collectionId || (params.has('item_id') && !itemId)) return null;
  return itemId ? { organisationId, collectionId, itemId } : { organisationId, collectionId };
};

export const hasCollectionItemRoute = (params: URLSearchParams): boolean => params.has(routeFlag);
