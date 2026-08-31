import type { BackupData } from './extractData';
import { LOCAL_SETTINGS_BACKUP_KEYS } from './localSettingsBackup';
import { BACKUP_TABLE_NAMES } from './backupRegistry';
import { getBackupRecordIdentity } from './backupIdentity';
import type {
  BackupComparisonResult,
  BackupFieldChange,
  BackupRecordDifference,
  BackupSettingDifference,
  BackupTableDifferences,
} from './backupComparisonTypes';
import { backupValuesAreEqual } from './normalizeBackupValue';
import { BACKUP_COMPARISON_EXCLUDED_TABLE_NAMES, getBackupSchemaDescriptor } from './schemaComparisonRegistry';

function isDeleted(record: Record<string, unknown> | undefined, tableName: string): boolean {
  const deletionField = getBackupSchemaDescriptor(tableName).deletionField;
  return !!deletionField && !!record?.[deletionField];
}

function collectFieldChanges(localValue: unknown, driveValue: unknown, tableName: string, path = ''): BackupFieldChange[] {
  if (backupValuesAreEqual(localValue, driveValue, tableName)) return [];
  if (!localValue || !driveValue || typeof localValue !== 'object' || typeof driveValue !== 'object') {
    return [{
      path,
      localValue,
      driveValue,
      kind: localValue === undefined ? 'added' : driveValue === undefined ? 'removed' : 'changed',
    }];
  }

  const localObject = localValue as Record<string, unknown>;
  const driveObject = driveValue as Record<string, unknown>;
  const descriptor = getBackupSchemaDescriptor(tableName);
  const ignoredFields = new Set(descriptor.ignoredFields || []);
  const allowedFields = descriptor.comparisonFields ? new Set(descriptor.comparisonFields) : undefined;
  const keys = new Set(
    [...Object.keys(localObject), ...Object.keys(driveObject)]
      .filter(key => !allowedFields || path !== '' || allowedFields.has(key))
      .filter(key => !ignoredFields.has(key))
  );
  return [...keys].flatMap(key => collectFieldChanges(localObject[key], driveObject[key], tableName, path ? `${path}.${key}` : key));
}

function collectVisibleRecordChanges(localRecord: Record<string, unknown>, driveRecord: Record<string, unknown>, tableName: string): BackupFieldChange[] {
  const descriptor = getBackupSchemaDescriptor(tableName);
  const fields = descriptor.comparisonFields || Object.keys(localRecord);
  return fields.filter(field => field !== 'id' && !descriptor.ignoredFields?.includes(field)).flatMap(field => {
    const localValue = localRecord[field];
    const driveValue = driveRecord[field];
    return backupValuesAreEqual(localValue, driveValue, tableName)
      ? []
      : [{ path: field, localValue, driveValue, kind: localValue === undefined ? 'added' as const : driveValue === undefined ? 'removed' as const : 'changed' as const }];
  });
}

function compareTable(tableName: string, localRecords: any[], driveRecords: any[]): BackupTableDifferences {
  const localMap = new Map(localRecords.map(record => [getBackupRecordIdentity(tableName, record), record]));
  const driveMap = new Map(driveRecords.map(record => [getBackupRecordIdentity(tableName, record), record]));
  const differences: BackupTableDifferences = { added: [], removed: [], deleted: [], changed: [], unchanged: [] };

  for (const identity of new Set([...localMap.keys(), ...driveMap.keys()])) {
    const localRecord = localMap.get(identity);
    const driveRecord = driveMap.get(identity);
    const fieldChanges = localRecord && driveRecord
      ? collectFieldChanges(localRecord, driveRecord, tableName)
      : [];
    const base: Omit<BackupRecordDifference, 'kind'> = {
      tableName,
      identity,
      localRecord,
      driveRecord,
      fields: fieldChanges.length > 0 || !localRecord || !driveRecord
        ? fieldChanges
        : collectVisibleRecordChanges(localRecord, driveRecord, tableName),
    };

    const descriptor = getBackupSchemaDescriptor(tableName);
    const ignoredFields = descriptor.ignoredFields || [];
    const allowedFields = descriptor.comparisonFields;
    if (!localRecord) differences.removed.push({ ...base, fields: Object.keys(driveRecord || {}).filter(path => (!allowedFields || allowedFields.includes(path)) && !ignoredFields.includes(path)).map(path => ({ path, localValue: undefined, driveValue: driveRecord?.[path], kind: 'removed' as const })), kind: 'removed' });
    else if (!driveRecord) differences.added.push({ ...base, fields: Object.keys(localRecord || {}).filter(path => (!allowedFields || allowedFields.includes(path)) && !ignoredFields.includes(path)).map(path => ({ path, localValue: localRecord?.[path], driveValue: undefined, kind: 'added' as const })), kind: 'added' });
    else if (isDeleted(localRecord, tableName) || isDeleted(driveRecord, tableName)) {
      differences.deleted.push({ ...base, kind: 'deleted' });
    // Classify records from the same filtered field diff that the review UI renders.
    // Comparing the raw records here can count metadata-only differences as visible changes.
    } else if (fieldChanges.length === 0) {
      differences.unchanged.push({ ...base, kind: 'unchanged' });
    } else {
      differences.changed.push({ ...base, kind: 'changed' });
    }
  }

  return differences;
}

export function compareBackupSnapshots(local: BackupData, drive: BackupData): BackupComparisonResult {
  const tables: Record<string, BackupTableDifferences> = {};
  let addedCount = 0;
  let removedCount = 0;
  let deletedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  for (const tableName of BACKUP_TABLE_NAMES) {
    const result = BACKUP_COMPARISON_EXCLUDED_TABLE_NAMES.includes(tableName)
      ? { added: [], removed: [], deleted: [], changed: [], unchanged: [] }
      : compareTable(tableName, local.tables[tableName] || [], drive.tables[tableName] || []);
    tables[tableName] = result;
    addedCount += result.added.length;
    removedCount += result.removed.length;
    deletedCount += result.deleted.length;
    changedCount += result.changed.length;
    unchangedCount += result.unchanged.length;
  }

  const settings: BackupSettingDifference[] = LOCAL_SETTINGS_BACKUP_KEYS.flatMap(key => {
    const localValue = local.localSettings?.[key];
    const driveValue = drive.localSettings?.[key];
    if (backupValuesAreEqual(localValue, driveValue)) return [];
    return [{
      key,
      kind: localValue === undefined ? 'removed' : driveValue === undefined ? 'added' : 'changed',
      localValue,
      driveValue,
    }];
  });

  return {
    tables,
    settings,
    summary: {
      addedCount,
      removedCount,
      deletedCount,
      changedCount,
      unchangedCount,
      settingsChangedCount: settings.length,
    },
  };
}
