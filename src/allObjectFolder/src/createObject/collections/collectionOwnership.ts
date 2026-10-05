import { db } from '../../../../storage/indexDB/dbConfig';
import { CollectionConflictError, CollectionStorageError } from './collectionErrors';
import type { CollectionRecord, CollectionItemRecord } from './collectionTypes';

export async function organisationExists(organisationId: string): Promise<void> {
  if (!await db.organisations.get(organisationId)) throw new CollectionStorageError('NOT_FOUND', 'Organisation not found.');
}

export async function ownedCollection(organisationId: string, id: string): Promise<CollectionRecord> {
  await organisationExists(organisationId);
  const record = await db.collections.get(id);
  if (!record) throw new CollectionStorageError('NOT_FOUND', 'Collection not found.');
  if (record.organisationId !== organisationId) throw new CollectionStorageError('INVALID_OWNERSHIP', 'Collection belongs to another Organisation.');
  return record;
}

export async function ownedItem(organisationId: string, id: string): Promise<CollectionItemRecord> {
  const record = await db.collectionItems.get(id);
  if (!record) throw new CollectionStorageError('NOT_FOUND', 'Collection item not found.');
  if (record.organisationId !== organisationId) throw new CollectionStorageError('INVALID_OWNERSHIP', 'Item belongs to another Organisation.');
  await ownedCollection(organisationId, record.collectionId);
  return record;
}

export function checkRevision(record: CollectionRecord | CollectionItemRecord, expected?: number): void {
  if (expected !== undefined && expected !== record.updatedAt) throw new CollectionConflictError(record);
}
