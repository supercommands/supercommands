import Dexie from 'dexie';
import { deleteWebCollectionAssignments } from './collectionAssignmentData';
import { normalizeCollectionItemTagIds, normalizeCollectionItemTagIdsPatch } from './collectionTagValidation';
import { assertCollectionItemTagOwnership } from './collectionTagData';
import { normalizeCollectionItemNote } from './collectionItemNoteInput';
import { collectionItemAssetIds } from './collectionItemAssets';
import { resolveWebScrapingImages } from '../../../../shared-components/pageExtraction/webScraping/resolveWebScrapingImages';
import type { ExtractedWebScraping } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import type { WebScrapingData } from './collectionTypes';
import type { ElementSnapshotDraft, ElementSnapshotRecord } from './elementSnapshotTypes';
import { ELEMENT_CLIP_RUNTIME_LIMITS } from './elementSnapshotLimits';
import { validateElementSnapshotDraft, validateElementSnapshotRecord, validateElementSnapshotResources, assertElementSnapshotMatchesItem } from './elementSnapshotValidation';
import { db } from '../../../../storage/indexDB/dbConfig';
import { assetStore, type AssetSource } from '../../../../storage/assets/assetStore';
import { hasImageSignature, validateImageAsset } from '../../../../storage/assets/assetPolicy';
import { runAssetGarbageCollection } from '../../../../storage/assets/assetGarbageCollector';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import type { CollectionRecord, CollectionItemRecord, CollectionItemType } from './collectionTypes';
import type { CollectionImageChunk } from './collectionBridgeTypes';
import type { CreateCollectionInput, UpdateCollectionInput, CreateCollectionItemInput, UpdateCollectionItemInput } from './collectionInputs';
import { CollectionStorageError, CollectionConflictError } from './collectionErrors';
import { object, fields, requiredText, optionalText, collectionSourceUrl, optionalCollectionSourceUrl, itemType, revision, content, invalid } from './collectionValidation';
import { organisationExists, ownedCollection, ownedItem, checkRevision } from './collectionOwnership';

async function ensureOwnedImageReuse(organisationId: string, source: AssetSource, currentItemId?: string): Promise<void> {
  if (!('assetId' in source)) return;
  const matches = await db.collectionItems.where('organisationId').equals(organisationId).filter(item => collectionItemAssetIds(item).includes(source.assetId)).toArray();
  if (!matches.length && !currentItemId) throw new CollectionStorageError('INVALID_OWNERSHIP', 'Image asset is not owned by this Organisation.');
  if (!matches.length && currentItemId) {
    const current = await db.collectionItems.get(currentItemId);
    if (!current || current.organisationId !== organisationId || !collectionItemAssetIds(current).includes(source.assetId)) {
      throw new CollectionStorageError('INVALID_OWNERSHIP', 'Image asset is not owned by this Organisation.');
    }
  }
}
async function validateScreenshotSource(source: AssetSource): Promise<void> {
  if ('assetId' in source) return;
  validateImageAsset(source.blob);
  if (source.mimeType !== source.blob.type || !hasImageSignature(new Uint8Array(await source.blob.slice(0, 12).arrayBuffer()), source.mimeType)) {
    invalid('Image bytes do not match the declared MIME type.');
  }
}
const normalizeCollectionName = (name: string): string => name.trim().replace(/\s+/g, ' ');
async function ensureUniqueCollectionName(organisationId: string, name: string, excludeId?: string): Promise<void> {
  const key = normalizeCollectionName(name).toLocaleLowerCase();
  const existing = await db.collections.where('organisationId').equals(organisationId).toArray();
  if (existing.some(collection => collection.id !== excludeId && normalizeCollectionName(collection.name).toLocaleLowerCase() === key)) {
    throw new CollectionStorageError('INVALID_INPUT', 'A collection with this name already exists in this Organisation.');
  }
}
/** A committed deletion remains successful if later file cleanup needs retry. */
export async function cleanupReleasedCollectionAssets(): Promise<void> {
  await runAssetGarbageCollection().catch(error => console.error('[Collections] Asset cleanup needs retry.', error));
}

