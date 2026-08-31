import { StorageManager } from '../../../storage/localStorage/storageManager';

export const LOCAL_SETTINGS_BACKUP_FILE = 'settings.json';

export const LOCAL_SETTINGS_BACKUP_KEYS = [
  'theme-id-storage-key',
  'wallpaper-id-storage-key',
  'appearance-brightness-storage-key',
  'appearance-brightness-v2-migrated',
  'appearance-warm-tint-storage-key',
  'appearance-warm-tint-strength-storage-key',
  'custom-wallpaper-base64',
  'appearance-wallpaper',
  'todo_display_mode',
  'sidebar_create_section_collapsed',
  'sidebar_my_library_section_collapsed',
  'sidebar_views_section_collapsed',
  'lastUsedWorkspaceId',
] as const;

export type LocalSettingsBackupKey = (typeof LOCAL_SETTINGS_BACKUP_KEYS)[number];
export type LocalSettingsBackup = Partial<Record<LocalSettingsBackupKey, unknown>>;

export async function extractLocalSettingsBackup(): Promise<LocalSettingsBackup> {
  const data = await StorageManager.getItem([...LOCAL_SETTINGS_BACKUP_KEYS]);
  const backup: LocalSettingsBackup = {};

  for (const key of LOCAL_SETTINGS_BACKUP_KEYS) {
    if (data[key] !== undefined) {
      backup[key] = data[key];
    }
  }

  return backup;
}

export async function restoreLocalSettingsBackup(settings: Record<string, unknown> | undefined): Promise<void> {
  if (!settings || typeof settings !== 'object') return;

  const rawSettings = settings as Record<string, unknown>;

  // Legacy backup compatibility migration for old backups containing obsolete 'appearance-theme'
  const canonicalTheme = rawSettings['theme-id-storage-key'];
  const obsoleteTheme = rawSettings['appearance-theme'];

  if (
    (canonicalTheme === undefined || canonicalTheme === null) &&
    typeof obsoleteTheme === 'string' &&
    obsoleteTheme.trim() !== ''
  ) {
    await StorageManager.setItem('theme-id-storage-key', obsoleteTheme);
  }

  const allowedKeys = new Set<string>(LOCAL_SETTINGS_BACKUP_KEYS);
  for (const [key, value] of Object.entries(settings)) {
    if (!allowedKeys.has(key)) continue;
    await StorageManager.setItem(key, value);
  }
}
