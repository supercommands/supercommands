import { validateBackupGraph } from './backupGraphValidation';
import { BACKUP_TABLE_NAMES } from './backupRegistry';
import { getBackupRecordIdentity } from './backupIdentity';
import type { BackupDataLike } from './backupComparisonTypes';

export function validateMergedSnapshot(snapshot: BackupDataLike): void {
  if (Object.keys(snapshot.tables).some(name => !BACKUP_TABLE_NAMES.includes(name as any))) throw new Error('Merged backup contains unregistered tables.');
  for (const tableName of BACKUP_TABLE_NAMES) {
    const records = snapshot.tables[tableName];
    if (!Array.isArray(records)) {
      throw new Error(`Merged backup table ${tableName} must be an array`);
    }

    const identities = new Set<string>();
    for (const record of records) {
      const identity = getBackupRecordIdentity(tableName, record);
      if (identities.has(identity)) {
        throw new Error(`Merged backup table ${tableName} contains duplicate record ${identity}`);
      }
      identities.add(identity);
    }
  }

  validateBackupGraph(snapshot.tables);

  if (!snapshot.localSettings || typeof snapshot.localSettings !== 'object' || Array.isArray(snapshot.localSettings)) {
    throw new Error('Merged backup settings must be an object');
  }
}
