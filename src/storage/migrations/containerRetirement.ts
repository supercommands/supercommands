import { convertOrganisationValue, type OrganisationIdMap } from './organisationMigration';

export const CONTAINER_RETIREMENT_KEY = 'organisation-flat-containers-v1';
import { retireContainerFields } from './containerFields';
export { retireContainerFields } from './containerFields';

/** Flatten folder-owned items to their existing organisation and retire folder-only associations. */
export function retireContainerTables(tables: Record<string, any[]>): { tables: Record<string, any[]>; referenceMap: OrganisationIdMap } {
  const referenceMap: OrganisationIdMap = Object.create(null);
  const retiredIds = new Set<string>();
  const owners = new Set((tables.organisations || []).map(row => row.id));
  for (const row of tables.folders || []) {
    if (!row?.id || !owners.has(row.organisationId)) throw new Error('Folder retirement: unresolved organisation for ' + row?.id);
    if (referenceMap[row.id] && referenceMap[row.id] !== row.organisationId) throw new Error('Folder retirement: conflicting owner for ' + row.id);
    retiredIds.add(row.id);
    referenceMap[row.id] = row.organisationId;
  }
  const result: Record<string, any[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (table === 'folders' || table === 'teams') continue;
    result[table] = rows.filter(row => {
      const ref = row.referenceId ?? row.reference_id;
      const type = row.referenceType ?? row.reference_type;
      return type !== 'folder' && type !== 'folder_search' && !retiredIds.has(ref) && row.scope !== 'folder';
    }).map(row => {
      const folderId = row.folderId ?? row.folder_id;
      const owner = row.organisationId ?? row.organisation_id;
      if (folderId && (!referenceMap[folderId] || (owner && referenceMap[folderId] !== owner))) {
        throw new Error('Folder retirement: unresolved or conflicting folder for ' + row.id);
      }
      return convertOrganisationValue(retireContainerFields(row), referenceMap);
    });
  }
  return {tables: result, referenceMap};
}
