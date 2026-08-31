import { db } from '../../../storage/indexDB/dbConfig';
import { BackupData } from './extractData';
import { BACKUP_KIND, BACKUP_SCHEMA_VERSION, BACKUP_TABLE_NAMES, LEGACY_OPTIONAL_BACKUP_TABLE_NAMES } from './backupRegistry';
import { restoreLocalSettingsBackup } from './localSettingsBackup';
import { ASSET_BLOB_BACKUP_FIELD } from './assetBackupPayload';
import { prepareRestoredAssetRecord } from '../../../storage/assets/assetStore';

function dataUrlToBlob(dataUrl: string): Blob | undefined {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return undefined;

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function hydrateAssetBackupRecords(records: any[]): Promise<any[]> {
  return Promise.all(records.map(async record => {
    const dataUrl = record?.[ASSET_BLOB_BACKUP_FIELD];
    if (typeof dataUrl !== 'string') return record;

    const blob = dataUrlToBlob(dataUrl);
    const { [ASSET_BLOB_BACKUP_FIELD]: _backupBlob, ...rest } = record;
    if (!blob) return rest;

    return prepareRestoredAssetRecord(rest, blob);
  }));
}

const validateBackupData = (backupData: BackupData): void => {
  if (!backupData || !backupData.manifest || !backupData.tables) {
    throw new Error('Invalid backup data format. Missing manifest or tables.');
  }

  const { manifest } = backupData;
  if (manifest.source !== 'cmdos') {
    throw new Error('Invalid backup source. Expected a cmdOS backup.');
  }

  if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${manifest.schemaVersion ?? 'missing'}.`);
  }

  if (manifest.backupKind !== BACKUP_KIND) {
    throw new Error(`Unsupported backup kind: ${manifest.backupKind ?? 'missing'}.`);
  }

  if (manifest.status !== 'complete') {
    throw new Error('Backup is incomplete and cannot be restored.');
  }

  if (!Number.isFinite(manifest.backupNumber) || manifest.backupNumber < 1) {
    throw new Error('Invalid backup number in manifest.');
  }

  const manifestTables = new Set(manifest.tables || []);
  const legacyOptionalTables = new Set<string>(LEGACY_OPTIONAL_BACKUP_TABLE_NAMES);
  const missingManifestTables = BACKUP_TABLE_NAMES.filter(tableName => !manifestTables.has(tableName) && !legacyOptionalTables.has(tableName));
  if (missingManifestTables.length > 0) {
    throw new Error(`Backup manifest is missing required table(s): ${missingManifestTables.join(', ')}`);
  }

  const missingPayloadTables = BACKUP_TABLE_NAMES.filter(tableName => !Array.isArray(backupData.tables[tableName]) && !legacyOptionalTables.has(tableName));
  if (missingPayloadTables.length > 0) {
    throw new Error(`Backup payload is missing required table file(s): ${missingPayloadTables.join(', ')}`);
  }

  if (backupData.localSettings !== undefined && typeof backupData.localSettings !== 'object') {
    throw new Error('Backup local settings payload is invalid.');
  }
};

export const restoreDatabaseFromJSON = async (backupData: BackupData): Promise<void> => {
  validateBackupData(backupData);
  for (const tableName of LEGACY_OPTIONAL_BACKUP_TABLE_NAMES) {
    if (!Array.isArray(backupData.tables[tableName])) {
      backupData.tables[tableName] = [];
    }
  }
  if (Array.isArray(backupData.tables.assets)) {
    backupData.tables.assets = await hydrateAssetBackupRecords(backupData.tables.assets);
  }

  // We use a single read-write transaction covering all tables.
  // If anything fails inside here, the entire transaction automatically rolls back.
  await db.transaction('rw', db.tables, async () => {
    // Step 1: Wipe all existing data first
    console.log('[Backup Restore] Wiping all existing tables...');
    await Promise.all(db.tables.map(table => table.clear()));

    // Step 2: Inject data strictly in the hierarchical order
    console.log('[Backup Restore] Injecting new data hierarchically...');
    for (const tableName of BACKUP_TABLE_NAMES) {
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

  await restoreLocalSettingsBackup(backupData.localSettings);

  console.log('[Backup Restore] Restoration completed successfully!');
};
