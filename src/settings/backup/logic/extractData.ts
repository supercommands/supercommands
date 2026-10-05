import { db } from '../../../storage/indexDB/dbConfig';
import {
  BACKUP_KIND,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLE_NAMES,
  BackupTableName,
  assertBackupRegistryMatchesDexie,
} from './backupRegistry';
import { LOCAL_SETTINGS_BACKUP_FILE, LocalSettingsBackup, extractLocalSettingsBackup } from './localSettingsBackup';
import { withAssetLifecycleLock } from '../../../storage/assets/assetLifecycle';
import { captureBackupAssetBlobs, readBackupAssetBlobs } from './backupAssetPayloads';
import { validateCurrentBackupSnapshot } from './backupSnapshotValidation';
import { ASSET_BLOB_BACKUP_FIELD } from './assetBackupPayload';
import { collectionBackupSummary, type CollectionBackupSummary } from './backupPresentation';
import { normaliseStoredCollectionFields } from './normaliseCollectionBackup';

export interface BackupManifest {
  source: string;
  schemaVersion: number;
  originalSchemaVersion?: number;
  collectionSummary?: CollectionBackupSummary;
  backupNumber: number;
  createdAt: string;
  estimatedPayloadBytes?: number;
  assetPayloadBytes?: number;
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
  includeAssetBinaryPayloads?: boolean;
  logPerf?: boolean;
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

function createExtractionPerfTrace(label: string) {
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
    byteLength(JSON.stringify(backupData.manifest, null, 2)) +
    (backupData.manifest.assetPayloadBytes || 0)
  );
}

export const extractDatabaseToJSON = async (
  backupNumber: number = 1,
  options: ExtractDatabaseOptions = {},
): Promise<BackupData> => withAssetLifecycleLock(async () => {
  const includeAssetBlobPayloads = options.includeAssetBlobPayloads ?? true;
  const perf = options.logPerf ? createExtractionPerfTrace('Database extraction') : null;
  assertBackupRegistryMatchesDexie();
  perf?.mark('registry-check', { tables: BACKUP_TABLE_NAMES.length });
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
  perf?.mark('local-settings');

  const tables = BACKUP_TABLE_NAMES.map(name => db.table(name));
  // All table reads share one readonly transaction. No OPFS work runs inside it.
  await db.transaction('r', tables, async () => {
    for (const tableName of BACKUP_TABLE_NAMES) {
      const records = await db.table(tableName).toArray();
      backupData.tables[tableName] = records;
      backupData.manifest.tableCounts[tableName] = records.length;
      backupData.manifest.files.push({
        name: `tables/${tableName}.json`, kind: 'table', tableName, recordCount: records.length,
      });
      perf?.mark(`table:${tableName}`, { records: records.length });
    }
  });
  // Older writers/imports can leave optional columns absent even after schema upgrades.
  // Normalize the detached snapshot only; never modify live data or mask invalid values.
  backupData.tables = normaliseStoredCollectionFields(backupData.tables);
  validateCurrentBackupSnapshot(backupData);
  backupData.manifest.collectionSummary = collectionBackupSummary(backupData.tables);
  if (includeAssetBlobPayloads || options.includeAssetBinaryPayloads) {
    const blobs = await readBackupAssetBlobs(backupData);
    captureBackupAssetBlobs(backupData, blobs);
    if (!includeAssetBlobPayloads) backupData.manifest.assetPayloadBytes = Array.from(blobs.values()).reduce((total, blob) => total + blob.size, 0);
    backupData.tables.assets = await Promise.all(backupData.tables.assets.map(async record => {
      const {blob: _blob, ...metadata} = record;
      return includeAssetBlobPayloads
        ? {...metadata, [ASSET_BLOB_BACKUP_FIELD]: await blobToDataUrl(blobs.get(record.id)!)}
        : metadata;
    }));
    perf?.mark('capture-images', { assets: blobs.size });
  }

  backupData.manifest.estimatedPayloadBytes = calculateBackupPayloadBytes(backupData);
  perf?.mark('estimate-payload', { bytes: backupData.manifest.estimatedPayloadBytes });
  perf?.log();

  return backupData;
});