export async function createCollection(input: CreateCollectionInput): Promise<CollectionRecord> {
  const value = object(input, 'Collection input'); fields(value, ['organisationId', 'name']);
  const organisationId = requiredText(value.organisationId, 'Organisation ID');
  const name = normalizeCollectionName(requiredText(value.name, 'Collection name'));
  return db.transaction('rw', [db.organisations, db.collections], async () => {
    await organisationExists(organisationId);
    await ensureUniqueCollectionName(organisationId, name);
    const now = Date.now();
    const record: CollectionRecord = { id: generateEntityId('collection'), organisationId, name, propertyDefinitions: [], createdAt: now, updatedAt: now };
    await db.collections.add(record); return record;
  });
}
export async function getCollection(organisationId: string, id: string): Promise<CollectionRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Collection ID');
  return db.transaction('r', [db.organisations, db.collections], () => ownedCollection(organisationId, id));
}
export async function listCollections(organisationId: string): Promise<CollectionRecord[]> {
  organisationId = requiredText(organisationId, 'Organisation ID');
  return db.transaction('r', [db.organisations, db.collections], async () => {
    await organisationExists(organisationId);
    return db.collections.where('[organisationId+updatedAt]').between([organisationId, Dexie.minKey], [organisationId, Dexie.maxKey]).reverse().toArray();
  });
}
export async function updateCollection(organisationId: string, id: string, input: UpdateCollectionInput): Promise<CollectionRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Collection ID');
  const value = object(input, 'Collection update'); fields(value, ['name', 'expectedUpdatedAt']);
  const name = value.name === undefined ? undefined : normalizeCollectionName(requiredText(value.name, 'Collection name'));
  const expected = revision(value.expectedUpdatedAt);
  return db.transaction('rw', [db.organisations, db.collections], async () => {
    const current = await ownedCollection(organisationId, id); checkRevision(current, expected);
    if (name !== undefined) await ensureUniqueCollectionName(organisationId, name, id);
    const record = { ...current, ...(name !== undefined ? { name } : {}), updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.collections.put(record); return record;
  });
}
export async function deleteCollection(organisationId: string, id: string): Promise<void> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Collection ID');
  await db.transaction('rw', [db.organisations, db.collections, db.collectionItems, db.collectionElementSnapshots, db.userShortcuts, db.userHotkeys], async () => {
    await ownedCollection(organisationId, id);
    await deleteWebCollectionAssignments([id]);
    await db.collectionItems.where('collectionId').equals(id).delete();
    await db.collectionElementSnapshots.where('collectionId').equals(id).delete();
    await db.collections.delete(id);
  });
  await cleanupReleasedCollectionAssets();
}

