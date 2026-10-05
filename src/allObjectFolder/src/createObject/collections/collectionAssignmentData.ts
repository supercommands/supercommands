/** Shared assignment ownership and cascade cleanup; assignments remain in their existing tables. */
import { db } from '../../../../storage/indexDB/dbConfig';
import { CollectionStorageError } from './collectionErrors';

export async function requireWebCollectionAssignmentTarget(referenceId: string) {
  const collection = await db.collections.get(referenceId);
  if (!collection || !await db.organisations.get(collection.organisationId)) {
    throw new CollectionStorageError('NOT_FOUND', 'This Collection or its Organisation no longer exists.');
  }
  return collection;
}

/** Caller includes userShortcuts/userHotkeys in its deletion transaction. */
export async function deleteWebCollectionAssignments(collectionIds: readonly string[]): Promise<void> {
  const ids = new Set(collectionIds);
  if (!ids.size) return;
  await db.userShortcuts.where('referenceType').equals('webCollection').and(record => ids.has(record.referenceId)).delete();
  await db.userHotkeys.where('referenceType').equals('webCollection').and(record => ids.has(record.referenceId)).delete();
}
