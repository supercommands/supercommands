import { db } from '../../../storage/indexDB/dbConfig';
import { withAssetLifecycleLock } from '../../../storage/assets/assetLifecycle';
import type { BackupData } from './extractData';
import { BACKUP_TABLE_NAMES } from './backupRegistry';
import { prepareBackupSnapshot } from './prepareBackupSnapshot';
import { readBackupAssetBlobs } from './backupAssetPayloads';
import { BACKUP_RESTORE_JOURNAL_ID, requestBackupRestoreRetry, resumeBackupRestoreLocked, stageBackupRestoreAssets } from './backupRestoreJournal';

export interface BackupRestoreResult { dataRestored: true; recoveryPending: boolean; }

/** Whole-profile replacement. Existing UI confirmation remains the authorization boundary. */
export async function restoreDatabaseFromJSON(input: BackupData): Promise<BackupRestoreResult> {
  const backup = prepareBackupSnapshot(input);
  // Never borrow image bytes from the current profile to repair an incomplete import.
  const blobs = await readBackupAssetBlobs(backup, {allowLiveReads: false});
  await db.open();
  return withAssetLifecycleLock(async () => {
    await resumeBackupRestoreLocked();
    try {
      backup.tables.assets = await stageBackupRestoreAssets(backup.tables.assets, blobs, backup.localSettings);
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.filter(table => table.name !== 'migrationMetadata').map(table => table.clear()));
        for (const name of BACKUP_TABLE_NAMES) {
          if (backup.tables[name].length) await db.table(name).bulkAdd(backup.tables[name]);
        }
        // Preserve once-only provisioning semantics without changing schema upgrades.
        for (const owner of backup.tables.organisations) {
          const templateIds = Object.fromEntries(backup.tables.workspaces.filter(row => row.organisationId === owner.id).map(row => [row.id, row.id]));
          await db.migrationMetadata.put({id: 'workspace-provisioning:' + owner.id, idMap: {}, templateIds, completed: true});
        }
        await db.migrationMetadata.update(BACKUP_RESTORE_JOURNAL_ID, {phase: 'committed'} as any);
      });
    } catch (error) {
      // A failed transaction retains the original database and its original files.
      try {await resumeBackupRestoreLocked();}
      catch (cleanupError) {
        console.warn('[Backup Restore] Staged cleanup remains pending.', cleanupError);
        await requestBackupRestoreRetry();
      }
      throw error;
    }
    try {
      await resumeBackupRestoreLocked();
      return {dataRestored: true, recoveryPending: false};
    } catch (error) {
      console.warn('[Backup Restore] Data committed; preferences/file cleanup will retry.', error);
      await requestBackupRestoreRetry();
      return {dataRestored: true, recoveryPending: true};
    }
  });
}
