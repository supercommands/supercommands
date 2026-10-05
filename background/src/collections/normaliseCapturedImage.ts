import { ALLOWED_IMAGE_MIME_TYPES, hasImageSignature, validateImageAsset } from '../../../src/storage/assets/assetPolicy';
import { ELEMENT_CLIP_RUNTIME_LIMITS } from '../../../src/allObjectFolder/src/createObject/collections/elementSnapshotLimits';

function readable(bitmap: ImageBitmap): void {
  if (!Number.isFinite(bitmap.width) || !Number.isFinite(bitmap.height) || bitmap.width < 1 || bitmap.height < 1) throw new Error('Image is empty.');
}

/** Preserve supported bytes; otherwise rasterize with the browser decoder into an owned PNG. */
export async function normaliseCapturedImage(blob: Blob): Promise<Blob> {
  if (!blob.size || blob.size > ELEMENT_CLIP_RUNTIME_LIMITS.imageBytes) throw new Error('Image bytes exceed the capture limit.');
  const signature = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  for (const mimeType of ALLOWED_IMAGE_MIME_TYPES) {
    if (!hasImageSignature(signature, mimeType)) continue;
    const supported = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    validateImageAsset(supported);
    if (typeof createImageBitmap === 'function') {
      const decoded = await createImageBitmap(supported);
      try { readable(decoded); } finally { decoded.close(); }
    }
    return supported;
  }
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') throw new Error('Image cannot be decoded.');
  const bitmap = await createImageBitmap(blob);
  try {
    readable(bitmap);
    const scale = Math.min(1, Math.sqrt(ELEMENT_CLIP_RUNTIME_LIMITS.decodePixels / (bitmap.width * bitmap.height)));
    const canvas = new OffscreenCanvas(Math.max(1, Math.floor(bitmap.width * scale)), Math.max(1, Math.floor(bitmap.height * scale)));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Image cannot be rasterized.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = await canvas.convertToBlob({ type: 'image/png' });
    validateImageAsset(png);
    if (!png.size || !hasImageSignature(new Uint8Array(await png.slice(0, 12).arrayBuffer()), png.type)) throw new Error('Decoded image bytes are invalid.');
    return png;
  } finally { bitmap.close(); }
}
