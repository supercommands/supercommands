import { extractDatabaseToJSON, BackupData } from './extractData';
import { StorageManager } from '../../../storage/localStorage/storageManager';
import {
  BACKUP_KIND,
  NEXT_DRIVE_BACKUP_NUMBER_KEY,
  formatDriveBackupFolderName,
} from './backupRegistry';
import { LOCAL_SETTINGS_BACKUP_FILE } from './localSettingsBackup';
import { BACKUP_ARCHIVE_MIME_TYPE, buildBackupArchive, readBackupArchive } from './backupArchive';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAX_BACKUPS = 20;
const BACKUP_APP_PROPERTY_TYPE = 'cmdos-backup';

type BackupStatus = 'success' | 'failed';

interface ExecuteDriveBackupOptions {
  interactive?: boolean;
  mode?: 'manual' | 'scheduled';
  waitForMaintenance?: boolean;
  downloadArchive?: boolean;
}

export interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
  mimeType?: string;
  size?: string;
  appProperties?: Record<string, string>;
  storageKind?: 'zip' | 'folder';
  backupNumber?: number;
  parentBackupNumber?: number;
  parentBackupId?: string;
  manifest?: BackupData['manifest'];
}

interface DownloadBackupOptions {
  hydrateAssets?: boolean;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function createBackupPerfTrace(label: string) {
  const started = performance.now();
  let last = started;
  const rows: Array<{ stage: string; durationMs: number; totalMs: number; detail?: unknown }> = [];

  return {
    mark(stage: string, detail?: unknown) {
      const now = performance.now();
      rows.push({
        stage,
        durationMs: Math.round(now - last),
        totalMs: Math.round(now - started),
        detail,
      });
      last = now;
    },
    log() {
      console.table(rows);
      console.log(`[Backup Perf] ${label} total`, `${Math.round(performance.now() - started)} ms`);
    },
  };
}

function downloadArchiveBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function checkedFetch(url: string, init: RequestInit, context: string): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${context} failed (${response.status} ${response.statusText})${body ? `: ${body}` : ''}`);
  }
  return response;
}

async function checkedJson<T>(url: string, init: RequestInit, context: string): Promise<T> {
  const response = await checkedFetch(url, init, context);
  return response.json() as Promise<T>;
}

function parseAppPropertyNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseBackupNumberFromName(name: string): number | undefined {
  const match = name.match(/_v(\d+)(?:\.zip)?$/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function manifestFromAppProperties(file: DriveFolder): BackupData['manifest'] | undefined {
  const props = file.appProperties || {};
  if (props.status && props.status !== 'complete') return undefined;
  const backupNumber = parseAppPropertyNumber(props.backupNumber) || parseBackupNumberFromName(file.name);
  if (!backupNumber) return undefined;

  return {
    source: 'cmdos',
    schemaVersion: Number(props.schemaVersion) || 0,
    backupNumber,
    createdAt: props.createdAt || file.createdTime,
    estimatedPayloadBytes: parseAppPropertyNumber(props.estimatedPayloadBytes) || (file.size ? Number(file.size) : undefined),
    backupKind: BACKUP_KIND,
    status: 'complete',
    parentBackupNumber: parseAppPropertyNumber(props.parentBackupNumber),
    parentBackupId: props.parentBackupId || undefined,
    tableCounts: {},
    tables: [],
    files: [],
  };
}

function getStorageValue<T>(key: string): Promise<T | undefined> {
  return StorageManager.getItem(key).then(value => (value === null ? undefined : (value as T)));
}

function setStorageValues(values: Record<string, unknown>): Promise<void> {
  return Promise.all(Object.entries(values).map(([key, value]) => StorageManager.setItem(key, value))).then(() => {});
}

async function recordBackupStatus(status: BackupStatus, mode: string, error?: unknown): Promise<void> {
  const now = new Date().toISOString();
  await setStorageValues({
    lastBackupAt: now,
    lastBackupStatus: status,
    lastBackupMode: mode,
    ...(error ? { lastBackupError: toErrorMessage(error) } : { lastBackupError: '' }),
  });
}

function getHighestBackupNumberFromBackups(backups: DriveFolder[]): number {
  let highest = 0;

  for (const folder of backups) {
    const backupNumber = folder.backupNumber || parseBackupNumberFromName(folder.name);
    if (backupNumber && backupNumber > highest) {
      highest = backupNumber;
    }
  }

  return highest;
}

async function getNextDriveBackupNumberFromBackups(existingBackups: DriveFolder[]): Promise<number> {
  const stored = await getStorageValue<number>(NEXT_DRIVE_BACKUP_NUMBER_KEY);
  const localNext = Number.isFinite(stored) && Number(stored) > 0 ? Number(stored) : 1;
  const highestDriveBackupNumber = getHighestBackupNumberFromBackups(existingBackups);
  const driveNext = highestDriveBackupNumber + 1;
  const countBasedNext = existingBackups.length + 1;
  // A fully empty Drive backup set starts a fresh numbering sequence. The
  // local counter may survive uninstall or manual folder deletion, so it
  // cannot override the empty Drive state.
  const nextBackupNumber = existingBackups.length === 0
    ? 1
    : Math.max(localNext, driveNext, countBasedNext);

  if (nextBackupNumber !== stored) {
    await setStorageValues({ [NEXT_DRIVE_BACKUP_NUMBER_KEY]: nextBackupNumber });
  }

  return nextBackupNumber;
}

async function markBackupNumberConsumed(backupNumber: number): Promise<void> {
  await setStorageValues({ [NEXT_DRIVE_BACKUP_NUMBER_KEY]: backupNumber + 1 });
}

export async function getDriveToken(options: { interactive?: boolean } = {}): Promise<string> {
  const interactive = options.interactive ?? true;
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, token => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error('Failed to get auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

export async function disconnectDrive(): Promise<void> {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: false }, token => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
            .then(() => {
              chrome.identity.clearAllCachedAuthTokens(() => resolve());
            })
            .catch(err => {
              console.error('Failed to revoke token:', err);
              chrome.identity.clearAllCachedAuthTokens(() => resolve());
            });
        });
      } else {
        resolve();
      }
    });
  });
}

async function findOrCreateMainFolder(_token: string): Promise<string> {
  return 'appDataFolder';
}

async function deleteDriveFile(token: string, fileId: string, context = 'Delete Drive file'): Promise<void> {
  await checkedFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
    context,
  );
}

export async function deleteDriveBackup(folderId: string, folderName: string): Promise<void> {
  const token = await getDriveToken({ interactive: true });
  await deleteDriveFile(token, folderId, `Delete Drive backup folder ${folderName}`);

  const remainingBackups = await listBackupsFromDrive(token);
  if (remainingBackups.length === 0) {
    await setStorageValues({ [NEXT_DRIVE_BACKUP_NUMBER_KEY]: 1 });
  }
}

const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

async function uploadBlobFile(
  token: string,
  parentId: string,
  name: string,
  blob: Blob,
  appProperties?: Record<string, string>,
): Promise<{ id: string; size?: string }> {
  const started = performance.now();
  const metadata = {
    name,
    parents: [parentId],
    mimeType: BACKUP_ARCHIVE_MIME_TYPE,
    appProperties,
  };

  console.log('[Backup Perf] Drive archive upload starting', {
    name,
    bytes: blob.size,
    mode: blob.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES ? 'resumable' : 'multipart',
  });

  if (blob.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    const sessionResponse = await checkedFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(metadata),
      },
      `Start resumable Drive backup upload ${name}`,
    );
    console.log('[Backup Perf] Drive resumable session ready', `${Math.round(performance.now() - started)} ms`, sessionResponse.status);
    const uploadUrl = sessionResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error(`Drive did not return a resumable upload URL for ${name}.`);
    }

    const uploadResponse = await checkedFetch(
      uploadUrl,
      {
        method: 'PUT',
        headers: {
          'Content-Type': BACKUP_ARCHIVE_MIME_TYPE,
        },
        body: blob,
      },
      `Upload Drive backup archive ${name}`,
    );
    console.log('[Backup Perf] Drive archive HTTP response', `${Math.round(performance.now() - started)} ms`, uploadResponse.status);
    const uploaded = await uploadResponse.json() as { id?: string; size?: string };
    console.log('[Backup Perf] Drive archive response parsed', `${Math.round(performance.now() - started)} ms`);
    if (!uploaded.id) throw new Error(`Drive backup archive upload completed without a file id for ${name}.`);
    return { id: uploaded.id, size: uploaded.size };
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const uploaded = await checkedJson<{ id?: string; size?: string }>(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
    `Upload Drive backup archive ${name}`,
  );
  console.log('[Backup Perf] Drive multipart upload completed', `${Math.round(performance.now() - started)} ms`);
  if (!uploaded.id) throw new Error(`Drive backup archive upload completed without a file id for ${name}.`);
  return { id: uploaded.id, size: uploaded.size };
}

async function listBackupFolderCandidates(token: string, mainFolderId: string): Promise<DriveFolder[]> {
  const query = `'${mainFolderId}' in parents and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&orderBy=createdTime desc&fields=files(id,name,mimeType,createdTime)`;
  const data = await checkedJson<{ files?: DriveFolder[] }>(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'List Drive backup folders',
  );
  return (data.files || []).filter(folder => {
    const folderName = folder.name.toLowerCase();
    return folderName.startsWith('cmdos_') || folderName.startsWith('cmdos-backup-');
  }).map(folder => ({
    ...folder,
    storageKind: 'folder' as const,
    backupNumber: parseBackupNumberFromName(folder.name),
  }));
}

async function listBackupArchiveFileCandidates(token: string, mainFolderId: string): Promise<DriveFolder[]> {
  const query = `'${mainFolderId}' in parents and mimeType!='${FOLDER_MIME_TYPE}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&orderBy=createdTime desc&fields=files(id,name,mimeType,createdTime,size,appProperties)`;
  const data = await checkedJson<{ files?: DriveFolder[] }>(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'List Drive backup archive files',
  );
  return (data.files || []).filter(file => {
    const fileName = file.name.toLowerCase();
    return file.appProperties?.type === BACKUP_APP_PROPERTY_TYPE
      || ((fileName.startsWith('cmdos_') || fileName.startsWith('cmdos-backup-')) && fileName.endsWith('.zip'));
  }).map(file => {
    const manifest = manifestFromAppProperties(file);
    return {
      ...file,
      storageKind: 'zip' as const,
      backupNumber: manifest?.backupNumber,
      parentBackupNumber: manifest?.parentBackupNumber,
      parentBackupId: manifest?.parentBackupId,
      manifest,
    };
  });
}

