export type BackupChangeKind = 'added' | 'removed' | 'deleted' | 'changed' | 'unchanged';

export interface BackupFieldChange {
  path: string;
  localValue: unknown;
  driveValue: unknown;
  kind: 'added' | 'removed' | 'changed';
  textDiff?: unknown;
}

export interface BackupRecordDifference {
  tableName: string;
  identity: string;
  kind: BackupChangeKind;
  localRecord?: Record<string, unknown>;
  driveRecord?: Record<string, unknown>;
  fields: BackupFieldChange[];
}

export interface BackupSettingDifference {
  key: string;
  kind: BackupChangeKind;
  localValue?: unknown;
  driveValue?: unknown;
}

export interface BackupTableDifferences {
  added: BackupRecordDifference[];
  removed: BackupRecordDifference[];
  deleted: BackupRecordDifference[];
  changed: BackupRecordDifference[];
  unchanged: BackupRecordDifference[];
}

export interface BackupComparisonResult {
  tables: Record<string, BackupTableDifferences>;
  settings: BackupSettingDifference[];
  summary: {
    addedCount: number;
    removedCount: number;
    deletedCount: number;
    changedCount: number;
    unchangedCount: number;
    settingsChangedCount: number;
  };
}

export interface BackupMergeConflict {
  scope: 'table' | 'record' | 'setting';
  tableName?: string;
  identity?: string;
  path: string;
  baseValue?: unknown;
  localValue?: unknown;
  driveValue?: unknown;
  reason: 'same-field-change' | 'delete-versus-edit' | 'duplicate-identity' | 'invalid-record';
}

export interface BackupMergeResult {
  snapshot: BackupDataLike;
  conflicts: BackupMergeConflict[];
  autoResolvedCount: number;
}

export type BackupConflictChoice = 'local' | 'drive' | 'delete' | 'manual';

export interface BackupConflictResolution {
  conflictKey: string;
  choice: BackupConflictChoice;
  manualValue?: unknown;
}

export interface BackupDataLike {
  tables: Record<string, any[]>;
  localSettings: Record<string, unknown>;
}
