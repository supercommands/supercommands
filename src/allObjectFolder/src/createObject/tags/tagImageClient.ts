import { TAG_IMAGE_READ_ACTION, type TagImageReadResponse } from './tagImageBridgeTypes';
import { tagThumbnailToBlob } from './tagImagePayload';

/** Runtime messaging only. This client must not import Dexie or asset persistence. */
export async function readTagImageBlob(tagId: string, assetId: string, signal?: AbortSignal): Promise<Blob> {
    const checkCancelled = () => { if (signal?.aborted) throw new DOMException('Tag image read cancelled.', 'AbortError'); };
    checkCancelled();
    const response: TagImageReadResponse = await chrome.runtime.sendMessage({action: TAG_IMAGE_READ_ACTION, payload: {tagId, assetId}});
    checkCancelled();
    if (!response || typeof response !== 'object' || typeof response.success !== 'boolean') throw new Error('Invalid tag image response.');
    if (!response.success) throw new Error(typeof response.error === 'string' ? response.error : 'Could not load the tag image.');
    const image = response.image;
    if (!image || image.tagId !== tagId || image.assetId !== assetId || image.mimeType !== 'image/png' ||
        !Number.isSafeInteger(image.byteSize) || image.byteSize <= 0 || typeof image.base64 !== 'string')
        throw new Error('Invalid tag image response.');
    const blob = await tagThumbnailToBlob(`data:image/png;base64,${image.base64}`);
    checkCancelled();
    if (blob.size !== image.byteSize) throw new Error('Incomplete tag image response.');
    return blob;
}
