/**
 * @file assetStore.ts
 * @description Storage abstraction for assets (images) using OPFS with IndexedDB metadata.
 */
import Dexie from 'dexie';
import { db } from '../indexDB/dbConfig';
import { withAssetLifecycleLock, ASSET_DELETION_GRACE_MS } from './assetLifecycle';
import { getReferencedAssetIds } from './assetReferences';
import type { AssetRecord } from './assetTypes';
import { generateEntityId } from '../../shared-components/utils/idGenerator';
import { getImageFileExtension, validateImageAsset } from './assetPolicy';
export type AssetSource = { assetId: string } | { blob: Blob; mimeType: string };
export interface AssetStore {
    withAssets<T>(sources: readonly AssetSource[], persist: (assets: AssetRecord[]) => Promise<T>): Promise<T>;
    withAsset<T>(source: AssetSource, persist: (asset: AssetRecord) => Promise<T>): Promise<T>;
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
    if (!storageManager?.getDirectory)
        return null;
    const root = await storageManager.getDirectory();
    return root.getDirectoryHandle(OPFS_ASSET_DIRECTORY, { create: true });
}
function getOpfsFileName(id: string, mimeType: string): string {
    return `${id}.${getImageFileExtension(mimeType)}`;
}
async function writeBlobToOpfs(fileName: string, blob: Blob): Promise<void> {
    const directory = await getOpfsAssetsDirectory();
    if (!directory)
        throw new Error('OPFS is not available in this browser context.');
    const fileHandle = await directory.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
        await writable.write(blob);
        await writable.close();
    } catch (error) {
        await writable.abort().catch(() => undefined);
        throw error;
    }
}
async function readBlobFromOpfs(fileName: string): Promise<Blob | undefined> {
    const directory = await getOpfsAssetsDirectory();
    if (!directory)
        return undefined;
    try {
        const fileHandle = await directory.getFileHandle(fileName);
        return await fileHandle.getFile();
    }
    catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError')
            return undefined;
        throw error;
    }
}
async function deleteBlobFromOpfs(fileName: string): Promise<void> {
    const directory = await getOpfsAssetsDirectory();
    if (!directory)
        throw new Error('OPFS is unavailable; retain asset metadata for cleanup retry.');
    try {
        await directory.removeEntry(fileName);
    }
    catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'NotFoundError')
            throw error;
    }
}
async function hashBlob(blob: Blob): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export class OpfsAssetStore implements AssetStore {
    /** One lifecycle lock covers the entire batch and the owner commit. Never nest withAsset. */
    async withAssets<T>(sources: readonly AssetSource[], persist: (assets: AssetRecord[]) => Promise<T>): Promise<T> {
        return withAssetLifecycleLock(async () => {
            const assets: AssetRecord[] = [];
            for (const source of sources) {
                const asset = 'assetId' in source ? await this.getAsset(source.assetId) : await this.saveAssetLocked(source.blob, source.mimeType);
                if (!asset?.blob) throw new Error('Asset file is missing or unreadable.');
                validateImageAsset(asset.blob);
                if (asset.mimeType !== asset.blob.type) throw new Error('Stored asset MIME type does not match its file.');
                await db.assets.update(asset.id, { pendingDeletionAt: undefined });
                assets.push({ ...asset, pendingDeletionAt: undefined });
            }
            // Failed batches retain recoverable journaled files for staged garbage collection.
            return persist(assets);
        });
    }
    async saveAsset(blob: Blob, mimeType: string): Promise<AssetRecord> {
        return withAssetLifecycleLock(() => this.saveAssetLocked(blob, mimeType));
    }

    /** Keep the lifecycle lock through the owner's commit, including reuse by ID. */
    async withAsset<T>(source: AssetSource, persist: (asset: AssetRecord) => Promise<T>): Promise<T> {
        return withAssetLifecycleLock(async () => {
            const asset = 'assetId' in source
                ? await this.getAsset(source.assetId)
                : await this.saveAssetLocked(source.blob, source.mimeType);
            if (!asset?.blob) throw new Error('Asset file is missing or unreadable.');
            validateImageAsset(asset.blob);
            if (asset.mimeType !== asset.blob.type) throw new Error('Stored asset MIME type does not match its file.');
            await db.assets.update(asset.id, { pendingDeletionAt: undefined });
            // On failure, retain the file: it may be shared or referenced by another owner.
            // Unused files are recovered by staged garbage collection.
            return persist({ ...asset, pendingDeletionAt: undefined });
        });
    }

    private async saveAssetLocked(blob: Blob, mimeType: string): Promise<AssetRecord> {
        validateImageAsset(blob);
        if (mimeType !== blob.type) throw new Error('Asset MIME type must match the supplied image.');
        const hash = await hashBlob(blob);
        const candidates = await db.assets.where('hash').equals(hash).toArray();
        const legacy = await db.assets.filter(record => !record.hash && record.mimeType === mimeType && record.byteSize === blob.size).toArray();
        for (const candidate of [...candidates, ...legacy]) {
            if (candidate.mimeType !== mimeType || candidate.byteSize !== blob.size) continue;
            const readable = await this.getAsset(candidate.id);
            if (!readable?.blob) continue;
            // Verify actual bytes even when metadata already has a hash.
            const candidateHash = await hashBlob(readable.blob);
            if (!candidate.hash) await db.assets.update(candidate.id, { hash: candidateHash });
            if (candidateHash === hash) {
                await db.assets.update(candidate.id, { pendingDeletionAt: undefined });
                return { ...readable, hash, pendingDeletionAt: undefined };
            }
        }
        const id = generateEntityId('asset');
        const opfsFileName = getOpfsFileName(id, mimeType);
        const useOpfs = isOpfsAvailable();
        const record: AssetRecord = {
            id, mimeType, byteSize: blob.size, hash, createdAt: Date.now(),
            storageDriver: useOpfs ? 'opfs' : 'indexeddb',
            storagePath: useOpfs ? `${OPFS_ASSET_DIRECTORY}/${opfsFileName}` : undefined,
            blob: useOpfs ? undefined : blob,
        };
        // Journal the intended path before touching OPFS. A worker interruption leaves
        // discoverable metadata instead of an invisible orphaned file.
        await db.assets.add(record);
        if (useOpfs) {
            try {
                await writeBlobToOpfs(opfsFileName, blob);
            } catch (error) {
                try {
                    await deleteBlobFromOpfs(opfsFileName);
                    await db.assets.delete(id);
                } catch (cleanupError) {
                    console.error('[Assets] Retained failed-write metadata for cleanup retry.', cleanupError);
                }
                throw error;
            }
        }
        return { ...record, blob };
    }

    async getAsset(id: string): Promise<AssetRecord | undefined> {
        const record = await db.assets.get(id);
        if (!record) return undefined;
        if (record.storageDriver === 'opfs') {
            const fileName = record.storagePath?.split('/').pop();
            const blob = fileName ? await readBlobFromOpfs(fileName) : undefined;
            return blob && blob.size === record.byteSize ? { ...record, blob } : undefined;
        }
        return record.blob && record.blob.size === record.byteSize ? record : undefined;
    }

    /** Safe staged deletion; referenced files are never removed. */
    async deleteAsset(id: string): Promise<void> {
        return withAssetLifecycleLock(async () => {
            await db.transaction('rw', [db.assets, db.notes, db.snippets, db.todos, db.collectionItems, db.collectionElementSnapshots, db.tags], async () => {
                const record = await db.assets.get(id);
                if (!record) return;
                if ((await getReferencedAssetIds()).has(id)) {
                    if (record.pendingDeletionAt !== undefined) await db.assets.update(id, { pendingDeletionAt: undefined });
                    return;
                }
                const now = Date.now();
                if (record.pendingDeletionAt === undefined) {
                    await db.assets.update(id, { pendingDeletionAt: now });
                    return;
                }
                if (now - record.pendingDeletionAt < ASSET_DELETION_GRACE_MS) return;
                if (record.storageDriver === 'opfs') {
                    const fileName = record.storagePath?.split('/').pop();
                    if (!fileName) throw new Error('OPFS asset path is missing; retain metadata for recovery.');
                    // Keep owner stores locked while the final file removal is in flight.
                    await Dexie.waitFor(deleteBlobFromOpfs(fileName));
                }
                await db.assets.delete(id);
            });
        });
    }
}
export const assetStore = new OpfsAssetStore();
export async function prepareRestoredAssetRecord(record: AssetRecord, blob: Blob): Promise<AssetRecord> {
    const mimeType = record.mimeType || blob.type;
    const byteSize = record.byteSize || blob.size;
    if (isOpfsAvailable()) {
        try {
            const opfsFileName = getOpfsFileName(record.id, mimeType);
            await writeBlobToOpfs(opfsFileName, blob);
            return {
                ...record,
                blob: undefined,
                mimeType,
                byteSize,
                storageDriver: 'opfs',
                storagePath: `${OPFS_ASSET_DIRECTORY}/${opfsFileName}`,
            };
        }
        catch (error) {
            console.warn(`[Asset Restore] Failed to restore asset ${record.id} into OPFS; falling back to IndexedDB blob.`, error);
        }
    }
    return {
        ...record,
        blob,
        mimeType,
        byteSize,
        storageDriver: 'indexeddb',
        storagePath: undefined,
    };
}
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

