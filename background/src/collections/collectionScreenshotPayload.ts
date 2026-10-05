import { ALLOWED_IMAGE_MIME_TYPES, MAX_ASSET_FILE_SIZE, hasImageSignature, validateImageAsset } from '../../../src/storage/assets/assetPolicy';
import { object, fields, requiredText, optionalText, invalid } from '../../../src/allObjectFolder/src/createObject/collections/collectionValidation';
import type { AssetSource } from '../../../src/storage/assets/assetStore';

export function decodeCollectionScreenshot(value: unknown): AssetSource {
  const data = object(value, 'Screenshot data');
  if ('assetId' in data) { fields(data, ['assetId', 'fileName']); const fileName = optionalText(data.fileName, 'File name'); return { assetId: requiredText(data.assetId, 'Asset ID'), ...(fileName ? { fileName } : {}) }; }
  fields(data, ['base64', 'mimeType', 'fileName']);
  const mimeType = requiredText(data.mimeType, 'MIME type');
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) invalid('Unsupported screenshot MIME type.');
  const bytes = decodeImageBytes(data.base64);
  if (!hasImageSignature(bytes, mimeType)) invalid('Image bytes do not match the declared MIME type.');
  const blob = new Blob([bytes], { type: mimeType }); validateImageAsset(blob);
  const fileName = optionalText(data.fileName, 'File name');
  return { blob, mimeType, ...(fileName ? { fileName } : {}) };
}
/** Shared bounded transport decoding; image acquisition applies its own format normalization. */
export function decodeImageBytes(base64: unknown) {
  if (typeof base64 !== 'string' || !base64.length || base64.length > 4 * Math.ceil(MAX_ASSET_FILE_SIZE / 3)) invalid('Screenshot bytes are empty or exceed the asset limit.');
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) invalid('Screenshot bytes must be canonical raw base64.');
  const binary = atob(base64);
  if (binary.length > MAX_ASSET_FILE_SIZE || btoa(binary) !== base64) invalid('Screenshot bytes are invalid or exceed the asset limit.');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
export function decodeCollectionItemInput(value: unknown): Record<string, unknown> {
  const input = object(value, 'Item input');
  if (input.type !== 'screenshot' || input.data === undefined) return input;
  return { ...input, data: decodeCollectionScreenshot(input.data) };
}