export async function createCollectionItem(input: CreateCollectionItemInput): Promise<CollectionItemRecord> {
  const value = normalizeCollectionItemNote(object(input, 'Item input')); fields(value, ['organisationId', 'collectionId', 'title', 'note', 'tagIds', 'url', 'type', 'data']);
  const organisationId = requiredText(value.organisationId, 'Organisation ID');
  const collectionId = requiredText(value.collectionId, 'Collection ID');
  const title = requiredText(value.title, 'Title'), note = optionalText(value.note, 'Note');
  const tagIds = normalizeCollectionItemTagIds(value.tagIds);
  const type = itemType(value.type), data = content(type, value.data);
  if (type === 'web-scraping' && (data as WebScrapingData).snapshotId !== undefined) invalid('Use the acquired Element clip flow to create visual captures.');
  if (type === 'web-scraping' && 'images' in data && data.images.length) invalid('Use the Web Scraping acquisition flow to create image-bearing items.');
  const url = type === 'screenshot' ? optionalCollectionSourceUrl(value.url) : collectionSourceUrl(value.url);
  if (type === 'screenshot') { await validateScreenshotSource(data as AssetSource); await ensureOwnedImageReuse(organisationId, data as AssetSource); }
  // Validate scope before saving bytes, then recheck scope atomically at commit.
  await getCollection(organisationId, collectionId);
  await db.transaction('r', [db.tags, db.workspaces], () => assertCollectionItemTagOwnership(organisationId, tagIds));
  const persist = (storedData: CollectionItemRecord['data']) => db.transaction('rw', [db.organisations, db.collections, db.collectionItems, db.assets, db.tags, db.workspaces], async () => {
    await ownedCollection(organisationId, collectionId);
    await assertCollectionItemTagOwnership(organisationId, tagIds);
    if (type === 'screenshot') await ensureOwnedImageReuse(organisationId, data as AssetSource);
    if (type === 'screenshot' && !await db.assets.get((storedData as { assetId: string }).assetId)) throw new CollectionStorageError('NOT_FOUND', 'Asset no longer exists.');
    const now = Date.now();
    const record = { id: generateEntityId('collectionItem'), organisationId, collectionId, title, tagIds, propertyValues: {}, ...(url ? { url } : {}), ...(note ? { note } : {}), type, data: storedData, createdAt: now, updatedAt: now } as CollectionItemRecord;
    await db.collectionItems.add(record); return record;
  });
  if (type === 'screenshot') return assetStore.withAsset(data as AssetSource, asset => persist({ assetId: asset.id, ...('fileName' in data && data.fileName ? { fileName: data.fileName } : {}) }));
  return persist(data as CollectionItemRecord['data']);
}
export async function getCollectionItem(organisationId: string, id: string): Promise<CollectionItemRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Item ID');
  return db.transaction('r', [db.organisations, db.collections, db.collectionItems], () => ownedItem(organisationId, id));
}
/** Call inside an owner transaction. A pointer and companion row must agree. */
async function ownedElementSnapshot(item: CollectionItemRecord, validateContent = true): Promise<ElementSnapshotRecord | null> {
  const snapshot = await db.collectionElementSnapshots.get(item.id);
  if (!snapshot) {
    if (item.type === 'web-scraping' && item.data.snapshotId) throw new CollectionStorageError('NOT_FOUND', 'Element snapshot is missing.');
    return null;
  }
  // Chunk reads need current ownership/resources, not repeated 4-MiB AST serialization.
  if (validateContent) validateElementSnapshotRecord(snapshot); else validateElementSnapshotResources(snapshot.resources, true);
  assertElementSnapshotMatchesItem(snapshot, item);
  return snapshot;
}
export async function getCollectionElementSnapshot(organisationId: string, id: string): Promise<ElementSnapshotRecord | null> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Item ID');
  return db.transaction('r', [db.organisations, db.collections, db.collectionItems, db.collectionElementSnapshots], async () => ownedElementSnapshot(await ownedItem(organisationId, id)));
}
async function ownedItemAssetIds(organisationId: string, id: string): Promise<{ item: CollectionItemRecord; assetIds: string[] }> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Item ID');
  return db.transaction('r', [db.organisations, db.collections, db.collectionItems, db.collectionElementSnapshots], async () => {
    const item = await ownedItem(organisationId, id); const snapshot = await ownedElementSnapshot(item, false);
    return { item, assetIds: [...collectionItemAssetIds(item), ...(snapshot?.resources.map(resource => resource.assetId) || [])] };
  });
}
const IMAGE_CHUNK_BYTES = 256 * 1024;
export async function readCollectionItemImageChunk(organisationId: string, id: string, offset: number, requestedAssetId?: string): Promise<CollectionImageChunk> {
  if (!Number.isSafeInteger(offset) || offset < 0) invalid('Image offset must be a nonnegative integer.');
  const { item, assetIds } = await ownedItemAssetIds(organisationId, id);
  const assetId = requestedAssetId === undefined ? item.type === 'screenshot' ? item.data.assetId : invalid('Image asset ID is required.') : requiredText(requestedAssetId, 'Asset ID');
  if (!assetIds.includes(assetId)) throw new CollectionStorageError('INVALID_OWNERSHIP', 'Image is not referenced by this Collection item.');
  const asset = await assetStore.getAsset(assetId);
  if (!asset?.blob) throw new CollectionStorageError('NOT_FOUND', 'Image bytes are missing.');
  validateImageAsset(asset.blob);
  if (asset.mimeType !== asset.blob.type || !hasImageSignature(new Uint8Array(await asset.blob.slice(0, 12).arrayBuffer()), asset.mimeType)) {
    invalid('Stored image bytes do not match their MIME type.');
  }
  if (offset > asset.byteSize) invalid('Image offset exceeds the file size.');
  const nextOffset = Math.min(asset.byteSize, offset + IMAGE_CHUNK_BYTES);
  const bytes = new Uint8Array(await asset.blob.slice(offset, nextOffset).arrayBuffer());
  const latest = await ownedItemAssetIds(organisationId, id);
  if (!latest.assetIds.includes(assetId)) throw new CollectionConflictError(latest.item);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { mimeType: asset.mimeType, byteSize: asset.byteSize, offset, base64: btoa(binary), nextOffset: nextOffset < asset.byteSize ? nextOffset : null, ...(item.type === 'screenshot' && item.data.fileName ? { fileName: item.data.fileName } : {}) };
}
export async function listCollectionItems(organisationId: string, collectionId: string, type?: CollectionItemType): Promise<CollectionItemRecord[]> {
  organisationId = requiredText(organisationId, 'Organisation ID'); collectionId = requiredText(collectionId, 'Collection ID');
  if (type !== undefined) type = itemType(type);
  return db.transaction('r', [db.organisations, db.collections, db.collectionItems], async () => {
    await ownedCollection(organisationId, collectionId);
    const rows = await db.collectionItems.where('[organisationId+collectionId]').equals([organisationId, collectionId]).toArray();
    return rows.filter(row => type === undefined || row.type === type).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  });
}
export async function updateCollectionItem(organisationId: string, id: string, input: UpdateCollectionItemInput): Promise<CollectionItemRecord> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Item ID');
  const value = normalizeCollectionItemNote(object(input, 'Item update')); fields(value, ['collectionId', 'title', 'note', 'tagIds', 'url', 'type', 'data', 'expectedUpdatedAt']);
  const tagIdsPatch = normalizeCollectionItemTagIdsPatch(value.tagIds);
  const type = itemType(value.type), expected = revision(value.expectedUpdatedAt);
  const current = await getCollectionItem(organisationId, id); checkRevision(current, expected);
  if (type !== current.type) invalid('Item type cannot be changed.');
  const collectionId = value.collectionId === undefined ? current.collectionId : requiredText(value.collectionId, 'Collection ID');
  await getCollection(organisationId, collectionId);
  const title = value.title === undefined ? current.title : requiredText(value.title, 'Title');
  const url = value.url === undefined ? current.url : type === 'screenshot' && value.url === null ? undefined : collectionSourceUrl(value.url);
  const note = value.note === undefined ? current.note : value.note === null ? undefined : optionalText(value.note, 'Note');
  await db.transaction('r', [db.tags, db.workspaces], () => assertCollectionItemTagOwnership(organisationId, tagIdsPatch ?? current.tagIds));
  // data replaces the type-specific object; omitted data preserves existing content.
  const data = content(type, value.data === undefined ? current.data : value.data);
  const snapshot = await getCollectionElementSnapshot(organisationId, id);
  if (type === 'web-scraping') {
    if (snapshot && (JSON.stringify(data) !== JSON.stringify(current.data) || url !== current.url)) invalid('Captured content and source are immutable. Capture a new Element clip instead.');
    if (!snapshot && (data as WebScrapingData).snapshotId !== undefined) invalid('A visual capture cannot be attached through a generic item update.');
  }
  if (type === 'web-scraping') for (const image of (data as WebScrapingData).images) await ensureOwnedImageReuse(organisationId, { assetId: image.assetId }, id);
  if (type === 'screenshot') { await validateScreenshotSource(data as AssetSource); await ensureOwnedImageReuse(organisationId, data as AssetSource, id); }
  const persist = (storedData: CollectionItemRecord['data']) => db.transaction('rw', [db.organisations, db.collections, db.collectionItems, db.collectionElementSnapshots, db.assets, db.tags, db.workspaces], async () => {
    const latest = await ownedItem(organisationId, id); checkRevision(latest, current.updatedAt);
    await ownedCollection(organisationId, collectionId);
    if (type === 'screenshot') await ensureOwnedImageReuse(organisationId, data as AssetSource, id);
    if (type === 'screenshot' && !await db.assets.get((storedData as { assetId: string }).assetId)) throw new CollectionStorageError('NOT_FOUND', 'Asset no longer exists.');
    const tagIds = tagIdsPatch ?? latest.tagIds;
    await assertCollectionItemTagOwnership(organisationId, tagIds);
    const record = { ...latest, collectionId, title, tagIds,
      propertyValues: collectionId === latest.collectionId ? latest.propertyValues : {},
      data: storedData, updatedAt: Math.max(Date.now(), latest.updatedAt + 1) } as CollectionItemRecord;
    if (type === 'web-scraping') for (const image of (storedData as WebScrapingData).images) {
      await ensureOwnedImageReuse(organisationId, { assetId: image.assetId }, id);
      if (!await db.assets.get(image.assetId)) throw new CollectionStorageError('NOT_FOUND', 'Asset no longer exists.');
    }
    if (url === undefined) delete record.url; else record.url = url;
    if (note === undefined) delete record.note; else record.note = note;
    const latestSnapshot = await ownedElementSnapshot(latest);
    if (latestSnapshot && latestSnapshot.collectionId !== collectionId) {
      await db.collectionElementSnapshots.put({ ...latestSnapshot, collectionId });
    }
    await db.collectionItems.put(record); return record;
  });
  const record = type === 'screenshot'
    ? await assetStore.withAsset(data as AssetSource, asset => persist({ assetId: asset.id, ...('fileName' in data && data.fileName ? { fileName: data.fileName } : {}) }))
    : type === 'web-scraping' ? await assetStore.withAssets((data as WebScrapingData).images.map(image => ({ assetId: image.assetId })), () => persist(data as WebScrapingData))
    : await persist(data as CollectionItemRecord['data']);
  if (collectionItemAssetIds(current).some(assetId => !collectionItemAssetIds(record).includes(assetId))) await cleanupReleasedCollectionAssets();
  return record;
}
export async function deleteCollectionItem(organisationId: string, id: string): Promise<void> {
  organisationId = requiredText(organisationId, 'Organisation ID'); id = requiredText(id, 'Item ID');
  const screenshot = await db.transaction('rw', [db.organisations, db.collections, db.collectionItems, db.collectionElementSnapshots], async () => {
    const current = await ownedItem(organisationId, id);
    const snapshot = await db.collectionElementSnapshots.get(id);
    await db.collectionElementSnapshots.delete(id);
    await db.collectionItems.delete(id); return collectionItemAssetIds(current).length > 0 || Boolean(snapshot?.resources.length);
  });
  if (screenshot) await cleanupReleasedCollectionAssets();
}

