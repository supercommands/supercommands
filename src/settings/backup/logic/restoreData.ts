import { db } from '../../../storage/indexDB/dbConfig';
import { BackupData } from './extractData';

export const restoreDatabaseFromJSON = async (backupData: BackupData): Promise<void> => {
  if (!backupData || !backupData.manifest || !backupData.tables) {
    throw new Error('Invalid backup data format. Missing manifest or tables.');
  }

  // The hierarchical insertion order to prevent broken relationships
  const insertionOrder = [
    // 1. Top-Level
    'workspaces',
    'commands',
    // 2. Second-Level (Depend on Workspaces)
    'folders',
    'tags',
    // 3. Third-Level (Depend on Workspaces/Folders)
    'notes',
    'links',
    'automations',
    'chatAgents',
    'aiPrompts',
    'snippets',
    // 4. Standalone/User Entities
    'todos',
    'userHotkeys',
    'userShortcuts',
    'triggerDailySummary',
    'triggerDailyBreakdown',
    'favorites'
  ] as const;

  // We use a single read-write transaction covering all tables.
  // If anything fails inside here, the entire transaction automatically rolls back.
  await db.transaction('rw', db.tables, async () => {
    // Step 1: Wipe all existing data first
    console.log('[Backup Restore] Wiping all existing tables...');
    await Promise.all(db.tables.map(table => table.clear()));

    // Step 2: Inject data strictly in the hierarchical order
    console.log('[Backup Restore] Injecting new data hierarchically...');
    for (const tableName of insertionOrder) {
      const recordsToInsert = backupData.tables[tableName];
      if (recordsToInsert && recordsToInsert.length > 0) {
        // @ts-ignore dynamic table access
        const table = db[tableName];
        if (table) {
          await (table as any).bulkAdd(recordsToInsert);
          console.log(`[Backup Restore] Successfully restored ${recordsToInsert.length} records into ${tableName}.`);
        } else {
          console.warn(`[Backup Restore] Warning: Table ${tableName} is present in backup but missing in current database schema.`);
        }
      }
    }
  });

  console.log('[Backup Restore] Restoration completed successfully!');
};
