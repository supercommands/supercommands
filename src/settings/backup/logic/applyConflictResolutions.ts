import { getBackupRecordIdentity } from './backupIdentity';
import type { BackupConflictResolution, BackupDataLike, BackupMergeConflict, BackupMergeResult } from './backupComparisonTypes';
import { validateMergedSnapshot } from './validateMergedSnapshot';

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  const last = parts.pop() as string;
  let cursor = target;
  for (const part of parts) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  if (value === undefined) delete cursor[last];
  else cursor[last] = clone(value);
}

function findRecord(snapshot: BackupDataLike, conflict: BackupMergeConflict): Record<string, unknown> | undefined {
  if (!conflict.tableName || !conflict.identity) return undefined;
  return (snapshot.tables[conflict.tableName] || []).find(record => {
    try {
      return getBackupRecordIdentity(conflict.tableName as string, record) === conflict.identity;
    } catch {
      return false;
    }
  });
}

export function conflictKey(conflict: BackupMergeConflict): string {
  return `${conflict.scope}:${conflict.tableName || 'settings'}:${conflict.identity || ''}:${conflict.path}`;
}

export function applyConflictResolutions(
  mergeResult: BackupMergeResult,
  conflicts: BackupMergeConflict[],
  resolutions: BackupConflictResolution[],
): BackupDataLike {
  const snapshot = clone(mergeResult.snapshot);
  const resolutionMap = new Map(resolutions.map(resolution => [resolution.conflictKey, resolution]));

  for (const conflict of conflicts) {
    const resolution = resolutionMap.get(conflictKey(conflict));
    if (!resolution) continue;
    const choice = resolution.choice;

    const selectedValue = choice === 'local'
      ? conflict.localValue
      : choice === 'drive'
        ? conflict.driveValue
        : choice === 'manual'
          ? resolution.manualValue
          : undefined;
    if (conflict.scope === 'setting') {
      if (selectedValue === undefined) delete snapshot.localSettings[conflict.path];
      else snapshot.localSettings[conflict.path] = clone(selectedValue);
      continue;
    }

    const table = snapshot.tables[conflict.tableName as string] || [];
    const recordIndex = table.findIndex(record => {
      try {
        return getBackupRecordIdentity(conflict.tableName as string, record) === conflict.identity;
      } catch {
        return false;
      }
    });

    if (choice === 'delete') {
      if (recordIndex >= 0) table.splice(recordIndex, 1);
      continue;
    }

    if (conflict.path === '') {
      if (selectedValue === undefined) {
        if (recordIndex >= 0) table.splice(recordIndex, 1);
      } else if (recordIndex >= 0) table[recordIndex] = clone(selectedValue);
      else if (selectedValue) table.push(clone(selectedValue));
      continue;
    }

    const record = findRecord(snapshot, conflict);
    if (record) setPath(record, conflict.path, selectedValue);
  }

  validateMergedSnapshot(snapshot);
  return snapshot;
}
