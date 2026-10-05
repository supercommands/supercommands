import type { CollectionRecord, CollectionItemRecord } from './collectionTypes';
import type { CreateCollectionInput, UpdateCollectionInput, CreateCollectionItemInput, UpdateCollectionItemInput } from './collectionInputs';
import type { ExtractedElementClip } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import type { ElementSnapshotRecord } from './elementSnapshotTypes';
import type { AddCollectionPropertyInput, RenameCollectionPropertyInput, SetCollectionItemPropertyValueInput } from './properties/collectionPropertyInputs';

export type WebScrapingSaveResult = { status: 'saved'; item: CollectionItemRecord }
  | { status: 'skipped' };

export type ScreenshotWireData = { assetId: string; fileName?: string; base64?: never; mimeType?: never }
  | { base64: string; mimeType: string; fileName?: string; assetId?: never };
export interface CollectionImageChunk { mimeType: string; byteSize: number; offset: number; base64: string; nextOffset: number | null; fileName?: string }
export type CreateCollectionItemWireInput = Exclude<CreateCollectionItemInput, { type: 'screenshot' }>
  | (Omit<Extract<CreateCollectionItemInput, { type: 'screenshot' }>, 'data'> & { data: ScreenshotWireData });
export type UpdateCollectionItemWireInput = Exclude<UpdateCollectionItemInput, { type: 'screenshot' }>
  | (Omit<Extract<UpdateCollectionItemInput, { type: 'screenshot' }>, 'data'> & { data?: ScreenshotWireData });
export interface CollectionRequestPayloads {
  collection_property_add: { organisationId: string; id: string; input: AddCollectionPropertyInput };
  collection_property_rename: { organisationId: string; id: string; input: RenameCollectionPropertyInput };
  collection_item_property_set: { organisationId: string; id: string; input: SetCollectionItemPropertyValueInput };
  collection_web_scraping_save: Pick<CreateCollectionItemInput, 'organisationId' | 'collectionId' | 'title' | 'note' | 'tagIds'> & { draft: ExtractedElementClip };
  collection_create: CreateCollectionInput;
  collection_get: { organisationId: string; id: string };
  collection_list: { organisationId: string };
  collection_update: { organisationId: string; id: string; input: UpdateCollectionInput };
  collection_delete: { organisationId: string; id: string };
  collection_item_create: CreateCollectionItemWireInput;
  collection_item_get: { organisationId: string; id: string };
  collection_element_snapshot_get: { organisationId: string; id: string };
  collection_item_list: { organisationId: string; collectionId: string; type?: CollectionItemRecord['type'] };
  collection_item_image_read: { organisationId: string; id: string; offset: number; assetId?: string };
  collection_item_update: { organisationId: string; id: string; input: UpdateCollectionItemWireInput };
  collection_item_delete: { organisationId: string; id: string };
}
export interface CollectionRequestResults {
  collection_property_add: CollectionRecord;
  collection_property_rename: CollectionRecord;
  collection_item_property_set: CollectionItemRecord;
  collection_web_scraping_save: WebScrapingSaveResult;
  collection_create: CollectionRecord; collection_get: CollectionRecord; collection_list: CollectionRecord[];
  collection_update: CollectionRecord; collection_delete: null;
  collection_item_create: CollectionItemRecord; collection_item_get: CollectionItemRecord; collection_item_list: CollectionItemRecord[];
  collection_item_image_read: CollectionImageChunk;
  collection_element_snapshot_get: ElementSnapshotRecord | null;
  collection_item_update: CollectionItemRecord; collection_item_delete: null;
}
export type CollectionAction = keyof CollectionRequestPayloads;
export type CollectionBridgeRequest = { [A in CollectionAction]: { action: A; payload: CollectionRequestPayloads[A] } }[CollectionAction];
export type CollectionBridgeErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'INVALID_OWNERSHIP' | 'CONFLICT' | 'STORAGE_ERROR';
export type CollectionBridgeResponse<T> = { ok: true; result: T }
  | { ok: false; code: CollectionBridgeErrorCode; error: string; remoteRecord?: CollectionRecord | CollectionItemRecord };
