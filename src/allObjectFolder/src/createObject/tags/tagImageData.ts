import { db } from '../../../../storage/indexDB/dbConfig';
import { assetStore } from '../../../../storage/assets/assetStore';
import { withAssetLifecycleLock } from '../../../../storage/assets/assetLifecycle';
import { validateTagAppearance } from './tagAppearanceValidation';
import { validateTagImageBlob } from './tagImagePayload';
import type { TagImageReadResult } from './tagImageBridgeTypes';

/** Owner-scoped read: never expose arbitrary asset bytes through the tag bridge. */
export async function readTagImage(input: unknown): Promise<TagImageReadResult> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid tag image request.');
    const payload = input as Record<string, unknown>;
    if (Object.keys(payload).length !== 2 || typeof payload.tagId !== 'string' || !payload.tagId.trim())
        throw new Error('Invalid tag image request.');
    const appearance = validateTagAppearance({kind: 'image', assetId: payload.assetId});
    if (appearance.kind !== 'image') throw new Error('Invalid tag image request.');
    const tagId = payload.tagId, assetId = appearance.assetId;
    return withAssetLifecycleLock(async () => {
        const checkOwner = async () => {
            const tag = await db.tags.get(tagId);
            if (!tag || tag.appearance?.kind !== 'image' || tag.appearance.assetId !== assetId)
                throw new Error('This tag no longer references the requested image.');
            validateTagAppearance(tag.appearance);
        };
        await checkOwner();
        const asset = await assetStore.getAsset(assetId);
        if (!asset?.blob || asset.mimeType !== 'image/png') throw new Error('The tag image is missing or unreadable.');
        await validateTagImageBlob(asset.blob);
        const bytes = new Uint8Array(await asset.blob.arrayBuffer());
        // Tags can change while file reads/decoding are in flight.
        await checkOwner();
        const parts: string[] = [];
        for (let offset = 0; offset < bytes.length; offset += 0x8000)
            parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
        return {tagId, assetId, mimeType: 'image/png', byteSize: bytes.length, base64: btoa(parts.join(''))};
    });
}
