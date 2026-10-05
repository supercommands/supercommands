import { db } from '../indexDB/dbConfig';
import { collectionItemAssetIds } from '../../allObjectFolder/src/createObject/collections/collectionItemAssets';

function extractAssetIdsFromHtml(html: string | undefined): string[] {
    if (typeof html !== 'string' || !html) return [];
    return Array.from(html.matchAll(/data-local-asset-id=["']([^"']+)["']/g), match => match[1]);
}

/** Call within the owner's transaction when checking immediately before deletion. */
export async function getReferencedAssetIds(): Promise<Set<string>> {
    const used = new Set<string>();
    // The shared Note editor also persists assets on snippets and todos.
    for (const table of [db.notes, db.snippets, db.todos]) {
        for (const record of await table.toArray()) {
            const owner = record as { assetIds?: string[]; body?: string; config?: string; description?: string };
            for (const id of owner.assetIds || []) used.add(id);
            for (const html of [owner.body, owner.config, owner.description]) {
                for (const id of extractAssetIdsFromHtml(html)) used.add(id);
            }
        }
    }
    for (const item of await db.collectionItems.toArray()) {
        for (const id of collectionItemAssetIds(item)) used.add(id);
    }
    await db.collectionElementSnapshots.each(snapshot => {
        for (const resource of snapshot.resources) used.add(resource.assetId);
    });
    for (const tag of await db.tags.toArray()) {
        if (tag.appearance?.kind === 'image' &&
            typeof tag.appearance.assetId === 'string' && tag.appearance.assetId) {
            // Cleanup is conservative: retain a referenced ID even if its owner
            // needs validation/repair. Never delete bytes because a tag is malformed.
            used.add(tag.appearance.assetId);
        }
    }
    return used;
}
