import type { BackupData } from './extractData';
import { BACKUP_KIND, BACKUP_SCHEMA_VERSION, BACKUP_TABLE_NAMES, LEGACY_OPTIONAL_BACKUP_TABLE_NAMES } from './backupRegistry';
import { LOCAL_SETTINGS_BACKUP_FILE } from './localSettingsBackup';
import { normaliseOrganisationBackup } from './normaliseOrganisationBackup';
import { validateCurrentBackupSnapshot } from './backupSnapshotValidation';
import { validateMergedSnapshot } from './validateMergedSnapshot';
import { inheritCapturedBackupAssets } from './backupAssetPayloads';

/** Prepare data in memory. No live profile mutation or asset hydration occurs here. */
export function prepareBackupSnapshot(input: BackupData): BackupData {
  if (!input?.manifest || input.manifest.source !== 'cmdos' || input.manifest.backupKind !== BACKUP_KIND || input.manifest.status !== 'complete') throw new Error('Invalid or incomplete backup manifest.');
  const sourceVersion = input.manifest.originalSchemaVersion ?? input.manifest.schemaVersion;
  const backup = structuredClone(normaliseOrganisationBackup(input));
  inheritCapturedBackupAssets(input, backup);
  if (sourceVersion < BACKUP_SCHEMA_VERSION) {
    for (const name of LEGACY_OPTIONAL_BACKUP_TABLE_NAMES) {
      if (BACKUP_TABLE_NAMES.includes(name as any) && backup.tables[name] === undefined) backup.tables[name] = [];
    }
  } else {
    // The Phase-1 extractor used flat manifest names for canonical table payloads.
    backup.manifest.files = backup.manifest.files?.map(file => file.kind === 'table' && file.name === `${file.tableName}.json`
      ? {...file, name: `tables/${file.tableName}.json`} : file);
    validateCurrentBackupSnapshot(backup);
  }
  validateMergedSnapshot(backup);
  backup.manifest.tables = [...BACKUP_TABLE_NAMES];
  backup.manifest.tableCounts = Object.fromEntries(BACKUP_TABLE_NAMES.map(name => [name, backup.tables[name].length]));
  backup.manifest.files = [{name: 'manifest.json', kind: 'manifest'}, {name: LOCAL_SETTINGS_BACKUP_FILE, kind: 'settings'},
    ...BACKUP_TABLE_NAMES.map(name => ({name: `tables/${name}.json`, kind: 'table' as const, tableName: name, recordCount: backup.tables[name].length}))];
  return backup;
}
