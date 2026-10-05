import { db } from '../../../src/storage/indexDB/dbConfig';
import { repairInspirationImages } from '../../../src/storage/onboarding/repairInspirationImages';
import * as persistence from '../../../src/allObjectFolder/src/createObject/collections/collectionData';
import { CollectionStorageError, CollectionConflictError } from '../../../src/allObjectFolder/src/createObject/collections/collectionErrors';
import { object, fields, requiredText } from '../../../src/allObjectFolder/src/createObject/collections/collectionValidation';
import type { CreateCollectionInput, UpdateCollectionInput, CreateCollectionItemInput, UpdateCollectionItemInput } from '../../../src/allObjectFolder/src/createObject/collections/collectionInputs';
import type { CollectionAction, CollectionBridgeResponse } from '../../../src/allObjectFolder/src/createObject/collections/collectionBridgeTypes';
import type { CollectionItemType } from '../../../src/allObjectFolder/src/createObject/collections/collectionTypes';
import { broadcastWebsitePopupEntityChanges } from '../websitePopupBridge/broadcastWebsitePopupChanges';
import { decodeCollectionItemInput } from './collectionScreenshotPayload';
import { acquireAndSaveWebScraping } from './collectionWebScrapingAcquisition';
import * as properties from '../../../src/allObjectFolder/src/createObject/collections/properties/collectionPropertyData';
import type { AddCollectionPropertyInput, RenameCollectionPropertyInput, SetCollectionItemPropertyValueInput } from '../../../src/allObjectFolder/src/createObject/collections/properties/collectionPropertyInputs';

