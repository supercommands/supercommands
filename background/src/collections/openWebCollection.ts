/** One validated Collection-level launcher for popup results and assigned triggers. */
import { requireWebCollectionAssignmentTarget } from '../../../src/allObjectFolder/src/createObject/collections/collectionAssignmentData';
import { collectionItemUrl } from '../../../src/pages/AltS_search_newtab/src/components/collections/collectionItemRoute';
import { getCollectionItem } from '../../../src/allObjectFolder/src/createObject/collections/collectionData';

export async function openWebCollection(collectionId: string, expectedOrganisationId?: string, itemId?: string): Promise<void> {
  const collection = await requireWebCollectionAssignmentTarget(collectionId);
  if (expectedOrganisationId !== undefined && collection.organisationId !== expectedOrganisationId) {
    throw new Error('This Collection does not belong to the requested Organisation.');
  }
  const item = itemId === undefined ? undefined : await getCollectionItem(collection.organisationId, itemId);
  if (item && item.collectionId !== collection.id) throw new Error('This item does not belong to the requested Collection.');
  const url = collectionItemUrl({ organisationId: collection.organisationId, collectionId: collection.id, ...(item ? { itemId: item.id } : {}) });
  await chrome.tabs.create({ url, active: true });
}
