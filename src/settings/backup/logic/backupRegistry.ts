import { db } from '../../../storage/indexDB/dbConfig';
import { BRAND } from '../../../shared-components/brandingConfig';

export const BACKUP_SCHEMA_VERSION = 9;
export const DRIVE_BACKUP_RETENTION_LIMIT = 7;
export const BACKUP_KIND = 'folder';
export const NEXT_DRIVE_BACKUP_NUMBER_KEY = 'nextDriveBackupNumber';

export const BACKUP_TABLE_NAMES = [
  'organisations',
  'commands',
  'prefixSettings',
  'tags',
  'favoriteCategories',
  'notes',
  'links',
  'chatAgents',
  'aiPrompts',
  'snippets',
  'workspaces',
  'collections',
  'collectionItems',
  'collectionElementSnapshots',
  'todos',
  'userHotkeys',
  'userShortcuts',
  'triggerDailySummary',
  'triggerDailyBreakdown',
  'favorites',
  'assets',
  'widgets',
  'widgetLayouts',
  'widgetDashboards',
  'notifications',
] as const;

export const LEGACY_OPTIONAL_BACKUP_TABLE_NAMES = [
  'widgets',
  'widgetLayouts',
  'automations',
  'notifications',
] as const;

export const IGNORED_BACKUP_TABLE_NAMES = ['automations', 'notificationDeliveryJobs', 'migrationMetadata'] as const;

export type IgnoredBackupTableName = (typeof IGNORED_BACKUP_TABLE_NAMES)[number];

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

export function getRuntimeTableNames(): string[] {
  return db.tables.map(table => table.name);
}

export function assertBackupRegistryMatchesDexie(): void {
  const knownTables = new Set<string>(BACKUP_TABLE_NAMES);
  const ignoredTables = new Set<string>(IGNORED_BACKUP_TABLE_NAMES);
  const missingTables = getRuntimeTableNames().filter(
    tableName => !knownTables.has(tableName) && !ignoredTables.has(tableName)
  );

  if (missingTables.length > 0) {
    throw new Error(`Backup registry is missing Dexie table(s): ${missingTables.join(', ')}`);
  }
}

export function formatBackupNumber(backupNumber: number): string {
  return String(Math.max(1, Math.trunc(backupNumber)));
}

export function formatBackupTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    'T',
    `${pad(date.getHours())}-${pad(date.getMinutes())}`,
  ].join('_');
}

export function formatDriveBackupFolderName(backupNumber: number, date = new Date()): string {
  return `${BRAND.name}_${formatBackupTimestamp(date)}_V${formatBackupNumber(backupNumber)}`;
}