const propertyActions: readonly CollectionAction[] = ['collection_property_add', 'collection_property_rename', 'collection_item_property_set'];
const actions: readonly CollectionAction[] = [...propertyActions, 'collection_element_snapshot_get', 'collection_web_scraping_save', 'collection_create', 'collection_get', 'collection_list', 'collection_update', 'collection_delete', 'collection_item_create', 'collection_item_get', 'collection_item_list', 'collection_item_image_read', 'collection_item_update', 'collection_item_delete'];
/** Return the repaired record in the same response that triggered one-time inspiration-image repair. */
async function readWithInspirationRepair<T>(organisationId: string, read: () => Promise<T>): Promise<{ result: T; repaired: boolean }> {
  let result = await read();
  const repaired = await repairInspirationImages(organisationId);
  if (repaired) result = await read();
  return { result, repaired };
}
/** Returns true only for handled actions, retaining the asynchronous response channel. */
export function handleCollectionMessage(message: unknown, sendResponse: (response: CollectionBridgeResponse<unknown>) => void, sender: chrome.runtime.MessageSender = {}): boolean {
  if (!message || typeof message !== 'object' || !('action' in message) || !actions.includes(message.action as CollectionAction)) return false;
  void (async () => {
    let response: CollectionBridgeResponse<unknown>; let changed: string[] = [];
    try {
      const envelope = object(message, 'Message'); fields(envelope, ['action', 'payload']);
      const action = envelope.action as CollectionAction;
      const payload = object(envelope.payload, 'Payload');
      await db.open();
      let result: unknown;
      if (action === 'collection_web_scraping_save') {
        const saved = await acquireAndSaveWebScraping(payload, sender);
        result = saved; if (saved.status === 'saved') changed = ['collectionItems', 'assets'];
      } else if (action === 'collection_create') { result = await persistence.createCollection(payload as unknown as CreateCollectionInput); changed = ['collections']; }
      else if (action === 'collection_item_create') {
        const item = await persistence.createCollectionItem(decodeCollectionItemInput(payload) as unknown as CreateCollectionItemInput);
        result = item; changed = (item.type === 'screenshot' || item.type === 'web-scraping') ? ['collectionItems', 'assets'] : ['collectionItems'];
      } else {
        fields(payload, action === 'collection_list' ? ['organisationId'] : action === 'collection_item_list' ? ['organisationId', 'collectionId', 'type'] : action === 'collection_item_image_read' ? ['organisationId', 'id', 'offset', 'assetId'] : action.endsWith('_update') || propertyActions.includes(action) ? ['organisationId', 'id', 'input'] : ['organisationId', 'id']);
        const owner = requiredText(payload.organisationId, 'Organisation ID');
        const id = action.endsWith('_list') ? '' : requiredText(payload.id, 'ID');
        switch (action) {
          case 'collection_property_add': result = await properties.addCollectionProperty(owner, id, payload.input as AddCollectionPropertyInput); changed = ['collections']; break;
          case 'collection_property_rename': result = await properties.renameCollectionProperty(owner, id, payload.input as RenameCollectionPropertyInput); changed = ['collections']; break;
          case 'collection_item_property_set': result = await properties.setCollectionItemPropertyValue(owner, id, payload.input as SetCollectionItemPropertyValueInput); changed = ['collectionItems']; break;
          case 'collection_get': result = await persistence.getCollection(owner, id); break;
          case 'collection_list': {
            const read = await readWithInspirationRepair(owner, () => persistence.listCollections(owner));
            result = read.result;
            if (read.repaired) changed = ['collectionItems', 'assets'];
            break;
          }
          case 'collection_update': result = await persistence.updateCollection(owner, id, payload.input as UpdateCollectionInput); changed = ['collections']; break;
          case 'collection_delete': await persistence.deleteCollection(owner, id); result = null; changed = ['collections', 'collectionItems', 'assets', 'userShortcuts', 'shortcutsMap', 'userHotkeys', 'hotkeysMap']; break;
          case 'collection_item_get': {
            const read = await readWithInspirationRepair(owner, () => persistence.getCollectionItem(owner, id));
            result = read.result;
            if (read.repaired) changed = ['collectionItems', 'assets'];
            break;
          }
          case 'collection_element_snapshot_get': result = await persistence.getCollectionElementSnapshot(owner, id); break;
          case 'collection_item_list': {
            const collectionId = requiredText(payload.collectionId, 'Collection ID');
            const read = await readWithInspirationRepair(owner, () => persistence.listCollectionItems(owner, collectionId, payload.type as CollectionItemType | undefined));
            result = read.result;
            if (read.repaired) changed = ['collectionItems', 'assets'];
            break;
          }
          case 'collection_item_image_read': result = await persistence.readCollectionItemImageChunk(owner, id, payload.offset as number, payload.assetId as string | undefined); break;
          case 'collection_item_update': {
            const item = await persistence.updateCollectionItem(owner, id, decodeCollectionItemInput(payload.input) as unknown as UpdateCollectionItemInput);
            result = item; changed = (item.type === 'screenshot' || item.type === 'web-scraping') ? ['collectionItems', 'assets'] : ['collectionItems']; break;
          }
          case 'collection_item_delete': {
            const item = await persistence.getCollectionItem(owner, id);
            await persistence.deleteCollectionItem(owner, id); result = null;
            changed = (item.type === 'screenshot' || item.type === 'web-scraping') ? ['collectionItems', 'assets'] : ['collectionItems']; break;
          }
        }
      }
      response = { ok: true, result };
    } catch (error) {
      response = { ok: false, code: error instanceof CollectionStorageError ? error.code : error instanceof CollectionConflictError ? 'CONFLICT' : 'STORAGE_ERROR', error: error instanceof Error ? error.message : 'Collection request failed.', ...(error instanceof CollectionConflictError ? { remoteRecord: error.remoteRecord } : {}) };
    }
    // Notifications and channel failures cannot report a committed mutation as failed.
    if (changed.length) {
      void broadcastWebsitePopupEntityChanges(changed).catch(error => console.error('[Collections] Notification delivery failed.', error));
      for (const table of changed) {
        void chrome.runtime.sendMessage({ action: 'db_changed', table }).catch(() => undefined);
      }
    }
    sendResponse(response);
  })();
  return true;
}
