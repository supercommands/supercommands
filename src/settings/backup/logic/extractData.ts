import { db } from '../../../storage/indexDB/dbConfig';
import {
  BACKUP_KIND,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLE_NAMES,
  BackupTableName,
  assertBackupRegistryMatchesDexie,
} from './backupRegistry';
import { LOCAL_SETTINGS_BACKUP_FILE, LocalSettingsBackup, extractLocalSettingsBackup } from './localSettingsBackup';
import { assetStore } from '../../../storage/assets/assetStore';
import { ASSET_BLOB_BACKUP_FIELD } from './assetBackupPayload';

export interface BackupManifest {
  source: string;
  schemaVersion: number;
  backupNumber: number;
  createdAt: string;
  estimatedPayloadBytes?: number;
  backupKind: typeof BACKUP_KIND;
  status: 'complete';
  parentBackupNumber?: number;
  parentBackupId?: string;
  tableCounts: Record<string, number>;
  tables: BackupTableName[];
  files: Array<{
    name: string;
    kind: 'manifest' | 'table' | 'settings';
    tableName?: BackupTableName;
    recordCount?: number;
  }>;
  version?: string;
  timestamp?: string;
}

export interface BackupData {
  manifest: BackupManifest;
  tables: Record<string, any[]>;
  localSettings: LocalSettingsBackup;
}

interface ExtractDatabaseOptions {
  includeAssetBlobPayloads?: boolean;
}

function byteLength(content: string): number {
  return new Blob([content]).size;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read asset blob.'));
    reader.readAsDataURL(blob);
  });
}

async function attachAssetBlobPayloads(records: any[]): Promise<any[]> {
  return Promise.all(records.map(async record => {
    if (!record?.id) return record;

    try {
      const asset = await assetStore.getAsset(record.id);
      if (!asset?.blob) return record;

      return {
        ...record,
        [ASSET_BLOB_BACKUP_FIELD]: await blobToDataUrl(asset.blob),
      };
    } catch (error) {
      console.warn(`[Backup Extraction] Could not include asset blob ${record.id}:`, error);
      return record;
    }
  }));
}

export function formatBackupPayloadSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

export function calculateBackupPayloadBytes(backupData: BackupData): number {
  const tableBytes = Object.values(backupData.tables).reduce((sum, records) => {
    return sum + byteLength(JSON.stringify(records, null, 2));
  }, 0);

  return (
    tableBytes +
    byteLength(JSON.stringify(backupData.localSettings, null, 2)) +
    byteLength(JSON.stringify(backupData.manifest, null, 2))
  );
}

export const extractDatabaseToJSON = async (
  backupNumber: number = 1,
  options: ExtractDatabaseOptions = {},
): Promise<BackupData> => {
  const includeAssetBlobPayloads = options.includeAssetBlobPayloads ?? true;
  assertBackupRegistryMatchesDexie();
  const backupData: BackupData = {
    manifest: {
      source: 'cmdos',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      backupNumber,
      createdAt: new Date().toISOString(),
      backupKind: BACKUP_KIND,
      status: 'complete',
      tableCounts: {},
      tables: [...BACKUP_TABLE_NAMES],
      files: [
        {
          name: 'manifest.json',
          kind: 'manifest',
        },
        {
          name: LOCAL_SETTINGS_BACKUP_FILE,
          kind: 'settings',
        },
      ],
    },
    tables: {},
    localSettings: await extractLocalSettingsBackup(),
  };

  for (const tableName of BACKUP_TABLE_NAMES) {
    try {
      // @ts-ignore - dynamic table access
      const table = db[tableName];
      if (table) {
        const tableRecords = await table.toArray();
        const records = tableName === 'assets' && includeAssetBlobPayloads
          ? await attachAssetBlobPayloads(tableRecords)
          : tableRecords;
        backupData.tables[tableName] = records;
        backupData.manifest.tableCounts[tableName] = records.length;
        backupData.manifest.files.push({
          name: `${tableName}.json`,
          kind: 'table',
          tableName,
          recordCount: records.length,
        });
      } else {
        console.warn(`[Backup Extraction] Table ${tableName} not found in Dexie.`);
        backupData.tables[tableName] = [];
        backupData.manifest.tableCounts[tableName] = 0;
        backupData.manifest.files.push({
          name: `${tableName}.json`,
          kind: 'table',
          tableName,
          recordCount: 0,
        });
      }
    } catch (err) {
      console.error(`[Backup Extraction] Error reading table ${tableName}:`, err);
      backupData.tables[tableName] = [];
      backupData.manifest.tableCounts[tableName] = 0;
      backupData.manifest.files.push({
        name: `${tableName}.json`,
        kind: 'table',
        tableName,
        recordCount: 0,
      });
    }
  }

  backupData.manifest.estimatedPayloadBytes = calculateBackupPayloadBytes(backupData);

  return backupData;
};
