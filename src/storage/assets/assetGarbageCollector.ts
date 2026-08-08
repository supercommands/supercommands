import { db } from '../indexDB/dbConfig';
import { assetStore } from './assetStore';

function extractAssetIdsFromHtml(html: string | undefined): string[] {
  if (!html) return [];

  const ids = new Set<string>();
  const regex = /data-local-asset-id=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  return Array.from(ids);
}

/**
 * Runs a garbage collection cycle to identify and safely delete 
 * orphaned assets (e.g., images that were deleted from a note).
 */
export async function runAssetGarbageCollection() {
  try {
    const allNotes = await db.notes.toArray();
    const usedAssetIds = new Set<string>();
    
    // Collect all assetIds currently in use by any note
    for (const note of allNotes) {
      if (note.assetIds && Array.isArray(note.assetIds)) {
        for (const id of note.assetIds) {
          usedAssetIds.add(id);
        }
      }

      for (const id of extractAssetIdsFromHtml(note.body)) {
        usedAssetIds.add(id);
      }
    }

    // Iterate through all stored assets
    const allAssets = await db.assets.toArray();
    for (const asset of allAssets) {
      if (!usedAssetIds.has(asset.id)) {
        // If an asset is not used by ANY note, it is an orphan and can be safely deleted.
        await assetStore.deleteAsset(asset.id);
        console.log(`[GC] Deleted orphaned asset: ${asset.id}`);
      }
    }
  } catch (err) {
    console.error('[GC] Failed to run asset garbage collection', err);
  }
}
