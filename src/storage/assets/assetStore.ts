/**
 * @file assetStore.ts
 * @description Storage abstraction for assets (images) using OPFS with IndexedDB metadata.
 */

import { db } from '../indexDB/dbConfig';
import type { AssetRecord } from './assetTypes';
import { generateEntityId } from '../../shared-components/utils/idGenerator';
import { getImageFileExtension, validateImageAsset } from './assetPolicy';

export interface AssetStore {
  saveAsset(blob: Blob, mimeType: string): Promise<AssetRecord>;
  getAsset(id: string): Promise<AssetRecord | undefined>;
  deleteAsset(id: string): Promise<void>;
}

export interface AssetStorageStats {
  assetCount: number;
  assetByteSize: number;
  opfsAssetCount: number;
  indexedDbAssetCount: number;
  browserUsageBytes?: number;
  browserQuotaBytes?: number;
}

const OPFS_ASSET_DIRECTORY = 'assets';

type OpfsStorageManager = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

function getStorageManager(): OpfsStorageManager | undefined {
  return typeof navigator !== 'undefined'
    ? navigator.storage as OpfsStorageManager
    : undefined;
}

function isOpfsAvailable(): boolean {
  return Boolean(getStorageManager()?.getDirectory);
}

async function getOpfsAssetsDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const storageManager = getStorageManager();
  if (!storageManager?.getDirectory) return null;

  const root = await storageManager.getDirectory();
  return root.getDirectoryHandle(OPFS_ASSET_DIRECTORY, { create: true });
}

function getOpfsFileName(id: string, mimeType: string): string {
  return `${id}.${getImageFileExtension(mimeType)}`;
}

async function writeBlobToOpfs(fileName: string, blob: Blob): Promise<void> {
  const directory = await getOpfsAssetsDirectory();
  if (!directory) throw new Error('OPFS is not available in this browser context.');

  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function readBlobFromOpfs(fileName: string): Promise<Blob | undefined> {
  const directory = await getOpfsAssetsDirectory();
  if (!directory) return undefined;

  try {
    const fileHandle = await directory.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return undefined;
    throw error;
  }
}

async function deleteBlobFromOpfs(fileName: string): Promise<void> {
  const directory = await getOpfsAssetsDirectory();
  if (!directory) return;

  try {
    await directory.removeEntry(fileName);
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
  }
}

export class OpfsAssetStore implements AssetStore {
  
  async saveAsset(blob: Blob, mimeType: string): Promise<AssetRecord> {
    validateImageAsset(blob);

    const id = generateEntityId('asset'); // v7 ID using identity.ts
    const opfsFileName = getOpfsFileName(id, mimeType);
    let storageDriver: AssetRecord['storageDriver'] = 'indexeddb';
    let storagePath: string | undefined;
    let recordBlob: Blob | undefined = blob;

    if (isOpfsAvailable()) {
      await writeBlobToOpfs(opfsFileName, blob);
      storageDriver = 'opfs';
      storagePath = `${OPFS_ASSET_DIRECTORY}/${opfsFileName}`;
      recordBlob = undefined;
    }

    const record: AssetRecord = {
      id,
      blob: recordBlob,
      mimeType,
      byteSize: blob.size,
      createdAt: Date.now(),
      storageDriver,
      storagePath,
    };

    await db.assets.put(record);
    return record;
  }

  async getAsset(id: string): Promise<AssetRecord | undefined> {
    const record = await db.assets.get(id);
    if (!record) return undefined;

    if (record.storageDriver === 'opfs' && record.storagePath) {
      const fileName = record.storagePath.split('/').pop();
      const blob = fileName ? await readBlobFromOpfs(fileName) : undefined;
      return blob ? { ...record, blob } : record;
    }

    return record;
  }

  async deleteAsset(id: string): Promise<void> {
    const record = await db.assets.get(id);
    if (record?.storageDriver === 'opfs' && record.storagePath) {
      const fileName = record.storagePath.split('/').pop();
      if (fileName) await deleteBlobFromOpfs(fileName);
    }

    await db.assets.delete(id);
  }
}

export const assetStore = new OpfsAssetStore();

export async function getAssetStorageStats(): Promise<AssetStorageStats> {
  const assets = await db.assets.toArray();
  const assetByteSize = assets.reduce((total, asset) => total + (asset.byteSize || asset.blob?.size || 0), 0);
  const storageEstimate = typeof navigator !== 'undefined' && navigator.storage?.estimate
    ? await navigator.storage.estimate()
    : undefined;

  return {
    assetCount: assets.length,
    assetByteSize,
    opfsAssetCount: assets.filter(asset => asset.storageDriver === 'opfs').length,
    indexedDbAssetCount: assets.filter(asset => asset.storageDriver !== 'opfs').length,
    browserUsageBytes: storageEstimate?.usage,
    browserQuotaBytes: storageEstimate?.quota,
  };
}
