export const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
]);
export function getImageFileExtension(mimeType: string): string {
    switch (mimeType) {
        case 'image/png':
            return 'png';
        case 'image/jpeg':
            return 'jpg';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return 'bin';
    }
}
export function formatByteSize(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export const MAX_ASSET_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
/** Reject mislabeled uploads before they enter collection asset storage. */
export function hasImageSignature(bytes: Uint8Array, mimeType: string): boolean {
    if (mimeType === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
    if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (mimeType === 'image/gif') return bytes.length >= 6 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56 && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97;
    if (mimeType === 'image/webp') return bytes.length >= 12 && [82, 73, 70, 70].every((value, index) => bytes[index] === value) && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value);
    return false;
}
export function validateImageAsset(file: Blob): void {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
        throw new Error(`Unsupported image type: ${file.type || 'unknown'}.`);
    }
    if (file.size > MAX_ASSET_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed limit of ${formatByteSize(MAX_ASSET_FILE_SIZE)} (File is ${formatByteSize(file.size)}).`);
    }
}
