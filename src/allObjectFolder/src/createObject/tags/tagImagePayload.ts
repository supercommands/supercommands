import { hasImageSignature } from '../../../../storage/assets/assetPolicy';
import { MAX_TAG_IMAGE_DATA_LENGTH, validateTagImageThumbnail } from './tagAppearanceValidation';

/** Works in the background worker; no DOM or file work belongs in a tag transaction. */
export async function validateTagImageBlob(blob: Blob): Promise<void> {
    if (blob.type !== 'image/png' || !blob.size ||
        Math.ceil(blob.size / 3) * 4 + 'data:image/png;base64,'.length > MAX_TAG_IMAGE_DATA_LENGTH)
        throw new Error('Choose a valid small PNG thumbnail.');
    const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    if (!hasImageSignature(header, 'image/png') || header.length < 24 ||
        String.fromCharCode(...header.slice(12, 16)) !== 'IHDR')
        throw new Error('The thumbnail is not a valid PNG image.');
    const dimensions = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (dimensions.getUint32(16) !== 64 || dimensions.getUint32(20) !== 64)
        throw new Error('The tag thumbnail must be 64 × 64 pixels.');
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(blob); }
    catch { throw new Error('This thumbnail could not be read. Try another image.'); }
    try {
        if (bitmap.width !== 64 || bitmap.height !== 64) throw new Error('The tag thumbnail must be 64 × 64 pixels.');
    } finally { bitmap.close(); }
}

export async function tagThumbnailToBlob(value: unknown): Promise<Blob> {
    const thumbnail = validateTagImageThumbnail(value);
    let binary: string;
    try { binary = atob(thumbnail.slice(thumbnail.indexOf(',') + 1)); }
    catch { throw new Error('The thumbnail has invalid image bytes.'); }
    const blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], {type: 'image/png'});
    await validateTagImageBlob(blob);
    return blob;
}
