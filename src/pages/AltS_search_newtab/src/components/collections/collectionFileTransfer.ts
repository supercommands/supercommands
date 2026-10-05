import { hasImageSignature, validateImageAsset } from '../../../../../storage/assets/assetPolicy';

export const COLLECTION_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/** Browser file metadata is advisory; the background validates the bytes again. */
export async function inspectCollectionImage(file: File): Promise<{ fileName: string; title: string }> {
    validateImageAsset(file);
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!hasImageSignature(signature, file.type)) throw new Error('Image bytes do not match the selected file type.');
    const fileName = file.name.trim() || 'Image';
    const title = fileName.replace(/\.[^.]+$/, '').trim() || 'Image';
    return { fileName, title };
}
