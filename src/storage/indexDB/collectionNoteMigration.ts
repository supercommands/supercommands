import type { Transaction } from 'dexie';

/** Only Collection item metadata changes; identity, content and revisions stay intact. */
export async function migrateCollectionItemNotes(tx: Transaction): Promise<void> {
  await tx.table('collectionItems').toCollection().modify(row => {
    if (row.note === undefined && row.description !== undefined) row.note = row.description;
    delete row.description;
  });
}
