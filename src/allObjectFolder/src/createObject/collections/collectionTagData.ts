import { db } from '../../../../storage/indexDB/dbConfig';
import { CollectionStorageError } from './collectionErrors';

/** Call within a transaction containing tags and workspaces. Global tags are shared. */
export async function assertCollectionItemTagOwnership(organisationId: string, tagIds: readonly string[]): Promise<void> {
  const tags = await db.tags.bulkGet([...tagIds]);
  for (const tag of tags) {
    if (!tag) throw new CollectionStorageError('NOT_FOUND', 'A selected tag no longer exists.');
    if (tag.workspaceId == null) continue;
    const workspace = await db.workspaces.get(tag.workspaceId);
    if (!workspace) throw new CollectionStorageError('NOT_FOUND', 'The selected tag’s Workspace no longer exists.');
    if (workspace.organisationId !== organisationId)
      throw new CollectionStorageError('INVALID_OWNERSHIP', 'A selected tag belongs to another Organisation.');
  }
}

/** Caller owns the deletion transaction; advance revisions to prevent stale autosave resurrection. */
export async function removeCollectionItemTagReferences(tagIds: readonly string[]): Promise<void> {
  if (!tagIds.length) return;
  const removed = new Set(tagIds);
  await db.collectionItems.where('tagIds').anyOf([...removed]).distinct().modify(item => {
    const next = item.tagIds.filter(id => !removed.has(id));
    if (next.length === item.tagIds.length) return;
    item.tagIds = next;
    item.updatedAt = Math.max(Date.now(), item.updatedAt + 1);
  });
}
