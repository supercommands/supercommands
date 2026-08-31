import JSZip from 'jszip';
import { getImageFileExtension } from '../../../storage/assets/assetPolicy';
import { assetStore, prepareRestoredAssetRecord } from '../../../storage/assets/assetStore';
import { LOCAL_SETTINGS_BACKUP_FILE } from './localSettingsBackup';
import { ASSET_BLOB_BACKUP_FIELD, ASSET_FILE_BACKUP_FIELD } from './assetBackupPayload';
import type { BackupData } from './extractData';

const TABLES_DIRECTORY = 'tables/';
const ASSETS_DIRECTORY = 'assets/';
export const BACKUP_ARCHIVE_MIME_TYPE = 'application/zip';

interface ReadBackupArchiveOptions {
  hydrateAssets?: boolean;
}

function stripArchiveOnlyAssetFields(record: Record<string, unknown>): Record<string, unknown> {
  const {
    [ASSET_BLOB_BACKUP_FIELD]: _legacyBlob,
    [ASSET_FILE_BACKUP_FIELD]: _archivePath,
    blob: _blob,
    ...rest
  } = record;
  return rest;
}

function getAssetArchivePath(record: Record<string, unknown>, blob: Blob): string {
  const id = String(record.id);
  const mimeType = typeof record.mimeType === 'string' && record.mimeType
    ? record.mimeType
    : blob.type || 'application/octet-stream';
  return `${ASSETS_DIRECTORY}${id}.${getImageFileExtension(mimeType)}`;
}

export async function buildBackupArchive(backupData: BackupData): Promise<Blob> {
  const zip = new JSZip();
  const tablesFolder = zip.folder('tables') || zip;
  const assetsFolder = zip.folder('assets') || zip;
  const tables: Record<string, any[]> = {};

  for (const [tableName, records] of Object.entries(backupData.tables)) {
    if (tableName !== 'assets') {
      tables[tableName] = records;
      continue;
    }

    tables.assets = await Promise.all((records || []).map(async record => {
      if (!record?.id || typeof record !== 'object') return record;
      const cleanRecord = stripArchiveOnlyAssetFields(record as Record<string, unknown>);

      try {
        const asset = await assetStore.getAsset(String(record.id));
        if (!asset?.blob) return cleanRecord;

        const archivePath = getAssetArchivePath(cleanRecord, asset.blob);
        assetsFolder.file(archivePath.replace(ASSETS_DIRECTORY, ''), asset.blob);
        return {
          ...cleanRecord,
          [ASSET_FILE_BACKUP_FIELD]: archivePath,
        };
      } catch (error) {
        console.warn(`[Backup Archive] Could not include binary asset ${record.id}:`, error);
        return cleanRecord;
      }
    }));
  }

  zip.file('manifest.json', JSON.stringify(backupData.manifest, null, 2));
  zip.file(LOCAL_SETTINGS_BACKUP_FILE, JSON.stringify(backupData.localSettings, null, 2));

  for (const [tableName, records] of Object.entries(tables)) {
    tablesFolder.file(`${tableName}.json`, JSON.stringify(records, null, 2));
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

async function readJsonFile<T>(zip: JSZip, path: string): Promise<T | undefined> {
  const file = zip.file(path);
  if (!file) return undefined;
  return JSON.parse(await file.async('string')) as T;
}

async function hydrateArchiveAssetRecords(zip: JSZip, records: any[]): Promise<any[]> {
  return Promise.all(records.map(async record => {
    const archivePath = record?.[ASSET_FILE_BACKUP_FIELD];
    if (typeof archivePath !== 'string') return record;

    const assetFile = zip.file(archivePath);
    const { [ASSET_FILE_BACKUP_FIELD]: _archivePath, ...rest } = record;
    if (!assetFile) return rest;

    const blob = await assetFile.async('blob');
    return prepareRestoredAssetRecord(rest as any, blob);
  }));
}

export async function readBackupArchive(file: Blob, options: ReadBackupArchiveOptions = {}): Promise<BackupData> {
  const hydrateAssets = options.hydrateAssets ?? true;
  const zip = await JSZip.loadAsync(file);
  const manifest = await readJsonFile<BackupData['manifest']>(zip, 'manifest.json');
  if (!manifest) throw new Error('Invalid backup ZIP: missing manifest.json');

  const backupData: BackupData = {
    manifest,
    tables: {},
    localSettings: await readJsonFile<BackupData['localSettings']>(zip, LOCAL_SETTINGS_BACKUP_FILE) || {},
  };

  for (const relativePath of Object.keys(zip.files)) {
    if (!relativePath.endsWith('.json')) continue;
    if (relativePath === 'manifest.json' || relativePath === LOCAL_SETTINGS_BACKUP_FILE) continue;

    const tableName = relativePath.startsWith(TABLES_DIRECTORY)
      ? relativePath.slice(TABLES_DIRECTORY.length).replace(/\.json$/, '')
      : relativePath.replace(/\.json$/, '');
    const tableContent = await readJsonFile<any[]>(zip, relativePath);
    if (Array.isArray(tableContent)) {
      backupData.tables[tableName] = tableContent;
    }
  }

  if (hydrateAssets && Array.isArray(backupData.tables.assets)) {
    backupData.tables.assets = await hydrateArchiveAssetRecords(zip, backupData.tables.assets);
  }

  return backupData;
}
