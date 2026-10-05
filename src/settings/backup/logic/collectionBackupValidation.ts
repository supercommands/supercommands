import { object, fields, requiredText, optionalText, collectionSourceUrl, itemType, content } from '../../../allObjectFolder/src/createObject/collections/collectionValidation';
import { normalizeCollectionItemTagIds } from '../../../allObjectFolder/src/createObject/collections/collectionTagValidation';
import { collectionItemAssetIds } from '../../../allObjectFolder/src/createObject/collections/collectionItemAssets';
import type { CollectionItemRecord } from '../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { validateElementSnapshotRecord, assertElementSnapshotMatchesItem } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotValidation';

/** Pure snapshot validation: never queries IndexedDB, adopts images or rewrites content. */
export function validateCollectionBackupTables(tables: Record<string, any[]>): void {
  const fail = (message: string): never => { throw new Error(`Invalid Collection backup: ${message}`); };
  const index = (name: string, required = false): Map<string, any> => {
    if (!Array.isArray(tables[name])) {
      if (required) fail(`${name} must be an array.`);
      return new Map();
    }
    const records = new Map<string, any>();
    for (const record of tables[name]) {
      const id = requiredText(object(record, name).id, `${name} ID`);
      if (records.has(id)) fail(`duplicate ${name} ID ${id}.`);
      records.set(id, record);
    }
    return records;
  };
  const organisations = index('organisations'), tags = index('tags'), workspaces = index('workspaces'), assets = index('assets');
  const collections = index('collections', true), items = index('collectionItems', true);
  const snapshots = index('collectionElementSnapshots');
  const captures = new Set<string>();
  for (const value of snapshots.values()) {
    const snapshot = validateElementSnapshotRecord(value);
    const item = items.get(snapshot.id);
    if (!item) fail(`${snapshot.id}: snapshot has no Collection item.`);
    assertElementSnapshotMatchesItem(snapshot, item as CollectionItemRecord);
    if (captures.has(snapshot.captureId)) fail(`${snapshot.id}: duplicate capture identity.`);
    captures.add(snapshot.captureId);
    for (const resource of snapshot.resources) if (!assets.has(resource.assetId)) fail(`${snapshot.id}: snapshot asset ${resource.assetId} does not exist.`);
  }
  for (const table of ['userShortcuts', 'userHotkeys']) {
    for (const assignment of tables[table] || []) {
      if (assignment.referenceType !== 'webCollection') continue;
      if (!collections.has(assignment.referenceId)) fail(`${table} ${assignment.id}: missing Webclip ${assignment.referenceId}.`);
    }
  }
  const timestamps = (record: any) => {
    for (const key of ['createdAt', 'updatedAt'])
      if (typeof record[key] !== 'number' || !Number.isFinite(record[key]) || record[key] < 0) fail(`${record.id}: invalid ${key}.`);
  };
  const definitions = new Map<string, Set<string>>();
  for (const record of collections.values()) {
    fields(record, ['id', 'organisationId', 'name', 'propertyDefinitions', 'createdAt', 'updatedAt']);
    requiredText(record.name, 'Collection name'); timestamps(record);
    if (!organisations.has(record.organisationId)) fail(`${record.id}: Organisation does not exist.`);
    if (!Array.isArray(record.propertyDefinitions)) fail(`${record.id}: propertyDefinitions must be an array.`);
    const ids = new Set<string>();
    for (const definition of record.propertyDefinitions) {
      const value = object(definition, 'Property definition'); fields(value, ['id', 'label', 'type']);
      const id = requiredText(value.id, 'Property ID'); requiredText(value.label, 'Property label');
      if (value.type !== 'text') fail(`${record.id}: unsupported property type.`);
      if (ids.has(id)) fail(`${record.id}: duplicate property ID ${id}.`);
      ids.add(id);
    }
    definitions.set(record.id, ids);
  }
  for (const record of items.values()) {
    try {
      fields(record, ['id', 'organisationId', 'collectionId', 'title', 'note', 'tagIds', 'propertyValues', 'url', 'type', 'data', 'createdAt', 'updatedAt']);
      requiredText(record.title, 'Item title'); optionalText(record.note, 'Item note'); timestamps(record);
      const owner = collections.get(record.collectionId);
      if (!owner || owner.organisationId !== record.organisationId) fail(`${record.id}: invalid Collection ownership.`);
      const type = itemType(record.type);
      if (type === 'web-scraping' && record.data?.snapshotId !== undefined && !snapshots.has(record.id)) fail(`${record.id}: Element snapshot is missing.`);
      if (type !== 'screenshot' || record.url !== undefined) collectionSourceUrl(record.url);
      // Screenshot backup records must use persisted asset IDs, never upload Blobs.
      if (type === 'screenshot' && typeof record.data?.assetId !== 'string') fail(`${record.id}: screenshot asset ID is required.`);
      content(type, record.data);
      if (!Array.isArray(record.tagIds)) fail(`${record.id}: tagIds must be an array.`);
      const normalizedTags = normalizeCollectionItemTagIds(record.tagIds);
      if (normalizedTags.length !== record.tagIds.length || normalizedTags.some((id, index) => id !== record.tagIds[index])) fail(`${record.id}: tag IDs must be normalized and unique.`);
      for (const id of record.tagIds) {
        const tag = tags.get(id);
        if (!tag) fail(`${record.id}: tag ${id} does not exist.`);
        if (tag.workspaceId != null && workspaces.get(tag.workspaceId)?.organisationId !== record.organisationId) fail(`${record.id}: tag ${id} belongs to an invalid Workspace or another Organisation.`);
      }
      const values = object(record.propertyValues, 'Property values');
      for (const [id, value] of Object.entries(values)) {
        if (!definitions.get(record.collectionId)!.has(id)) fail(`${record.id}: orphan property value ${id}.`);
        if (typeof value !== 'string' || value === '') fail(`${record.id}: property values must be nonempty strings.`);
      }
      for (const id of collectionItemAssetIds(record as CollectionItemRecord))
        if (!assets.has(id)) fail(`${record.id}: image asset ${id} does not exist.`);
    } catch (error) {
      throw new Error(`Invalid Collection backup item ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
