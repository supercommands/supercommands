import type { CollectionAction, CollectionRequestPayloads, CollectionRequestResults, CollectionBridgeResponse, CollectionBridgeErrorCode } from './collectionBridgeTypes';
import type { CollectionRecord, CollectionItemRecord } from './collectionTypes';
import type { CreateCollectionItemInput } from './collectionInputs';
import { validateElementSnapshotRecord } from './elementSnapshotValidation';
import { hasImageSignature, validateImageAsset, MAX_ASSET_FILE_SIZE } from '../../../../storage/assets/assetPolicy';

export class CollectionClientError extends Error {
  constructor(public code: CollectionBridgeErrorCode | 'TRANSPORT_ERROR', message: string, public remoteRecord?: CollectionRecord | CollectionItemRecord) {
    super(message); this.name = 'CollectionClientError';
  }
}
/** Runtime messaging only: never import persistence or Dexie into this client. */
export async function requestCollection<A extends CollectionAction>(action: A, payload: CollectionRequestPayloads[A]): Promise<CollectionRequestResults[A]> {
  let response: CollectionBridgeResponse<CollectionRequestResults[A]>;
  try { response = await chrome.runtime.sendMessage({ action, payload }); }
  catch (error) { throw new CollectionClientError('TRANSPORT_ERROR', error instanceof Error ? error.message : 'Collection message failed.'); }
  if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') throw new CollectionClientError('TRANSPORT_ERROR', 'Invalid collection background response.');
  if (!response.ok) {
    if (!['INVALID_INPUT', 'NOT_FOUND', 'INVALID_OWNERSHIP', 'CONFLICT', 'STORAGE_ERROR'].includes(response.code) || typeof response.error !== 'string') throw new CollectionClientError('TRANSPORT_ERROR', 'Invalid collection error response.');
    throw new CollectionClientError(response.code, response.error, response.remoteRecord);
  }
  const result = response.result;
  const valid = action.endsWith('_delete') ? result === null : action.endsWith('_list') ? Array.isArray(result)
    : action === 'collection_element_snapshot_get' ? result === null || Boolean(result && typeof result === 'object' && 'id' in result)
    : action === 'collection_web_scraping_save' ? Boolean(result && typeof result === 'object' && 'status' in result
      && (result.status === 'saved' && 'item' in result && result.item && typeof result.item === 'object' && 'id' in result.item && typeof result.item.id === 'string'
          && 'type' in result.item && result.item.type === 'web-scraping'
        || result.status === 'skipped'))
    : action === 'collection_item_image_read' ? Boolean(result && typeof result === 'object' && 'base64' in result && typeof result.base64 === 'string' && 'nextOffset' in result)
    : Boolean(result && typeof result === 'object' && 'id' in result && typeof result.id === 'string');
  if (!valid) throw new CollectionClientError('TRANSPORT_ERROR', 'Missing collection result.');
  return result;
}
export const createCollection = (input: CollectionRequestPayloads['collection_create']) => requestCollection('collection_create', input);
export const addCollectionProperty = (organisationId: string, id: string, input: CollectionRequestPayloads['collection_property_add']['input']) => requestCollection('collection_property_add', { organisationId, id, input });
export const renameCollectionProperty = (organisationId: string, id: string, input: CollectionRequestPayloads['collection_property_rename']['input']) => requestCollection('collection_property_rename', { organisationId, id, input });
export const setCollectionItemPropertyValue = (organisationId: string, id: string, input: CollectionRequestPayloads['collection_item_property_set']['input']) => requestCollection('collection_item_property_set', { organisationId, id, input });
export const getCollection = (organisationId: string, id: string) => requestCollection('collection_get', { organisationId, id });
export const listCollections = (organisationId: string) => requestCollection('collection_list', { organisationId });
export const updateCollection = (organisationId: string, id: string, input: CollectionRequestPayloads['collection_update']['input']) => requestCollection('collection_update', { organisationId, id, input });
export const deleteCollection = async (organisationId: string, id: string): Promise<void> => { await requestCollection('collection_delete', { organisationId, id }); };
export const createCollectionItem = (input: CollectionRequestPayloads['collection_item_create']) => requestCollection('collection_item_create', input);
export const saveCollectionWebScraping = (input: CollectionRequestPayloads['collection_web_scraping_save']) => requestCollection('collection_web_scraping_save', input);
/** The signal can stop preparation before the mutation is sent; committed writes are not cancellable. */
export async function createCollectionImage(input: Pick<CreateCollectionItemInput, 'organisationId' | 'collectionId' | 'title' | 'note' | 'tagIds'> & { url?: string; fileName: string; blob: Blob; signal?: AbortSignal; onPrepareProgress?: (percent: number) => void; onSaveStarted?: () => void }): Promise<CollectionItemRecord> {
  const { blob } = input;
  const checkCancelled = () => { if (input.signal?.aborted) throw new DOMException('Image preparation cancelled.', 'AbortError'); };
  checkCancelled();
  validateImageAsset(blob);
  if (!hasImageSignature(new Uint8Array(await blob.slice(0, 12).arrayBuffer()), blob.type)) throw new CollectionClientError('INVALID_INPUT', 'Image bytes do not match the declared MIME type.');
  checkCancelled();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    checkCancelled();
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    input.onPrepareProgress?.(Math.min(99, Math.round(((offset + 0x8000) / bytes.length) * 100)));
    if (offset > 0 && offset % (1024 * 1024) === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  checkCancelled();
  input.onPrepareProgress?.(100);
  checkCancelled();
  const base64 = btoa(parts.join(''));
  checkCancelled();
  input.onSaveStarted?.();
  checkCancelled();
  return createCollectionItem({ organisationId: input.organisationId, collectionId: input.collectionId, title: input.title, note: input.note,
    ...(input.tagIds !== undefined ? { tagIds: input.tagIds } : {}), ...(input.url ? { url: input.url } : {}),
    type: 'screenshot', data: { base64, mimeType: blob.type, fileName: input.fileName } });
}
export const getCollectionItem = (organisationId: string, id: string) => requestCollection('collection_item_get', { organisationId, id });
export async function getCollectionElementSnapshot(organisationId: string, id: string) {
  const result = await requestCollection('collection_element_snapshot_get', { organisationId, id });
  if (result === null) return null;
  try {
    const snapshot = validateElementSnapshotRecord(result);
    if (snapshot.id !== id || snapshot.organisationId !== organisationId) throw new Error('Snapshot scope changed.');
    return snapshot;
  } catch { throw new CollectionClientError('TRANSPORT_ERROR', 'Invalid Element snapshot response.'); }
}
export const listCollectionItems = (organisationId: string, collectionId: string, type?: CollectionItemRecord['type']) => requestCollection('collection_item_list', { organisationId, collectionId, ...(type ? { type } : {}) });
export const readCollectionItemImageChunk = (organisationId: string, id: string, offset: number, assetId?: string) => requestCollection('collection_item_image_read', { organisationId, id, offset, ...(assetId ? { assetId } : {}) });
export async function readCollectionImage(organisationId: string, id: string, signal?: AbortSignal, assetId?: string): Promise<{ blob: Blob; fileName?: string }> {
  const parts: BlobPart[] = [];
  let offset = 0;
  let mimeType: string | null = null;
  let byteSize: number | null = null;
  let fileName: string | undefined;
  while (true) {
    if (signal?.aborted) throw new DOMException('Image read cancelled.', 'AbortError');
    const chunk = await readCollectionItemImageChunk(organisationId, id, offset, assetId);
    if (signal?.aborted) throw new DOMException('Image read cancelled.', 'AbortError');
    if (chunk.offset !== offset || !Number.isSafeInteger(chunk.byteSize) || chunk.byteSize < 0 || chunk.byteSize > MAX_ASSET_FILE_SIZE ||
        (mimeType !== null && mimeType !== chunk.mimeType) || (byteSize !== null && byteSize !== chunk.byteSize)) {
      throw new CollectionClientError('TRANSPORT_ERROR', 'Image response changed during reading.');
    }
    mimeType = chunk.mimeType;
    byteSize = chunk.byteSize;
    fileName = chunk.fileName;
    let binary: string;
    try { binary = atob(chunk.base64); }
    catch { throw new CollectionClientError('TRANSPORT_ERROR', 'Invalid image response bytes.'); }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    parts.push(bytes);
    offset += bytes.length;
    if (offset > byteSize || (chunk.nextOffset !== null && (chunk.nextOffset !== offset || bytes.length === 0))) throw new CollectionClientError('TRANSPORT_ERROR', 'Invalid image response offset.');
    if (chunk.nextOffset === null) break;
  }
  if (offset !== byteSize || mimeType === null) throw new CollectionClientError('TRANSPORT_ERROR', 'Incomplete image response.');
  const blob = new Blob(parts, { type: mimeType });
  if (signal?.aborted) throw new DOMException('Image read cancelled.', 'AbortError');
  validateImageAsset(blob);
  if (!hasImageSignature(new Uint8Array(await blob.slice(0, 12).arrayBuffer()), mimeType)) throw new CollectionClientError('TRANSPORT_ERROR', 'Invalid image response type.');
  return { blob, ...(fileName ? { fileName } : {}) };
}
export const updateCollectionItem = (organisationId: string, id: string, input: CollectionRequestPayloads['collection_item_update']['input']) => requestCollection('collection_item_update', { organisationId, id, input });
export const deleteCollectionItem = async (organisationId: string, id: string): Promise<void> => { await requestCollection('collection_item_delete', { organisationId, id }); };
