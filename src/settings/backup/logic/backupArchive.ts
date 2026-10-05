import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { getImageFileExtension } from '../../../storage/assets/assetPolicy';
import { LOCAL_SETTINGS_BACKUP_FILE } from './localSettingsBackup';
import { ASSET_BLOB_BACKUP_FIELD, ASSET_FILE_BACKUP_FIELD } from './assetBackupPayload';
import type { BackupData } from './extractData';
import { normaliseOrganisationBackup } from './normaliseOrganisationBackup';
import { backupDataUrlToBlob, readBackupAssetBlobs, validateBackupAssetBlob } from './backupAssetPayloads';
import { validateCurrentBackupSnapshot } from './backupSnapshotValidation';
import { BACKUP_SCHEMA_VERSION } from './backupRegistry';
import { validateBackupTagImageReferences, validateBackupTagImageBlob } from './tagAssetBackupValidation';

const TABLES_DIRECTORY = 'tables/';
const ASSETS_DIRECTORY = 'assets/';
export const BACKUP_ARCHIVE_MIME_TYPE = 'application/zip';

type ZipFiles = Record<string, Uint8Array>;

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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function buildBackupArchive(backupData: BackupData): Promise<Blob> {
  validateCurrentBackupSnapshot(backupData);
  const blobs = await readBackupAssetBlobs(backupData);
  const zipFiles: ZipFiles = {};
  const tables: Record<string, any[]> = {};

  for (const [tableName, records] of Object.entries(backupData.tables)) {
    if (tableName !== 'assets') {
      tables[tableName] = records;
      continue;
    }

    tables.assets = await Promise.all((records || []).map(async record => {
      if (!record?.id || typeof record !== 'object') return record;
      const cleanRecord = stripArchiveOnlyAssetFields(record as Record<string, unknown>);

      const blob = blobs.get(record.id)!;
      const archivePath = getAssetArchivePath(cleanRecord, blob);
      zipFiles[archivePath] = new Uint8Array(await blob.arrayBuffer());
      return {
        ...cleanRecord,
        [ASSET_FILE_BACKUP_FIELD]: archivePath,
      };
    }));
  }

  zipFiles['manifest.json'] = strToU8(JSON.stringify(backupData.manifest, null, 2));
  zipFiles[LOCAL_SETTINGS_BACKUP_FILE] = strToU8(JSON.stringify(backupData.localSettings, null, 2));

  for (const [tableName, records] of Object.entries(tables)) {
    zipFiles[`${TABLES_DIRECTORY}${tableName}.json`] = strToU8(JSON.stringify(records, null, 2));
  }

  const archive = zipSync(zipFiles, { level: 6 });
  return new Blob([toArrayBuffer(archive)], { type: BACKUP_ARCHIVE_MIME_TYPE });
}

function readJsonFile<T>(zipFiles: ZipFiles, path: string): T | undefined {
  const file = zipFiles[path];
  if (!file) return undefined;
  return JSON.parse(strFromU8(file)) as T;
}

async function hydrateArchiveAssetRecords(zipFiles: ZipFiles, records: any[]): Promise<any[]> {
  return Promise.all(records.map(async record => {
    const archivePath = record?.[ASSET_FILE_BACKUP_FIELD];
    if (typeof archivePath !== 'string') return record;

    const assetFile = zipFiles[archivePath];
    const { [ASSET_FILE_BACKUP_FIELD]: _archivePath, ...rest } = record;
    if (!assetFile) return rest;

    const blob = await validateBackupAssetBlob(rest, new Blob([toArrayBuffer(assetFile)], {type: rest.mimeType}));
    // Reading a backup must never write over the current profile's OPFS files.
    return {...rest, blob, storageDriver: 'indexeddb', storagePath: undefined};
  }));
}

async function validateArchiveImages(zipFiles: ZipFiles, backup: BackupData): Promise<void> {
  const tagImageIds = validateBackupTagImageReferences(backup.tables);
  for (const record of backup.tables.assets || []) {
    const path = record?.[ASSET_FILE_BACKUP_FIELD];
    let blob: Blob | undefined;
    if (path !== undefined) {
      if (typeof path !== 'string' || !/^assets\/[A-Za-z0-9_-]+\.(png|jpg|webp|gif|bin)$/.test(path)
        || !zipFiles[path]) throw new Error(`Invalid backup ZIP: missing or invalid image file for ${record.id}.`);
      blob = new Blob([toArrayBuffer(zipFiles[path])], {type: record.mimeType});
    } else if (typeof record?.[ASSET_BLOB_BACKUP_FIELD] === 'string') {
      blob = backupDataUrlToBlob(record[ASSET_BLOB_BACKUP_FIELD]);
    }
    if (!blob && (backup.manifest.schemaVersion >= 8 || tagImageIds.has(record.id)))
      throw new Error(`Invalid backup ZIP: image bytes missing for ${record.id}.`);
    if (blob) {
      const verifiedBlob = await validateBackupAssetBlob(record, blob);
      if (tagImageIds.has(record.id)) await validateBackupTagImageBlob(record.id, verifiedBlob);
    }
  }
}

