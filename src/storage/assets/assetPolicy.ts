export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_ASSET_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function validateImageAsset(file: Blob): void {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}.`);
  }
  if (file.size > MAX_ASSET_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed limit of ${formatByteSize(MAX_ASSET_FILE_SIZE)} (File is ${formatByteSize(file.size)}).`
    );
  }
}

