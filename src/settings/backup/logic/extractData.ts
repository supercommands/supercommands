import { db } from '../../../storage/indexDB/dbConfig';

export interface BackupManifest {
  source: string;
  version: string;
  timestamp: string;
  tableCounts: Record<string, number>;
}

export interface BackupData {
  manifest: BackupManifest;
  tables: Record<string, any[]>;
}

export const extractDatabaseToJSON = async (versionNumber: number = 1): Promise<BackupData> => {
  const tables = [
    'workspaces',
    'folders',
    'notes',
    'links',
    'automations',
    'chatAgents',
    'aiPrompts',
    'snippets',
    'todos',
    'tags',
    'userHotkeys',
    'userShortcuts',
    'triggerDailySummary',
    'triggerDailyBreakdown',
    'favorites',
    'commands',
  ] as const;

  const backupData: BackupData = {
    manifest: {
      source: 'cmdos',
      version: `v${versionNumber}`,
      timestamp: new Date().toISOString(),
      tableCounts: {},
    },
    tables: {},
  };

  for (const tableName of tables) {
    try {
      // @ts-ignore - dynamic table access
      const table = db[tableName];
      if (table) {
        const records = await table.toArray();
        backupData.tables[tableName] = records;
        backupData.manifest.tableCounts[tableName] = records.length;
      } else {
        console.warn(`[Backup Extraction] Table ${tableName} not found in Dexie.`);
        backupData.tables[tableName] = [];
        backupData.manifest.tableCounts[tableName] = 0;
      }
    } catch (err) {
      console.error(`[Backup Extraction] Error reading table ${tableName}:`, err);
      backupData.tables[tableName] = [];
      backupData.manifest.tableCounts[tableName] = 0;
    }
  }

  return backupData;
};