export async function readBackupArchive(file: Blob, options: ReadBackupArchiveOptions = {}): Promise<BackupData> {
  const hydrateAssets = options.hydrateAssets ?? true;
  const zipFiles = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifest = readJsonFile<BackupData['manifest']>(zipFiles, 'manifest.json');
  if (!manifest) throw new Error('Invalid backup ZIP: missing manifest.json');

  const backupData: BackupData = {
    manifest,
    tables: {},
    localSettings: readJsonFile<BackupData['localSettings']>(zipFiles, LOCAL_SETTINGS_BACKUP_FILE) || {},
  };

  for (const relativePath of Object.keys(zipFiles)) {
    if (!relativePath.endsWith('.json')) continue;
    if (relativePath === 'manifest.json' || relativePath === LOCAL_SETTINGS_BACKUP_FILE) continue;

    const tableName = relativePath.startsWith(TABLES_DIRECTORY)
      ? relativePath.slice(TABLES_DIRECTORY.length).replace(/\.json$/, '')
      : relativePath.replace(/\.json$/, '');
    const tableContent = readJsonFile<any[]>(zipFiles, relativePath);
    if (Array.isArray(tableContent)) {
      backupData.tables[tableName] = tableContent;
    }
  }

  if (manifest.schemaVersion >= 8) {
    if (!zipFiles[LOCAL_SETTINGS_BACKUP_FILE]) throw new Error('Invalid backup ZIP: missing settings.json');
    // Phase-1 schema-8 ZIPs used canonical paths but retained flat manifest names.
    // Repair only that known declaration mismatch, never synthesize missing files.
    manifest.files = manifest.files?.map(entry => entry.kind === 'table' && entry.name === `${entry.tableName}.json`
      && zipFiles[`${TABLES_DIRECTORY}${entry.tableName}.json`]
      ? {...entry, name: `${TABLES_DIRECTORY}${entry.tableName}.json`} : entry);
    for (const entry of manifest.files || []) {
      if (!zipFiles[entry.name]) throw new Error(`Invalid backup ZIP: missing declared file ${entry.name}.`);
    }
    // Validate schema-8's full original manifest before normalizing its missing snapshot table.
    if (manifest.schemaVersion === 8) {
      const original = backupData.manifest;
      const normalized = normaliseOrganisationBackup(backupData);
      const currentTables = normalized.manifest.tables;
      const expected: string[] = currentTables.filter(name => name !== 'collectionElementSnapshots');
      if (!Array.isArray(original.tables) || original.tables.length !== expected.length || new Set(original.tables).size !== expected.length
          || original.tables.some(name => !expected.includes(name))) throw new Error('Invalid schema-8 backup table registry.');
      for (const name of expected) {
        const rows = backupData.tables[name];
        const files = original.files?.filter(entry => entry.kind === 'table' && entry.tableName === name);
        if (!Array.isArray(rows) || original.tableCounts?.[name] !== rows.length || files?.length !== 1
            || files[0].name !== `tables/${name}.json` || files[0].recordCount !== rows.length) throw new Error(`Invalid schema-8 backup declaration for ${name}.`);
      }
      if (Object.keys(backupData.tables).length !== expected.length || original.files?.length !== expected.length + 2
          || new Set(original.files.map(entry => entry.name)).size !== original.files.length
          || !original.files.some(entry => entry.kind === 'manifest' && entry.name === 'manifest.json')
          || !original.files.some(entry => entry.kind === 'settings' && entry.name === LOCAL_SETTINGS_BACKUP_FILE)) throw new Error('Invalid schema-8 backup file registry.');
      validateCurrentBackupSnapshot(normalized);
    } else validateCurrentBackupSnapshot(backupData);
  }
  // Validate even metadata-only reads without adopting files or writing to OPFS.
  await validateArchiveImages(zipFiles, backupData);

  if (hydrateAssets && Array.isArray(backupData.tables.assets)) {
    backupData.tables.assets = await hydrateArchiveAssetRecords(zipFiles, backupData.tables.assets);
  }

  return normaliseOrganisationBackup(backupData);
}
