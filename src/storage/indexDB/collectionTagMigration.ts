import type { Transaction } from 'dexie';

/** Add optional tag associations without changing identity, content or item revisions. */
export async function migrateCollectionItemTags(tx: Transaction): Promise<void> {
  await tx.table('collectionItems').toCollection().modify(row => {
    // Preserve any pre-existing associations; historical untagged items gain the common column.
    if (row.tagIds === undefined || row.tagIds === null) row.tagIds = [];
  });
}
