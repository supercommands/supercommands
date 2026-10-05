import type { Transaction } from 'dexie';

/** Add empty custom-property containers without changing existing content or revisions. */
export async function migrateCollectionProperties(tx: Transaction): Promise<void> {
  await tx.table('collections').toCollection().modify(row => {
    if (row.propertyDefinitions === undefined || row.propertyDefinitions === null) row.propertyDefinitions = [];
  });
  await tx.table('collectionItems').toCollection().modify(row => {
    if (row.propertyValues === undefined || row.propertyValues === null) row.propertyValues = {};
  });
}
