import { BACKUP_KIND, BACKUP_SCHEMA_VERSION, BACKUP_TABLE_NAMES } from './backupRegistry';
import { LOCAL_SETTINGS_BACKUP_FILE } from './localSettingsBackup';
import { validateBackupGraph } from './backupGraphValidation';
import type { BackupData } from './extractData';

/** Strict contract for newly produced backups; legacy imports use their versioned normalizer. */
export function validateCurrentBackupSnapshot(backup: BackupData): void {
  const manifest = backup.manifest;
  if (!manifest || manifest.schemaVersion !== BACKUP_SCHEMA_VERSION || manifest.source !== 'cmdos'
    || manifest.backupKind !== BACKUP_KIND || manifest.status !== 'complete') throw new Error('Invalid current backup manifest.');
  if (!backup.localSettings || typeof backup.localSettings !== 'object' || Array.isArray(backup.localSettings)) throw new Error('Invalid backup settings.');
  const names = new Set<string>(BACKUP_TABLE_NAMES);
  if (!Array.isArray(manifest.tables) || manifest.tables.length !== names.size || new Set(manifest.tables).size !== names.size
    || manifest.tables.some(name => !names.has(name))) throw new Error('Backup manifest does not declare the complete table registry.');
  if (!backup.tables || Object.keys(backup.tables).some(name => !names.has(name))) throw new Error('Backup contains unregistered tables.');
  for (const name of BACKUP_TABLE_NAMES) {
    const rows = backup.tables[name];
    if (!Array.isArray(rows)) throw new Error(`Backup is missing table ${name}.`);
    if (manifest.tableCounts?.[name] !== rows.length) throw new Error(`Backup count does not match table ${name}.`);
    const files = manifest.files?.filter(file => file.kind === 'table' && file.tableName === name);
    if (files?.length !== 1 || files[0].name !== `tables/${name}.json` || files[0].recordCount !== rows.length) throw new Error(`Invalid backup file declaration for ${name}.`);
  }
  if (manifest.files?.length !== names.size + 2 || new Set(manifest.files.map(file => file.name)).size !== manifest.files.length
    || !manifest.files.some(file => file.kind === 'manifest' && file.name === 'manifest.json')
    || !manifest.files.some(file => file.kind === 'settings' && file.name === LOCAL_SETTINGS_BACKUP_FILE)) throw new Error('Invalid backup file manifest.');
  validateBackupGraph(backup.tables);
}
