import Dexie from 'dexie';

/** Compare persisted values, not JSON key ordering. Timestamps alone do not conflict. */
export async function legacyRecordsEqual(current: any, incoming: any, recordRoot = true): Promise<boolean> {
  if (Object.is(current, incoming)) return true;
  if (current == null || incoming == null || typeof current !== typeof incoming) return false;
  if (current instanceof Blob || incoming instanceof Blob) {
    if (!(current instanceof Blob && incoming instanceof Blob)
      || current.type !== incoming.type || current.size !== incoming.size) return false;
    const [left, right] = await Promise.all([current.arrayBuffer(), incoming.arrayBuffer()]);
    return legacyRecordsEqual(left, right, false);
  }
  if (current instanceof Date || incoming instanceof Date)
    return current instanceof Date && incoming instanceof Date && current.getTime() === incoming.getTime();
  if (current instanceof ArrayBuffer || incoming instanceof ArrayBuffer || ArrayBuffer.isView(current) || ArrayBuffer.isView(incoming)) {
    const bytes = (value: any) => value instanceof ArrayBuffer ? new Uint8Array(value)
      : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
    const left = bytes(current), right = bytes(incoming);
    return !!left && !!right && left.length === right.length && left.every((value, index) => value === right[index]);
  }
  if (typeof current !== 'object' || Array.isArray(current) !== Array.isArray(incoming)) return false;
  if (Array.isArray(current)) {
    if (current.length !== incoming.length) return false;
    for (let index = 0; index < current.length; index++)
      if (!await legacyRecordsEqual(current[index], incoming[index], false)) return false;
    return true;
  }
  if (Object.getPrototypeOf(current) !== Object.prototype || Object.getPrototypeOf(incoming) !== Object.prototype) return false;
  const keys = (value: any) => Object.keys(value).filter(key => value[key] !== undefined
    && !(recordRoot && ['createdAt', 'updatedAt'].includes(key))).sort();
  const left = keys(current), right = keys(incoming);
  if (left.length !== right.length || left.some((key, index) => key !== right[index])) return false;
  for (const key of left) if (!await legacyRecordsEqual(current[key], incoming[key], false)) return false;
  return true;
}

/** Caller owns the import transaction. Conflicts preserve both versions without blocking startup. */
export async function mergeLegacyImportRows(database: any, tables: Record<string, any[]>, sourceDatabase: string) {
  const conflicts: {table: string; recordId: string; recoveryId: string}[] = [];
  const known = new Set(database.tables.map((table: any) => table.name));
  for (const [name, rows] of Object.entries(tables)) {
    // commands is a source-owned catalog cache, rebuilt after opening; never import old seeds.
    if (!known.has(name) || ['migrationMetadata', 'commands'].includes(name)) continue;
    for (const row of rows) {
      const existing = await database.table(name).get(row.id);
      if (!existing) { await database.table(name).add(row); continue; }
      if (await Dexie.waitFor(legacyRecordsEqual(existing, row))) continue;
      const recoveryId = `legacy-import-conflict-v1:${encodeURIComponent(name)}:${encodeURIComponent(String(row.id))}`;
      await database.migrationMetadata.put({id: recoveryId, idMap: {}, sourceDatabase,
        table: name, recordId: row.id, resolution: 'kept-current', legacyRecord: row, currentRecord: existing});
      conflicts.push({table: name, recordId: row.id, recoveryId});
    }
  }
  return conflicts;
}

/** Resumable catalog refresh, outside ready: its service uses the opened singleton database. */
export async function finalizeLegacyCommandCatalog(database: any, seed: (force: boolean) => Promise<unknown>) {
  const imported = await database.migrationMetadata.get('legacy-database-import-complete');
  if (imported?.commandCatalogComplete !== false) return;
  await seed(true);
  await database.migrationMetadata.update(imported.id, {commandCatalogComplete: true});
}
