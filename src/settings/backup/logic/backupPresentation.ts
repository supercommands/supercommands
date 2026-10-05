import type { BackupData, BackupManifest } from './extractData';
import type { BackupRestoreResult } from './restoreData';

export interface CollectionBackupSummary { propertyDefinitionCount: number; propertyValueCount: number; }
export function collectionBackupSummary(tables: Record<string, any[]>): CollectionBackupSummary {
  return {
    propertyDefinitionCount: (tables.collections || []).reduce((count, row) => count + (row.propertyDefinitions?.length || 0), 0),
    propertyValueCount: (tables.collectionItems || []).reduce((count, row) => count + Object.keys(row.propertyValues || {}).length, 0),
  };
}
export function backupTableLabel(name: string): string {
  return ({widgetDashboards: 'Home dashboards', widgets: 'Home widgets', widgetLayouts: 'Home widget layouts'} as Record<string, string>)[name]
    || name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, value => value.toUpperCase());
}
export function backupFieldDisplay(value: unknown, tableName: string): string {
  if (value === undefined) return 'Not present';
  if (typeof value === 'string') {
    if (tableName === 'collections' || tableName === 'collectionItems') return JSON.stringify(value);
    return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() || 'Empty';
  }
  return JSON.stringify(value, null, 2) ?? 'Not present';
}
export function manifestCollectionSummary(manifest?: BackupManifest): CollectionBackupSummary | undefined {
  const summary = manifest?.collectionSummary;
  return summary && [summary.propertyDefinitionCount, summary.propertyValueCount].every(value => Number.isSafeInteger(value) && value >= 0) ? summary : undefined;
}
function restoreCounts(backup: BackupData): string {
  const count = (name: string) => backup.tables[name]?.length || 0;
  const properties = collectionBackupSummary(backup.tables);
  return `${count('organisations')} organisations, ${count('workspaces')} workspaces, ${count('collections')} collections, ${count('collectionItems')} collection items, ${properties.propertyDefinitionCount} custom properties and ${properties.propertyValueCount} populated property values`;
}
export function restoreConfirmationMessage(name: string, incoming: BackupData, current: BackupData | null): string {
  const version = incoming.manifest.originalSchemaVersion ?? incoming.manifest.schemaVersion;
  const lines = [`Replace all local data with "${name}"?`, '',
    current ? `Current data: ${restoreCounts(current)}.` : 'Current counts are unavailable. This still replaces all current local data.',
    `Backup data: ${restoreCounts(incoming)}.`, '',
    'This is a full replacement, not a merge. Current Notes, Links, Text Expanders, Todos, Agents, Prompts, Collections, images, Home layouts and backed-up preferences are replaced.',
    'Current custom-property definitions and values are replaced by those in the backup.'];
  if (version < 8 && incoming.tables.collections.length === 0 && incoming.tables.collectionItems.length === 0)
    lines.push('This older backup contains no Collections. All current Collections, Collection items and their custom-property definitions/values will be removed.');
  if (version < 7) lines.push('Old saved sessions and dashboard views are discarded. Starter Workspaces are provisioned using the existing compatibility policy.');
  lines.push('', 'Proceed with replacement?');
  return lines.join('\n');
}
export function restoreCompletionMessage(result: BackupRestoreResult): string {
  return result.recoveryPending
    ? 'Data restored. Preference restoration or old-image cleanup is still pending and will retry automatically. Reloading the application...'
    : 'Data and preferences restored successfully. Reloading the application...';
}
export function backupFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