async function downloadManifestFromFolder(token: string, folderId: string): Promise<BackupData['manifest'] | null> {
  const query = `'${folderId}' in parents and name='manifest.json' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id,name)`;
  const data = await checkedJson<{ files?: { id: string; name: string }[] }>(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'Find Drive backup manifest',
  );
  const manifestFile = data.files?.[0];
  if (!manifestFile) return null;

  return checkedJson<BackupData['manifest']>(
    `https://www.googleapis.com/drive/v3/files/${manifestFile.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
    'Download Drive backup manifest',
  );
}

function isCompletedBackupManifest(manifest: BackupData['manifest'] | null): manifest is BackupData['manifest'] {
  return (
    !!manifest &&
    manifest.source === 'cmdos' &&
    manifest.backupKind === BACKUP_KIND &&
    manifest.status === 'complete' &&
    Number.isFinite(manifest.backupNumber)
  );
}

function getDriveBackupSortNumber(folder: DriveFolder): number {
  if (folder.backupNumber) return folder.backupNumber;

  return parseBackupNumberFromName(folder.name) || 0;
}

export async function enforceRotationLimit(token: string, mainFolderId: string): Promise<void> {
  const completedFolders = await listBackupsFromDrive(token);
  await enforceRotationLimitForBackups(token, completedFolders);
}

async function enforceRotationLimitForBackups(token: string, completedFolders: DriveFolder[]): Promise<void> {
  const oldestFirst = [...completedFolders].sort((a, b) => {
    return new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime();
  });

  if (oldestFirst.length > MAX_BACKUPS) {
    const overflowCount = oldestFirst.length - MAX_BACKUPS;
    for (let i = 0; i < overflowCount; i++) {
      const folderToDelete = oldestFirst[i];
      console.log(`[Backup] Deleting oldest completed backup to maintain limit: ${folderToDelete.name}`);
      await deleteDriveFile(token, folderToDelete.id, `Delete old Drive backup folder ${folderToDelete.name}`);
    }
  }
}

export const executeDriveBackup = async (
  optionsOrVersion: ExecuteDriveBackupOptions | number = {},
): Promise<DriveFolder> => {
  const options: ExecuteDriveBackupOptions =
    typeof optionsOrVersion === 'number' ? { interactive: true, mode: 'manual' } : optionsOrVersion;
  const interactive = options.interactive ?? true;
  const mode = options.mode ?? 'manual';
  const waitForMaintenance = options.waitForMaintenance ?? mode === 'scheduled';
  const shouldDownloadArchive = options.downloadArchive ?? false;
  let backupFileId: string | null = null;
  const perf = createBackupPerfTrace(`Drive backup (${mode})`);

  try {
    const token = await getDriveToken({ interactive });
    perf.mark('auth');
    const mainFolderId = await findOrCreateMainFolder(token);
    perf.mark('drive-root', { mainFolderId });
    const existingBackups = await listBackupsFromDrive(token);
    perf.mark('list-backups', { count: existingBackups.length });
    const parentBackup = existingBackups[0];
    const backupNumber = await getNextDriveBackupNumberFromBackups(existingBackups);
    perf.mark('version', { backupNumber });
    const backupData = await extractDatabaseToJSON(backupNumber, { includeAssetBlobPayloads: false });
    perf.mark('extract', { tables: Object.keys(backupData.tables).length });
    if (parentBackup?.backupNumber !== undefined) {
      backupData.manifest.parentBackupNumber = parentBackup.backupNumber;
      backupData.manifest.parentBackupId = parentBackup.id;
    }
    const backupArchiveName = `${formatDriveBackupFolderName(backupNumber)}.zip`;
    const archiveBlob = await buildBackupArchive(backupData);
    perf.mark('build-zip', { bytes: archiveBlob.size });
    const uploaded = await uploadBlobFile(token, mainFolderId, backupArchiveName, archiveBlob, {
      type: BACKUP_APP_PROPERTY_TYPE,
      schemaVersion: String(backupData.manifest.schemaVersion),
      backupNumber: String(backupNumber),
      createdAt: backupData.manifest.createdAt,
      status: backupData.manifest.status,
      estimatedPayloadBytes: String(archiveBlob.size),
      ...(backupData.manifest.parentBackupNumber ? { parentBackupNumber: String(backupData.manifest.parentBackupNumber) } : {}),
      ...(backupData.manifest.parentBackupId ? { parentBackupId: backupData.manifest.parentBackupId } : {}),
    });
    backupFileId = uploaded.id;
    perf.mark('upload', { id: backupFileId, bytes: uploaded.size || archiveBlob.size });
    if (shouldDownloadArchive) {
      downloadArchiveBlob(archiveBlob, backupArchiveName);
      perf.mark('download-zip');
    }
    await markBackupNumberConsumed(backupNumber);
    perf.mark('mark-version');

    const createdBackup: DriveFolder = {
      id: backupFileId,
      name: backupArchiveName,
      createdTime: backupData.manifest.createdAt,
      mimeType: BACKUP_ARCHIVE_MIME_TYPE,
      size: uploaded.size || String(archiveBlob.size),
      storageKind: 'zip',
      backupNumber,
      parentBackupNumber: backupData.manifest.parentBackupNumber,
      parentBackupId: backupData.manifest.parentBackupId,
      manifest: backupData.manifest,
    };

    const cleanupRetention = async () => {
      const retentionStarted = performance.now();
      try {
        await enforceRotationLimitForBackups(token, [createdBackup, ...existingBackups]);
        perf.mark('retention');
        console.log('[Backup Perf] Drive retention completed', `${Math.round(performance.now() - retentionStarted)} ms`);
      } catch (rotationError) {
        console.warn('[Backup] Drive rotation failed after backup completed:', rotationError);
      }
    };

    if (waitForMaintenance) {
      await cleanupRetention();
    } else {
      void cleanupRetention();
    }

    await recordBackupStatus('success', mode);
    perf.mark('record-status');
    if (!waitForMaintenance) perf.mark('user-facing-complete');
    perf.log();
    console.log('[Backup] Drive backup executed successfully.');
    return createdBackup;
  } catch (error) {
    if (backupFileId) {
      try {
        const token = await getDriveToken({ interactive: false });
        await deleteDriveFile(token, backupFileId, 'Delete incomplete Drive backup archive');
      } catch (cleanupError) {
        console.warn('[Backup] Failed to clean up incomplete Drive backup archive:', cleanupError);
      }
    }
    await recordBackupStatus('failed', mode, error);
    perf.mark('failed', { error: toErrorMessage(error) });
    perf.log();
    console.error('[Backup] Failed to execute Drive backup:', error);
    throw error;
  }
};

// ----- RESTORE LOGIC -----

export const listBackupsFromDrive = async (existingToken?: string): Promise<DriveFolder[]> => {
  const token = existingToken || (await getDriveToken());
  const mainFolderId = await findOrCreateMainFolder(token);
  const archiveBackups = (await listBackupArchiveFileCandidates(token, mainFolderId)).filter(file => {
    return file.manifest ? isCompletedBackupManifest(file.manifest) : true;
  });
  const legacyFolderBackups = await listBackupFolderCandidates(token, mainFolderId);

  return [...archiveBackups, ...legacyFolderBackups].sort((a, b) => {
    return getDriveBackupSortNumber(b) - getDriveBackupSortNumber(a);
  });
};

export const downloadBackupFromDrive = async (
  folderId: string,
  options: DownloadBackupOptions = {},
): Promise<BackupData> => {
  const token = await getDriveToken();
  const metadata = await checkedJson<DriveFolder>(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,createdTime,size,appProperties`,
    { headers: { Authorization: `Bearer ${token}` } },
    'Inspect Drive backup file',
  );

  if (metadata.mimeType !== FOLDER_MIME_TYPE) {
    const response = await checkedFetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
      `Download Drive backup archive ${metadata.name}`,
    );
    return readBackupArchive(await response.blob(), { hydrateAssets: options.hydrateAssets });
  }

  const query = `'${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id,name)`;
  const data = await checkedJson<{ files?: { id: string; name: string }[] }>(
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'List Drive backup folder files',
  );
  const files = data.files || [];

  const backupData: BackupData = {
    manifest: null as unknown as BackupData['manifest'],
    tables: {},
    localSettings: {},
  };

  for (const file of files) {
    if (!file.name.endsWith('.json')) continue;

    const content = await checkedJson<any>(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
      `Download Drive backup file ${file.name}`,
    );

    if (file.name === 'manifest.json') {
      backupData.manifest = content;
    } else if (file.name === LOCAL_SETTINGS_BACKUP_FILE) {
      backupData.localSettings = content;
    } else {
      const tableName = file.name.replace('.json', '');
      backupData.tables[tableName] = content;
    }
  }

  if (!backupData.manifest) {
    throw new Error('Manifest file not found in the backup folder.');
  }

  return backupData;
};
