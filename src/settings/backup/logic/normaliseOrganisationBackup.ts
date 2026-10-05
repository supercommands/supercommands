import { validateWidgetOwnership } from '../../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { convertPlatformTables } from '../../../storage/migrations/platformMigration';
import { validateWorkspaceTables } from '../../../storage/migrations/workspaceMigration';
import { retireWidgetSettings } from '../../../storage/migrations/widgetDashboardMigration';
import { convertOrganisationValue } from '../../../storage/migrations/organisationMigration';
import type { BackupData } from './extractData';
import { BACKUP_SCHEMA_VERSION, BACKUP_TABLE_NAMES } from './backupRegistry';
import { normaliseCollectionBackupTables } from './normaliseCollectionBackup';
import { validateCollectionBackupTables } from './collectionBackupValidation';
export function normaliseOrganisationTableCounts(counts: Record<string, number>, schemaVersion = BACKUP_SCHEMA_VERSION): Record<string, number> {
 const {folders, teams, ...rest} = counts;
 if (schemaVersion >= 7) return rest;
 const {workspaces, ...legacy} = rest;
 return workspaces === undefined ? legacy : {...legacy, organisations: (legacy.organisations || 0) + workspaces};
}
export function normaliseOrganisationBackup(backup: BackupData): BackupData {
 if (!backup?.manifest || !backup.tables) throw new Error('Invalid backup: missing manifest or tables.');
 const version = backup.manifest.schemaVersion;
 if (![3,4,5,6,7,8,9].includes(version)) throw new Error('Unsupported backup schema version: ' + version);
 const declared = [...(backup.manifest.tables || []), ...(backup.manifest.files || []).filter(file => file.kind === 'table').map(file => file.tableName || '')];
 const inputTables = normaliseCollectionBackupTables(backup.tables, version, declared);
 if (version >= 7) {
  if (backup.tables.sessions || backup.tables.widgetViews || backup.tables.folders || backup.tables.teams) throw new Error('Current backup contains retired tables.');
  validateWorkspaceTables(inputTables); validateWidgetOwnership(inputTables); validateCollectionBackupTables(inputTables);
  if (version === BACKUP_SCHEMA_VERSION) return backup;
  return withCurrentManifest(backup, inputTables);
 }
 if (version === 3 && !Array.isArray(backup.tables.workspaces)) throw new Error('Legacy backup is missing its workspaces table.');
 const converted = convertPlatformTables(inputTables, {resetHome: version < 6, sourceVersion: version === 6 ? 31 : version === 5 ? 29 : version === 4 ? 27 : 21});
 const tables = Object.fromEntries(Object.entries(converted.tables).filter(([name]) => BACKUP_TABLE_NAMES.includes(name as any)));
 validateWorkspaceTables(tables); validateWidgetOwnership(tables); validateCollectionBackupTables(tables);
 return withCurrentManifest({...backup, localSettings: retireWidgetSettings(convertOrganisationValue(backup.localSettings || {}, converted.migration.idMap), converted.migration.retiredIds)}, tables);
}

function withCurrentManifest(backup: BackupData, tables: Record<string, any[]>): BackupData {
 return {...backup, tables, manifest: {...backup.manifest, originalSchemaVersion: backup.manifest.originalSchemaVersion ?? backup.manifest.schemaVersion, schemaVersion: BACKUP_SCHEMA_VERSION, tables: Object.keys(tables) as any,
   tableCounts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
   files: [...(backup.manifest.files || []).filter(file => file.kind !== 'table'), ...Object.entries(tables).map(([name, rows]) => ({name: 'tables/' + name + '.json', kind: 'table' as const, tableName: name as any, recordCount: rows.length}))]}};
}