/** Background acquisition supplies bytes, never caller-supplied asset IDs. */
export async function createAcquiredElementClip(input: { organisationId: string; collectionId: string; title: string; note?: string; tagIds?: string[] }, draft: ExtractedWebScraping, visualDraft: ElementSnapshotDraft, acquired: ReadonlyMap<string, Blob>): Promise<CollectionItemRecord> {
  draft = structuredClone(draft); acquired = new Map(acquired);
  const organisationId = requiredText(input.organisationId, 'Organisation ID');
  const collectionId = requiredText(input.collectionId, 'Collection ID');
  const title = requiredText(input.title, 'Title');
  const note = optionalText(input.note, 'Note');
  const tagIds = normalizeCollectionItemTagIds(input.tagIds);
  const url = collectionSourceUrl(draft.url);
  // Snapshot input is detached before awaiting bytes/ownership, so the caller cannot change it mid-save.
  const visual = structuredClone(validateElementSnapshotDraft(visualDraft));
  for (const resource of visual.resources) if (!acquired.has(resource.id)) invalid('Element snapshot resource bytes are missing.');
  for (const image of draft.images) if (!acquired.has(image.id)) invalid('Element clip image bytes are missing.');
  await getCollection(organisationId, collectionId);
  await db.transaction('r', [db.tags, db.workspaces], () => assertCollectionItemTagOwnership(organisationId, tagIds));
  const candidates = [...new Set([...draft.images.map(image => image.id), ...visual.resources.map(resource => resource.id)])]
    .filter(id => acquired.has(id)).map(id => ({ id }));
  let total = 0; const validated = new Set<Blob>();
  for (const candidate of candidates) {
    const blob = acquired.get(candidate.id)!;
    if (validated.has(blob)) continue;
    validated.add(blob);
    total += blob.size;
    if (total > ELEMENT_CLIP_RUNTIME_LIMITS.imageBytes) invalid('Captured images exceed 25 MiB.');
    await validateScreenshotSource({ blob, mimeType: blob.type });
  }
  try {
    const uniqueBlobs = [...validated];
    return await assetStore.withAssets(uniqueBlobs.map(blob => ({ blob, mimeType: blob.type })), assets => {
      const byBlob = new Map(uniqueBlobs.map((blob, index) => [blob, assets[index].id]));
      const adopted = new Map(candidates.map(image => [image.id, byBlob.get(acquired.get(image.id)!)!]));
      const semantic = resolveWebScrapingImages(draft, adopted);
      const captureId = generateEntityId('elementCapture');
      const data = content('web-scraping', { ...semantic, snapshotId: captureId }) as WebScrapingData;
      return db.transaction('rw', [db.organisations, db.collections, db.collectionItems, db.collectionElementSnapshots, db.assets, db.tags, db.workspaces], async () => {
        await ownedCollection(organisationId, collectionId);
        await assertCollectionItemTagOwnership(organisationId, tagIds);
        for (const image of data.images) if (!await db.assets.get(image.assetId)) throw new CollectionStorageError('NOT_FOUND', 'Asset no longer exists.');
        const now = Date.now();
        const record: CollectionItemRecord = { id: generateEntityId('collectionItem'), organisationId, collectionId, title, url,
          tagIds, propertyValues: {}, ...(note ? { note } : {}), type: 'web-scraping', data, createdAt: now, updatedAt: now };
        const snapshot = validateElementSnapshotRecord({ ...visual, id: record.id, captureId, organisationId, collectionId, sourceUrl: url,
          resources: visual.resources.map(resource => ({ id: resource.id, assetId: adopted.get(resource.id)! })) });
        assertElementSnapshotMatchesItem(snapshot, record);
        for (const resource of snapshot.resources) if (!await db.assets.get(resource.assetId)) throw new CollectionStorageError('NOT_FOUND', 'Snapshot asset no longer exists.');
        await db.collectionElementSnapshots.add(snapshot);
        await db.collectionItems.add(record); return record;
      });
    });
  } catch (error) { await cleanupReleasedCollectionAssets(); throw error; }
}

