import { BACKUP_TABLE_NAMES } from './backupRegistry';
import { getBackupRecordIdentity } from './backupIdentity';
import { backupValuesAreEqual } from './normalizeBackupValue';
import { BACKUP_COMPARISON_EXCLUDED_TABLE_NAMES, getBackupSchemaDescriptor } from './schemaComparisonRegistry';
import type { BackupDataLike, BackupMergeConflict, BackupMergeResult } from './backupComparisonTypes';

interface MergeValueResult {
  value: unknown;
  conflicts: BackupMergeConflict[];
  autoResolvedCount: number;
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeValue(
  baseValue: unknown,
  localValue: unknown,
  driveValue: unknown,
  tableName: string,
  tablePath: string,
  context: Pick<BackupMergeConflict, 'tableName' | 'identity'>
): MergeValueResult {
  const fieldName = tablePath.split('.').pop() || '';
  const ignoredFields = getBackupSchemaDescriptor(tableName).ignoredFields || [];
  if (fieldName && ignoredFields.includes(fieldName)) {
    return {
      value: clone(localValue !== undefined ? localValue : driveValue !== undefined ? driveValue : baseValue),
      conflicts: [],
      autoResolvedCount: 1,
    };
  }

  if (backupValuesAreEqual(localValue, driveValue, tableName)) {
    return { value: clone(localValue), conflicts: [], autoResolvedCount: 1 };
  }
  if (backupValuesAreEqual(localValue, baseValue, tableName)) {
    return { value: clone(driveValue), conflicts: [], autoResolvedCount: 1 };
  }
  if (backupValuesAreEqual(driveValue, baseValue, tableName)) {
    return { value: clone(localValue), conflicts: [], autoResolvedCount: 1 };
  }

  if (isPlainObject(baseValue) || isPlainObject(localValue) || isPlainObject(driveValue)) {
    const baseObject = isPlainObject(baseValue) ? baseValue : {};
    const localObject = isPlainObject(localValue) ? localValue : {};
    const driveObject = isPlainObject(driveValue) ? driveValue : {};
    const merged: Record<string, unknown> = {};
    let conflicts: BackupMergeConflict[] = [];
    let autoResolvedCount = 0;

    for (const key of new Set([...Object.keys(baseObject), ...Object.keys(localObject), ...Object.keys(driveObject)])) {
      const result = mergeValue(
        baseObject[key],
        localObject[key],
        driveObject[key],
        tableName,
        tablePath ? `${tablePath}.${key}` : key,
        context,
      );
      if (result.value !== undefined) merged[key] = result.value;
      conflicts = conflicts.concat(result.conflicts);
      autoResolvedCount += result.autoResolvedCount;
    }

    return { value: merged, conflicts, autoResolvedCount };
  }

  return {
    value: clone(localValue),
    conflicts: [{
      scope: context.tableName ? 'record' : 'setting',
      tableName: context.tableName,
      identity: context.identity,
      path: tablePath,
      baseValue: clone(baseValue),
      localValue: clone(localValue),
      driveValue: clone(driveValue),
      reason: 'same-field-change',
    }],
    autoResolvedCount: 0,
  };
}

function recordsByIdentity(tableName: string, records: any[], conflicts: BackupMergeConflict[], side: string): Map<string, any> {
  const result = new Map<string, any>();
  for (const record of records) {
    try {
      const identity = getBackupRecordIdentity(tableName, record);
      if (result.has(identity)) {
        conflicts.push({
          scope: 'record',
          tableName,
          identity,
          path: side,
          reason: 'duplicate-identity',
        });
      } else {
        result.set(identity, record);
      }
    } catch {
      conflicts.push({
        scope: 'record',
        tableName,
        path: side,
        reason: 'invalid-record',
      });
    }
  }
  return result;
}

function mergeTable(
  tableName: string,
  baseRecords: any[],
  localRecords: any[],
  driveRecords: any[],
  conflicts: BackupMergeConflict[],
): { records: any[]; autoResolvedCount: number } {
  const baseMap = recordsByIdentity(tableName, baseRecords, conflicts, 'base');
  const localMap = recordsByIdentity(tableName, localRecords, conflicts, 'local');
  const driveMap = recordsByIdentity(tableName, driveRecords, conflicts, 'drive');
  const records: any[] = [];
  let autoResolvedCount = 0;

  for (const identity of new Set([...baseMap.keys(), ...localMap.keys(), ...driveMap.keys()])) {
    const base = baseMap.get(identity);
    const local = localMap.get(identity);
    const drive = driveMap.get(identity);

    if (!local && !drive) continue;
    if (!base && local && !drive) {
      records.push(clone(local));
      autoResolvedCount++;
      continue;
    }
    if (!base && drive && !local) {
      records.push(clone(drive));
      autoResolvedCount++;
      continue;
    }

    if (!local || !drive) {
      const present = local || drive;
      if (backupValuesAreEqual(present, base, tableName)) {
        autoResolvedCount++;
        continue;
      }
      conflicts.push({
        scope: 'record',
        tableName,
        identity,
        path: '',
        baseValue: clone(base),
        localValue: clone(local),
        driveValue: clone(drive),
        reason: 'delete-versus-edit',
      });
      if (present) records.push(clone(present));
      continue;
    }

    const result = mergeValue(base, local, drive, tableName, '', { tableName, identity });
    records.push(result.value);
    conflicts.push(...result.conflicts);
    autoResolvedCount += result.autoResolvedCount;
  }

  return { records, autoResolvedCount };
}

export function mergeBackupSnapshots(
  base: BackupDataLike | undefined,
  local: BackupDataLike,
  drive: BackupDataLike,
): BackupMergeResult {
  const conflicts: BackupMergeConflict[] = [];
  const tables: Record<string, any[]> = {};
  let autoResolvedCount = 0;

  for (const tableName of BACKUP_TABLE_NAMES) {
    if (BACKUP_COMPARISON_EXCLUDED_TABLE_NAMES.includes(tableName)) {
      tables[tableName] = clone(local.tables[tableName] || []);
      autoResolvedCount++;
      continue;
    }
    const result = mergeTable(
      tableName,
      base?.tables[tableName] || [],
      local.tables[tableName] || [],
      drive.tables[tableName] || [],
      conflicts,
    );
    tables[tableName] = result.records;
    autoResolvedCount += result.autoResolvedCount;
  }

  const localSettings = local.localSettings || {};
  const driveSettings = drive.localSettings || {};
  const baseSettings = base?.localSettings || {};
  const mergedSettings: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(baseSettings), ...Object.keys(localSettings), ...Object.keys(driveSettings)])) {
    const result = mergeValue(baseSettings[key], localSettings[key], driveSettings[key], 'settings', key, {});
    if (result.value !== undefined) mergedSettings[key] = result.value;
    conflicts.push(...result.conflicts);
    autoResolvedCount += result.autoResolvedCount;
  }

  return {
    snapshot: { tables, localSettings: mergedSettings },
    conflicts,
    autoResolvedCount,
  };
}
