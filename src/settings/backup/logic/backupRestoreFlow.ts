import type { BackupData } from './extractData';
import { prepareBackupSnapshot } from './prepareBackupSnapshot';
import { readBackupAssetBlobs } from './backupAssetPayloads';
import { restoreDatabaseFromJSON, type BackupRestoreResult } from './restoreData';
import { restoreConfirmationMessage } from './backupPresentation';

export interface BackupRestoreFlowOptions {
  name: string;
  loadBackup: () => Promise<BackupData>;
  loadCurrent: () => Promise<BackupData>;
  confirm: (message: string) => boolean | Promise<boolean>;
  restore?: (backup: BackupData) => Promise<BackupRestoreResult>;
}
/** Shared Local/Drive flow: validation and review precede any mutation. */
export async function runBackupRestoreFlow(options: BackupRestoreFlowOptions): Promise<BackupRestoreResult | null> {
  const incoming = prepareBackupSnapshot(await options.loadBackup());
  await readBackupAssetBlobs(incoming, {allowLiveReads: false});
  let current: BackupData | null = null;
  try {current = await options.loadCurrent();}
  catch (error) {console.warn('[Backup Restore] Current counts unavailable; replacement review will say so.', error);}
  if (!await options.confirm(restoreConfirmationMessage(options.name, incoming, current))) return null;
  return (options.restore || restoreDatabaseFromJSON)(incoming);
}
