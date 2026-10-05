import { getBackupRecordIdentity } from './backupIdentity';
import type { BackupConflictResolution, BackupDataLike, BackupMergeConflict, BackupMergeResult } from './backupComparisonTypes';
import { validateMergedSnapshot } from './validateMergedSnapshot';
import { LOCAL_SETTINGS_BACKUP_KEYS } from './localSettingsBackup';

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return structuredClone(value);
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  if (parts.some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) throw new Error('Invalid backup conflict path.');
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
  const removedItems = new Set<string>();
  const resolutionMap = new Map(resolutions.map(resolution => [resolution.conflictKey, resolution]));
  if (resolutionMap.size !== resolutions.length) throw new Error('Duplicate backup conflict resolution.');
  const requiredConflicts = new Map([...mergeResult.conflicts, ...conflicts].map(conflict => [conflictKey(conflict), conflict]));

  for (const conflict of requiredConflicts.values()) {
    const resolution = resolutionMap.get(conflictKey(conflict));
    if (!resolution) throw new Error(`Unresolved backup conflict: ${conflictKey(conflict)}`);
    const choice = resolution.choice;
    if (!['local', 'drive', 'manual', 'delete'].includes(choice)) throw new Error('Invalid backup conflict choice.');
    if (choice === 'manual' && resolution.manualValue === undefined) throw new Error('Manual backup resolution requires a value.');
    if (conflict.scope !== 'setting' && (!conflict.tableName || !conflict.identity || !Array.isArray(snapshot.tables[conflict.tableName]))) throw new Error('Invalid backup record conflict target.');

    const selectedValue = choice === 'local'
      ? conflict.localValue
      : choice === 'drive'
        ? conflict.driveValue
        : choice === 'manual'
          ? resolution.manualValue
          : undefined;
    if (conflict.scope === 'setting') {
      if (!LOCAL_SETTINGS_BACKUP_KEYS.includes(conflict.path as any)) throw new Error('Invalid backup preference conflict target.');
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
      if (conflict.tableName === 'collectionItems' && recordIndex >= 0) removedItems.add(String(table[recordIndex].id));
      if (recordIndex >= 0) table.splice(recordIndex, 1);
      continue;
    }

    if (conflict.path === '') {
      if (selectedValue !== undefined && getBackupRecordIdentity(conflict.tableName!, selectedValue as Record<string, unknown>) !== conflict.identity) throw new Error('Backup resolution cannot change record identity.');
      if (selectedValue === undefined) {
        if (conflict.tableName === 'collectionItems' && recordIndex >= 0) removedItems.add(String(table[recordIndex].id));
        if (recordIndex >= 0) table.splice(recordIndex, 1);
      } else if (recordIndex >= 0) table[recordIndex] = clone(selectedValue);
      else if (selectedValue) table.push(clone(selectedValue));
      continue;
    }

    const record = findRecord(snapshot, conflict);
    if (!record) throw new Error('Backup conflict target record is missing.');
    setPath(record, conflict.path, selectedValue);
    if (getBackupRecordIdentity(conflict.tableName!, record) !== conflict.identity) throw new Error('Backup resolution cannot change record identity.');
  }

  // Only explicit item removals cascade. Other orphan/mismatched rows remain validation errors.
  if (removedItems.size) snapshot.tables.collectionElementSnapshots = (snapshot.tables.collectionElementSnapshots || []).filter(row => !removedItems.has(row.id));
  validateMergedSnapshot(snapshot);
  return snapshot;
}
