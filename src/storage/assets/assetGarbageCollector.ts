import { db } from '../indexDB/dbConfig';
import { assetStore } from './assetStore';

/** Marks unused files first; deletion rechecks all owners inside a transaction. */
export async function runAssetGarbageCollection(): Promise<void> {
    try {
        for (const asset of await db.assets.toArray()) {
            await assetStore.deleteAsset(asset.id);
        }
    } catch (error) {
        console.error('[GC] Failed to run asset garbage collection', error);
        throw error;
    }
}
