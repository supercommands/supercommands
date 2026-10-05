/** Apply the historical optional-column defaults to a copy, never to live records.
 * Non-null malformed values remain intact so validation can report them safely.
 */
export function normaliseStoredCollectionFields(tables: Record<string, any[]>): Record<string, any[]> {
  const collections = (tables.collections || []).map(row => ({...row, propertyDefinitions: row.propertyDefinitions ?? []}));
  const collectionItems = (tables.collectionItems || []).map(row => {
    const {description, ...record} = row;
    if (description !== undefined && record.note !== undefined && description !== record.note) {
      throw new Error(`Invalid Collection backup item ${record.id}: conflicting note and legacy description; both values require review.`);
    }
    return {...record, ...(record.note === undefined && description !== undefined ? {note: description} : {}),
      tagIds: record.tagIds ?? [], propertyValues: record.propertyValues ?? {}};
  });
  return {...tables, collections, collectionItems};
}

/** Backup-only compatibility adapter; database migrations remain unchanged. */
export function normaliseCollectionBackupTables(tables: Record<string, any[]>, sourceVersion: number,
  declaredTables: readonly string[] = []): Record<string, any[]> {
  if (sourceVersion >= 9) {
    if (!Array.isArray(tables.collectionElementSnapshots)) throw new Error('Backup payload is missing or invalid: collectionElementSnapshots.');
  } else {
    if (declaredTables.includes('collectionElementSnapshots') || tables.collectionElementSnapshots !== undefined
        || (Array.isArray(tables.collectionItems) && tables.collectionItems.some(row => row?.data?.snapshotId !== undefined))) {
      throw new Error('Older backup schema cannot contain Element snapshots.');
    }
    tables = { ...tables, collectionElementSnapshots: [] };
  }
  const names = ['collections', 'collectionItems'];
  const present = names.filter(name => Object.prototype.hasOwnProperty.call(tables, name));
  if (sourceVersion >= 8 || present.length || names.some(name => declaredTables.includes(name))) {
    for (const name of names) if (!Array.isArray(tables[name])) throw new Error(`Backup payload is missing or invalid: ${name}.`);
  }
  if (sourceVersion >= 8) return tables;
  return normaliseStoredCollectionFields(tables);
}
