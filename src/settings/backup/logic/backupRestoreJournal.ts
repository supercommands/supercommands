import { db } from '../../../storage/indexDB/dbConfig';
import { withAssetLifecycleLock } from '../../../storage/assets/assetLifecycle';
import { getImageFileExtension } from '../../../storage/assets/assetPolicy';
import { restoreLocalSettingsBackup } from './localSettingsBackup';
import { ASSET_BLOB_BACKUP_FIELD, ASSET_FILE_BACKUP_FIELD } from './assetBackupPayload';

export const BACKUP_RESTORE_JOURNAL_ID = 'backup-restore-v1';
export const BACKUP_RESTORE_RETRY_ALARM = 'supercommands-backup-restore-recovery';
export async function requestBackupRestoreRetry(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  try {await chrome.alarms.create(BACKUP_RESTORE_RETRY_ALARM, {delayInMinutes: 1});}
  catch (error) {console.warn('[Backup Restore] Retry alarm unavailable; next startup will retry.', error);}
}
export interface BackupRestoreJournal {
  id: typeof BACKUP_RESTORE_JOURNAL_ID;
  idMap: Record<string, string>;
  phase: 'staging' | 'committed';
  stagedPaths: string[];
  obsoletePaths: string[];
  settings: Record<string, unknown>;
  settingsComplete?: boolean;
  cleanupComplete?: boolean;
}

async function assetDirectory(create = false): Promise<FileSystemDirectoryHandle | undefined> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return undefined;
  const root = await navigator.storage.getDirectory();
  try {return await root.getDirectoryHandle('assets', {create});}
  catch (error) {if (!create && error instanceof DOMException && error.name === 'NotFoundError') return undefined; throw error;}
}

async function removeUnusedPaths(paths: readonly string[]): Promise<void> {
  const livePaths = new Set((await db.assets.toArray()).map(record => record.storagePath).filter(Boolean));
  const removable = [...new Set(paths)].filter(path => !livePaths.has(path));
  if (!removable.length) return;
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) throw new Error('OPFS cleanup is unavailable; restore cleanup remains pending.');
  const directory = await assetDirectory();
  for (const path of removable) {
    if (!/^assets\/[A-Za-z0-9_-]+\.(png|jpg|webp|gif|bin)$/.test(path)) throw new Error('Unsafe restore cleanup path; file retained.');
    if (!directory) continue;
    try {await directory.removeEntry(path.slice('assets/'.length));}
    catch (error) {if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;}
  }
}

/** Caller holds the asset lifecycle lock. Never repeats a database replacement. */
export async function resumeBackupRestoreLocked(): Promise<void> {
  const journal = await db.migrationMetadata.get(BACKUP_RESTORE_JOURNAL_ID) as unknown as BackupRestoreJournal | undefined;
  if (!journal) return;
  if (journal.phase === 'staging') {
    await removeUnusedPaths(journal.stagedPaths);
    await db.migrationMetadata.delete(journal.id);
    return;
  }
  if (journal.phase !== 'committed') throw new Error('Unsupported restore journal phase.');
  const results = await Promise.allSettled([
    (async () => {
      if (journal.cleanupComplete) return;
      await removeUnusedPaths(journal.obsoletePaths);
      await db.migrationMetadata.update(journal.id, {cleanupComplete: true} as any);
    })(),
    (async () => {
      if (journal.settingsComplete) return;
      await restoreLocalSettingsBackup(journal.settings);
      await db.migrationMetadata.update(journal.id, {settingsComplete: true});
    })(),
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length) throw new Error('Restore data is committed; recovery remains pending: ' + failures.map(result => String(result.reason)).join('; '));
  await db.migrationMetadata.delete(journal.id);
}

export async function resumePendingBackupRestore(): Promise<void> {
  await db.open();
  await withAssetLifecycleLock(resumeBackupRestoreLocked);
}

/** Reserve unique paths durably before writing; current assets are never overwritten. */
export async function stageBackupRestoreAssets(records: any[], blobs: ReadonlyMap<string, Blob>, settings: Record<string, unknown>): Promise<any[]> {
  const directory = records.length ? await assetDirectory(true) : undefined;
  const nonce = crypto.randomUUID();
  const paths = directory ? records.map(record => `assets/${record.id}_restore_${nonce}.${getImageFileExtension(record.mimeType)}`) : [];
  const obsoletePaths = (await db.assets.toArray()).filter(record => record.storageDriver === 'opfs' && record.storagePath).map(record => record.storagePath!);
  const journal: BackupRestoreJournal = {id: BACKUP_RESTORE_JOURNAL_ID, idMap: {}, phase: 'staging', stagedPaths: paths, obsoletePaths, settings};
  await db.migrationMetadata.put(journal as any);
  const staged: any[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index], blob = blobs.get(record.id)!;
    const {[ASSET_BLOB_BACKUP_FIELD]: _dataUrl, [ASSET_FILE_BACKUP_FIELD]: _archivePath, blob: _blob, pendingDeletionAt: _pending, ...metadata} = record;
    if (!directory) {
      staged.push({...metadata, blob, storageDriver: 'indexeddb', storagePath: undefined});
      continue;
    }
    const file = await directory.getFileHandle(paths[index].slice('assets/'.length), {create: true});
    const writable = await file.createWritable();
    try {await writable.write(blob); await writable.close();}
    catch (error) {await writable.abort().catch(() => undefined); throw error;}
    staged.push({...metadata, blob: undefined, storageDriver: 'opfs', storagePath: paths[index]});
  }
  return staged;
}

let initialized = false;
/** A separate startup readiness task; it does not participate in schema upgrades. */
export function initializeBackupRestoreRecovery(): void {
  if (initialized) return;
  initialized = true;
  const recover = async () => {
    try {
      await resumePendingBackupRestore();
      await chrome.alarms.clear(BACKUP_RESTORE_RETRY_ALARM);
    } catch (error) {
      console.warn('[Backup Restore] Recovery will retry; database remains readable.', error);
      await requestBackupRestoreRetry();
    }
  };
  chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === BACKUP_RESTORE_RETRY_ALARM) void recover();});
  void recover();
}
